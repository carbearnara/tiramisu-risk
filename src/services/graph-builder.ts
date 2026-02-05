// Graph Builder Service
// Integrates adapters with vault registry to build dependency graphs

import {
  DependencyGraph,
  Entity,
  EntityType,
  DependencyEdge,
  DependencyType,
  VaultEntity,
  ProtocolEntity,
  TokenEntity,
  Chain,
  GovernanceType,
  MAX_TRAVERSAL_DEPTH,
  CycleInfo,
  CycleExposure,
} from '@/types/core';
import { cycleDetector } from './cycle-detector';
import {
  TrackedVault,
  TrackedProtocol,
  TRACKED_VAULTS,
  TRACKED_PROTOCOLS,
  TRACKED_TOKENS,
  TRACKED_ISSUERS,
  getVaultById,
  getProtocolBySlug,
  getTokenById,
} from '@/lib/vault-registry';

/**
 * Find tokens issued by a protocol or issuer
 */
function getTokensIssuedBy(issuerId: string): typeof TRACKED_TOKENS {
  return TRACKED_TOKENS.filter(t => t.issuer === issuerId);
}

/**
 * Get issuer details by ID
 */
function getIssuerById(issuerId: string) {
  return TRACKED_ISSUERS.find(i => i.id === issuerId);
}
import { adapterRegistry, ConfiguredAllocation } from '@/adapters';

// ============== TYPES ==============

export interface GraphBuildOptions {
  maxDepth?: number;
  includeGovernance?: boolean;
  includeOracles?: boolean;
}

export interface ExposureNode {
  entityId: string;
  name: string;
  type: EntityType;
  exposure: number; // USD value exposed
  percentage: number; // Percentage of root vault TVL
  depth: number;
  parentId?: string;
}

export interface GraphBuildResult {
  graph: DependencyGraph;
  exposures: Map<string, ExposureNode>;
  totalTvl: number;
  warnings: string[];
  cycles: CycleInfo[];
  cycleExposures: CycleExposure[];
}

// ============== GRAPH BUILDER ==============

export class GraphBuilder {
  private entityCache = new Map<string, Entity>();
  private warnings: string[] = [];

  /**
   * Build dependency graph for a tracked vault
   */
  async buildGraph(
    vaultId: string,
    options: GraphBuildOptions = {}
  ): Promise<GraphBuildResult> {
    const { maxDepth = MAX_TRAVERSAL_DEPTH } = options;
    this.warnings = [];
    this.entityCache.clear();

    // Get vault from registry
    const trackedVault = getVaultById(vaultId);
    if (!trackedVault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    // Fetch live TVL and allocations using adapter
    const vaultData = await adapterRegistry.fetchVaultData(
      trackedVault.protocolSlug,
      trackedVault.address || '',
      trackedVault.chain,
      trackedVault.strategyAllocations as ConfiguredAllocation[] | undefined,
      true // isERC4626
    );

    const totalTvl = vaultData.tvl?.tvlUsd || 0;
    console.log(`[GraphBuilder] Building graph for ${trackedVault.name}, TVL: $${totalTvl.toLocaleString()}`);

    // Build entities and edges using BFS
    const entities = new Map<string, Entity>();
    const edges: DependencyEdge[] = [];
    const exposures = new Map<string, ExposureNode>();

    // Queue: [entityId, depth, parentId, allocation percentage]
    const queue: Array<{
      entityId: string;
      depth: number;
      parentId?: string;
      allocationPct: number;
    }> = [];

    // Create root vault entity
    const rootEntity = this.createVaultEntity(trackedVault, totalTvl, vaultData.exposures);
    entities.set(rootEntity.id, rootEntity);
    exposures.set(rootEntity.id, {
      entityId: rootEntity.id,
      name: rootEntity.name,
      type: EntityType.VAULT,
      exposure: totalTvl,
      percentage: 100,
      depth: 0,
    });

    // Queue protocol allocations for traversal
    for (const exp of vaultData.exposures) {
      const protocolId = `protocol:${exp.protocol}`;
      queue.push({
        entityId: protocolId,
        depth: 1,
        parentId: rootEntity.id,
        allocationPct: exp.percentage,
      });

      // Add edge from vault to protocol
      edges.push({
        id: `${rootEntity.id}->${protocolId}`,
        sourceId: rootEntity.id,
        targetId: protocolId,
        type: DependencyType.STRATEGY_ALLOCATION,
        weight: exp.percentage / 100,
        metadata: {
          market: exp.market,
          asset: exp.asset,
          valueUsd: exp.valueUsd,
        },
      });

      // If this allocation has a specific underlying asset, create edge to that token
      if (exp.asset && exp.asset !== trackedVault.underlying) {
        const assetTokenId = `token:${exp.asset}:${trackedVault.chain}`;

        // Add edge from protocol to underlying asset
        edges.push({
          id: `${protocolId}->asset:${assetTokenId}`,
          sourceId: protocolId,
          targetId: assetTokenId,
          type: DependencyType.UNDERLYING_ASSET,
          weight: 1,
          metadata: {
            fromAllocation: exp.protocol,
            percentage: exp.percentage,
          },
        });

        // Queue the asset token for traversal
        queue.push({
          entityId: assetTokenId,
          depth: 2,
          parentId: protocolId,
          allocationPct: exp.percentage,
        });
      }
    }

    // Add underlying asset dependency
    const tokenId = `token:${trackedVault.underlying}:${trackedVault.chain}`;
    edges.push({
      id: `${rootEntity.id}->underlying:${tokenId}`,
      sourceId: rootEntity.id,
      targetId: tokenId,
      type: DependencyType.UNDERLYING_ASSET,
      weight: 1,
      metadata: {},
    });
    queue.push({
      entityId: tokenId,
      depth: 1,
      parentId: rootEntity.id,
      allocationPct: 100,
    });

    // BFS traversal
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { entityId, depth, parentId, allocationPct } = queue.shift()!;

      if (visited.has(entityId) || depth > maxDepth) {
        continue;
      }
      visited.add(entityId);

      // Create or get entity
      const entity = await this.getOrCreateEntity(entityId, trackedVault.chain);
      if (!entity) {
        this.warnings.push(`Could not create entity: ${entityId}`);
        continue;
      }

      entities.set(entityId, entity);

      // Calculate exposure
      const parentExposure = parentId ? (exposures.get(parentId)?.exposure || 0) : totalTvl;
      const exposure = (parentExposure * allocationPct) / 100;

      exposures.set(entityId, {
        entityId,
        name: entity.name,
        type: entity.type,
        exposure,
        percentage: totalTvl > 0 ? (exposure / totalTvl) * 100 : 0,
        depth,
        parentId,
      });

      // Get child dependencies
      const childDeps = this.getEntityDependencies(entity, trackedVault.chain, options);
      for (const dep of childDeps) {
        if (!edges.some(e => e.id === dep.edge.id)) {
          edges.push(dep.edge);
        }
        queue.push({
          entityId: dep.targetId,
          depth: depth + 1,
          parentId: entityId,
          allocationPct: dep.weight * 100,
        });
      }
    }

    const graph: DependencyGraph = {
      entities,
      edges,
      rootEntityId: rootEntity.id,
    };

    // Detect cycles in the graph
    const cycles = cycleDetector.detectCycles(graph);

    if (cycles.length > 0) {
      this.warnings.push(`Graph contains ${cycles.length} circular dependency/dependencies`);
    }

    // Calculate base exposures map for cycle calculation
    const baseExposureMap = new Map<string, number>();
    for (const [entityId, node] of exposures) {
      baseExposureMap.set(entityId, node.exposure);
    }

    // Adjust exposures for cycles
    const adjustedExposureMap = cycleDetector.adjustExposuresForCycles(
      graph,
      baseExposureMap,
      cycles,
      totalTvl
    );

    // Update exposure nodes with adjusted values
    for (const [entityId, adjustedExposure] of adjustedExposureMap) {
      const node = exposures.get(entityId);
      if (node && node.exposure !== adjustedExposure) {
        exposures.set(entityId, {
          ...node,
          exposure: adjustedExposure,
          percentage: totalTvl > 0 ? (adjustedExposure / totalTvl) * 100 : 0,
        });
      }
    }

    // Calculate cycle exposures
    const cycleExposures = cycleDetector.calculateCycleExposures(
      graph,
      cycles,
      baseExposureMap
    );

    return {
      graph,
      exposures,
      totalTvl,
      warnings: this.warnings,
      cycles,
      cycleExposures,
    };
  }

  /**
   * Create a VaultEntity from TrackedVault
   */
  private createVaultEntity(
    vault: TrackedVault,
    tvl: number,
    exposures: Array<{ protocol: string; market?: string; asset?: string; percentage: number; valueUsd: number }>
  ): VaultEntity {
    const protocol = getProtocolBySlug(vault.protocolSlug);

    return {
      id: vault.id,
      type: EntityType.VAULT,
      name: vault.name,
      chain: vault.chain,
      address: vault.address,
      metadata: { curator: vault.curator },
      tvl: tvl,
      operatorId: `protocol:${vault.protocolSlug}`,
      isERC4626: true,
      underlying: {
        symbol: vault.underlying,
        name: vault.underlying,
        address: vault.underlyingAddress || '',
        decimals: vault.underlying === 'USDC' || vault.underlying === 'USDT' ? 6 : 18,
        chain: vault.chain,
      },
      strategies: exposures.map((exp, idx) => ({
        id: `${vault.id}:strategy:${idx}`,
        name: exp.market || exp.protocol,
        targetProtocolId: `protocol:${exp.protocol}`,
        allocation: exp.percentage,
        isActive: true,
      })),
    };
  }

  /**
   * Get or create an entity by ID
   */
  private async getOrCreateEntity(
    entityId: string,
    chain: Chain
  ): Promise<Entity | null> {
    if (this.entityCache.has(entityId)) {
      return this.entityCache.get(entityId)!;
    }

    let entity: Entity | null = null;

    // Parse entity type from ID
    if (entityId.startsWith('protocol:')) {
      const slug = entityId.replace('protocol:', '');
      const protocol = getProtocolBySlug(slug);
      if (protocol) {
        entity = this.createProtocolEntity(protocol);
      } else {
        // Create stub protocol with required fields
        entity = {
          id: entityId,
          type: EntityType.PROTOCOL,
          name: slug.charAt(0).toUpperCase() + slug.slice(1),
          slug,
          category: 'Other' as any,
          chains: [chain],
          governance: { type: GovernanceType.MULTISIG },
          isUpgradeable: true,
          audits: [],
          tvl: 0,
          incidentHistory: [],
          deployedChains: [chain],
          hasTimeLock: false,
          metadata: {},
        } as ProtocolEntity;
      }
    } else if (entityId.startsWith('token:')) {
      const parts = entityId.split(':');
      const symbol = parts[1];
      const tokenChain = parts[2] as Chain || chain;
      const token = getTokenById(entityId);
      if (token) {
        entity = this.createTokenEntity(token);
      } else {
        // Create stub token with required fields
        entity = {
          id: entityId,
          type: EntityType.TOKEN,
          name: symbol,
          symbol,
          chain: tokenChain,
          tokenType: symbol.includes('USD') ? 'stablecoin' : 'other',
          decimals: symbol === 'USDC' || symbol === 'USDT' ? 6 : 18,
          metadata: {},
        } as TokenEntity;
      }
    } else if (entityId.startsWith('issuer:')) {
      const issuer = getIssuerById(entityId);
      entity = {
        id: entityId,
        type: EntityType.ISSUER,
        name: issuer?.name || entityId.replace('issuer:', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        metadata: {
          type: issuer?.type || 'unknown',
          tokens: issuer?.tokens || [],
        },
      } as Entity;
    } else if (entityId.startsWith('chain:')) {
      entity = {
        id: entityId,
        type: EntityType.GOVERNANCE, // Using governance as placeholder for chain entity
        name: entityId.replace('chain:', '').toUpperCase(),
      } as Entity;
    }

    if (entity) {
      this.entityCache.set(entityId, entity);
    }

    return entity;
  }

  /**
   * Create ProtocolEntity from TrackedProtocol
   */
  private createProtocolEntity(protocol: TrackedProtocol): ProtocolEntity {
    return {
      id: protocol.id,
      type: EntityType.PROTOCOL,
      name: protocol.name,
      metadata: { logo: `https://icons.llamao.fi/icons/protocols/${protocol.slug}` },
      category: protocol.category,
      tvl: 0, // Will be updated with live data
      governance: {
        type: protocol.governance.type,
        multisigThreshold: protocol.governance.multisigThreshold,
        timelockDuration: protocol.governance.timelockHours ? protocol.governance.timelockHours * 3600 : undefined,
      },
      oracle: protocol.oracle ? {
        type: protocol.oracle.type,
        providerId: `protocol:chainlink`,
        priceFeeds: [],
      } : undefined,
      audits: protocol.auditors.map((a, i) => ({
        id: `audit-${protocol.slug}-${i}`,
        auditor: a,
        date: new Date(),
        scope: 'full',
        findings: { critical: 0, high: 0, medium: 0, low: 0, informational: 0, resolved: 0 },
      })),
      incidentHistory: [],
      deployedChains: protocol.chains,
      isUpgradeable: protocol.isUpgradeable,
      hasTimeLock: !!protocol.governance.timelockHours,
      forkedFrom: protocol.forkedFrom,
    };
  }

  /**
   * Create TokenEntity from TrackedToken
   */
  private createTokenEntity(token: { id: string; symbol: string; name: string; chain: Chain; type: string; issuer?: string; peggedTo?: string; decimals?: number; collateral?: string[] }): TokenEntity {
    return {
      id: token.id,
      type: EntityType.TOKEN,
      name: token.name,
      symbol: token.symbol,
      chain: token.chain,
      tokenType: token.type as 'stablecoin' | 'lst' | 'lrt' | 'native' | 'wrapped' | 'governance' | 'other',
      issuerId: token.issuer,
      peggedTo: token.peggedTo,
      decimals: token.decimals ?? (token.symbol === 'USDC' || token.symbol === 'USDT' ? 6 : 18),
      collateral: token.collateral, // Pass through collateral relationships (e.g., sUSDe → USDe)
      metadata: {},
    };
  }

  /**
   * Get dependencies for an entity
   */
  private getEntityDependencies(
    entity: Entity,
    chain: Chain,
    options: GraphBuildOptions
  ): Array<{ edge: DependencyEdge; targetId: string; weight: number }> {
    const deps: Array<{ edge: DependencyEdge; targetId: string; weight: number }> = [];

    if (entity.type === EntityType.PROTOCOL) {
      const protocol = entity as ProtocolEntity;
      const slug = entity.id.replace('protocol:', '');
      const trackedProtocol = getProtocolBySlug(slug);

      // Nested protocol allocations (e.g., Cap → Ethena, Ethena → delta-neutral)
      if (trackedProtocol?.strategyAllocations) {
        for (const alloc of trackedProtocol.strategyAllocations) {
          const targetProtocolId = `protocol:${alloc.protocol}`;
          const weight = alloc.allocation / 100;

          deps.push({
            edge: {
              id: `${entity.id}->nested:${targetProtocolId}`,
              sourceId: entity.id,
              targetId: targetProtocolId,
              type: DependencyType.NESTED_VAULT, // Reusing for nested protocol exposure
              weight,
              metadata: {
                asset: alloc.asset,
                market: alloc.market,
                allocationPct: alloc.allocation,
              },
            },
            targetId: targetProtocolId,
            weight,
          });

          // Also add edge to the underlying asset if specified
          if (alloc.asset) {
            const assetTokenId = `token:${alloc.asset}:${chain}`;
            deps.push({
              edge: {
                id: `${entity.id}->asset:${assetTokenId}`,
                sourceId: entity.id,
                targetId: assetTokenId,
                type: DependencyType.UNDERLYING_ASSET,
                weight,
                metadata: {
                  viaProtocol: alloc.protocol,
                  allocationPct: alloc.allocation,
                },
              },
              targetId: assetTokenId,
              weight,
            });
          }
        }
      }

      // Check if this protocol issues any tokens (e.g., Ethena → USDe)
      const issuedTokens = getTokensIssuedBy(`protocol:${slug}`);
      for (const token of issuedTokens) {
        const tokenId = token.id;
        deps.push({
          edge: {
            id: `${entity.id}->issues:${tokenId}`,
            sourceId: entity.id,
            targetId: tokenId,
            type: DependencyType.TOKEN_ISSUER,
            weight: 1,
            metadata: {
              relationship: 'issues',
            },
          },
          targetId: tokenId,
          weight: 1,
        });
      }

      // Oracle dependency
      if (options.includeOracles && protocol.oracle?.providerId) {
        deps.push({
          edge: {
            id: `${entity.id}->oracle:${protocol.oracle.providerId}`,
            sourceId: entity.id,
            targetId: protocol.oracle.providerId,
            type: DependencyType.ORACLE_DEPENDENCY,
            weight: 1,
            metadata: {},
          },
          targetId: protocol.oracle.providerId,
          weight: 1,
        });
      }

      // Fork dependency
      if (protocol.forkedFrom) {
        deps.push({
          edge: {
            id: `${entity.id}->fork:${protocol.forkedFrom}`,
            sourceId: entity.id,
            targetId: `protocol:${protocol.forkedFrom}`,
            type: DependencyType.FORK_OF,
            weight: 0.3, // Partial risk inheritance from fork
            metadata: {},
          },
          targetId: `protocol:${protocol.forkedFrom}`,
          weight: 0.3,
        });
      }
    }

    if (entity.type === EntityType.TOKEN) {
      const token = entity as TokenEntity;

      // Issuer dependency
      if (token.issuerId) {
        deps.push({
          edge: {
            id: `${entity.id}->issuer:${token.issuerId}`,
            sourceId: entity.id,
            targetId: token.issuerId,
            type: DependencyType.TOKEN_ISSUER,
            weight: 1,
            metadata: {},
          },
          targetId: token.issuerId,
          weight: 1,
        });
      }

      // Collateral dependency
      if (token.collateral) {
        for (const collateralId of token.collateral) {
          deps.push({
            edge: {
              id: `${entity.id}->collateral:${collateralId}`,
              sourceId: entity.id,
              targetId: collateralId,
              type: DependencyType.COLLATERALIZED_BY,
              weight: 1 / token.collateral.length,
              metadata: {},
            },
            targetId: collateralId,
            weight: 1 / token.collateral.length,
          });
        }
      }
    }

    return deps;
  }

  /**
   * Quick exposure summary without full graph build
   */
  async getExposureSummary(vaultId: string): Promise<{
    tvl: number;
    exposures: Array<{ protocol: string; market?: string; valueUsd: number; percentage: number }>;
  }> {
    const vault = getVaultById(vaultId);
    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    const vaultData = await adapterRegistry.fetchVaultData(
      vault.protocolSlug,
      vault.address || '',
      vault.chain,
      vault.strategyAllocations as ConfiguredAllocation[] | undefined
    );

    return {
      tvl: vaultData.tvl?.tvlUsd || 0,
      exposures: vaultData.exposures,
    };
  }
}

// Export singleton
export const graphBuilder = new GraphBuilder();

// Convenience function
export async function buildVaultGraph(
  vaultId: string,
  options?: GraphBuildOptions
): Promise<GraphBuildResult> {
  return graphBuilder.buildGraph(vaultId, options);
}

export async function getVaultExposures(vaultId: string) {
  return graphBuilder.getExposureSummary(vaultId);
}
