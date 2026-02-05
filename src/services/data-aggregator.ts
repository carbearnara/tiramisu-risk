// Data Aggregator Service
// Builds dependency graphs using BFS traversal (inspired by Dialectic's Nebula)

import {
  Entity,
  EntityType,
  DependencyEdge,
  DependencyType,
  DependencyGraph,
  VaultEntity,
  ProtocolEntity,
  TokenEntity,
  ExposurePath,
  NOrderExposure,
  Chain,
  MAX_TRAVERSAL_DEPTH,
  isVaultEntity,
  isProtocolEntity,
  isTokenEntity,
  scoreToRiskLevel,
} from '@/types/core';

// ============== TYPES ==============

interface DependencyInfo {
  edge: DependencyEdge;
  targetEntityId: string;
}

interface TraversalNode {
  entityId: string;
  depth: number;
  path: string[];
  cumulativeWeight: number;
}

interface GraphBuildResult {
  graph: DependencyGraph;
  exposures: NOrderExposure[];
  warnings: string[];
}

// ============== DATA AGGREGATOR SERVICE ==============

export class DataAggregatorService {
  private entityCache: Map<string, Entity> = new Map();
  private edgeCache: Map<string, DependencyEdge[]> = new Map();

  constructor(
    private fetchEntity: (entityId: string) => Promise<Entity | null>,
    private fetchOutgoingEdges: (entityId: string) => Promise<DependencyEdge[]>
  ) {}

  // ============== GRAPH BUILDING ==============

  /**
   * Build complete dependency graph starting from a root entity
   * Uses BFS to traverse all dependencies up to maxDepth
   */
  async buildDependencyGraph(
    rootEntityId: string,
    maxDepth: number = MAX_TRAVERSAL_DEPTH
  ): Promise<GraphBuildResult> {
    const entities = new Map<string, Entity>();
    const edges: DependencyEdge[] = [];
    const visited = new Set<string>();
    const warnings: string[] = [];

    // BFS queue: [entityId, depth, pathFromRoot]
    const queue: TraversalNode[] = [
      {
        entityId: rootEntityId,
        depth: 0,
        path: [rootEntityId],
        cumulativeWeight: 1,
      },
    ];

    while (queue.length > 0) {
      const node = queue.shift()!;
      const { entityId, depth, path, cumulativeWeight } = node;

      // Skip if already visited or max depth reached
      if (visited.has(entityId)) {
        // Cycle detection
        if (path.slice(0, -1).includes(entityId)) {
          warnings.push(`Cycle detected: ${path.join(' -> ')}`);
        }
        continue;
      }

      if (depth > maxDepth) {
        warnings.push(`Max depth reached for path: ${path.join(' -> ')}`);
        continue;
      }

      visited.add(entityId);

      // Fetch entity
      const entity = await this.getEntity(entityId);
      if (!entity) {
        warnings.push(`Entity not found: ${entityId}`);
        continue;
      }

      entities.set(entityId, entity);

      // Get dependencies
      const dependencies = await this.getEntityDependencies(entity);

      for (const dep of dependencies) {
        // Add edge to collection (avoid duplicates)
        if (!edges.some((e) => e.id === dep.edge.id)) {
          edges.push(dep.edge);
        }

        // Add to queue for traversal
        queue.push({
          entityId: dep.targetEntityId,
          depth: depth + 1,
          path: [...path, dep.targetEntityId],
          cumulativeWeight: cumulativeWeight * dep.edge.weight,
        });
      }
    }

    const graph: DependencyGraph = {
      entities,
      edges,
      rootEntityId,
    };

    // Calculate N-order exposures
    const exposures = this.calculateNOrderExposures(graph);

    return { graph, exposures, warnings };
  }

  /**
   * Get or fetch an entity with caching
   */
  private async getEntity(entityId: string): Promise<Entity | null> {
    if (this.entityCache.has(entityId)) {
      return this.entityCache.get(entityId)!;
    }

    const entity = await this.fetchEntity(entityId);
    if (entity) {
      this.entityCache.set(entityId, entity);
    }
    return entity;
  }

  /**
   * Get dependencies for an entity based on its type
   */
  private async getEntityDependencies(
    entity: Entity
  ): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    // First, check for explicitly stored edges
    const storedEdges = await this.getStoredEdges(entity.id);
    for (const edge of storedEdges) {
      dependencies.push({
        edge,
        targetEntityId: edge.targetId,
      });
    }

    // Then, derive implicit dependencies based on entity type
    const implicitDeps = this.deriveImplicitDependencies(entity);
    for (const dep of implicitDeps) {
      // Avoid duplicates
      if (!dependencies.some((d) => d.edge.id === dep.edge.id)) {
        dependencies.push(dep);
      }
    }

    return dependencies;
  }

  /**
   * Get stored edges from database/cache
   */
  private async getStoredEdges(entityId: string): Promise<DependencyEdge[]> {
    if (this.edgeCache.has(entityId)) {
      return this.edgeCache.get(entityId)!;
    }

    const edges = await this.fetchOutgoingEdges(entityId);
    this.edgeCache.set(entityId, edges);
    return edges;
  }

  /**
   * Derive implicit dependencies based on entity structure
   */
  private deriveImplicitDependencies(entity: Entity): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];

    if (isVaultEntity(entity)) {
      dependencies.push(...this.deriveVaultDependencies(entity));
    } else if (isProtocolEntity(entity)) {
      dependencies.push(...this.deriveProtocolDependencies(entity));
    } else if (isTokenEntity(entity)) {
      dependencies.push(...this.deriveTokenDependencies(entity));
    }

    return dependencies;
  }

  /**
   * Derive vault dependencies
   */
  private deriveVaultDependencies(vault: VaultEntity): DependencyInfo[] {
    const deps: DependencyInfo[] = [];

    // Operator (protocol) dependency
    deps.push({
      edge: {
        id: `${vault.id}->operator:${vault.operatorId}`,
        sourceId: vault.id,
        targetId: vault.operatorId,
        type: DependencyType.STRATEGY_ALLOCATION,
        weight: 1,
        metadata: { description: 'Vault operator' },
      },
      targetEntityId: vault.operatorId,
    });

    // Underlying asset dependency
    const tokenId = `token:${vault.underlying.symbol}:${vault.chain}`;
    deps.push({
      edge: {
        id: `${vault.id}->underlying:${tokenId}`,
        sourceId: vault.id,
        targetId: tokenId,
        type: DependencyType.UNDERLYING_ASSET,
        weight: 1,
        metadata: {
          symbol: vault.underlying.symbol,
          address: vault.underlying.address,
        },
      },
      targetEntityId: tokenId,
    });

    // Strategy dependencies
    for (const strategy of vault.strategies) {
      if (!strategy.isActive) continue;

      // Strategy -> Protocol
      deps.push({
        edge: {
          id: `${vault.id}->strategy:${strategy.targetProtocolId}`,
          sourceId: vault.id,
          targetId: strategy.targetProtocolId,
          type: DependencyType.STRATEGY_ALLOCATION,
          weight: strategy.allocation / 100,
          metadata: {
            strategyName: strategy.name,
            allocationPercentage: strategy.allocation,
          },
        },
        targetEntityId: strategy.targetProtocolId,
      });

      // Nested vault dependency
      if (strategy.targetVaultId) {
        deps.push({
          edge: {
            id: `${vault.id}->nested:${strategy.targetVaultId}`,
            sourceId: vault.id,
            targetId: strategy.targetVaultId,
            type: DependencyType.NESTED_VAULT,
            weight: strategy.allocation / 100,
            metadata: {
              strategyName: strategy.name,
              allocationPercentage: strategy.allocation,
            },
          },
          targetEntityId: strategy.targetVaultId,
        });
      }
    }

    // Chain dependency
    if (vault.chain) {
      deps.push({
        edge: {
          id: `${vault.id}->chain:${vault.chain}`,
          sourceId: vault.id,
          targetId: `chain:${vault.chain}`,
          type: DependencyType.LIVES_ON,
          weight: 1,
          metadata: {},
        },
        targetEntityId: `chain:${vault.chain}`,
      });
    }

    return deps;
  }

  /**
   * Derive protocol dependencies
   */
  private deriveProtocolDependencies(protocol: ProtocolEntity): DependencyInfo[] {
    const deps: DependencyInfo[] = [];

    // Oracle dependency
    if (protocol.oracle) {
      deps.push({
        edge: {
          id: `${protocol.id}->oracle:${protocol.oracle.providerId}`,
          sourceId: protocol.id,
          targetId: protocol.oracle.providerId,
          type: DependencyType.ORACLE_DEPENDENCY,
          weight: 1,
          metadata: {
            oracleType: protocol.oracle.type,
            priceFeeds: protocol.oracle.priceFeeds.map((f) => f.pair),
          },
        },
        targetEntityId: protocol.oracle.providerId,
      });
    }

    // Governance dependency
    const govId = `governance:${protocol.id}`;
    deps.push({
      edge: {
        id: `${protocol.id}->governance:${govId}`,
        sourceId: protocol.id,
        targetId: govId,
        type: DependencyType.GOVERNANCE_CONTROL,
        weight: 1,
        metadata: {
          governanceType: protocol.governance.type,
          timelockDuration: protocol.governance.timelockDuration,
          multisigThreshold: protocol.governance.multisigThreshold,
        },
      },
      targetEntityId: govId,
    });

    // Fork dependency
    if (protocol.forkedFrom) {
      deps.push({
        edge: {
          id: `${protocol.id}->fork:${protocol.forkedFrom}`,
          sourceId: protocol.id,
          targetId: protocol.forkedFrom,
          type: DependencyType.FORK_OF,
          weight: 0.5, // Shared code base carries partial risk
          metadata: {},
        },
        targetEntityId: protocol.forkedFrom,
      });
    }

    return deps;
  }

  /**
   * Derive token dependencies
   */
  private deriveTokenDependencies(token: TokenEntity): DependencyInfo[] {
    const deps: DependencyInfo[] = [];

    // Issuer dependency (for stablecoins and centralized tokens)
    if (token.issuerId) {
      deps.push({
        edge: {
          id: `${token.id}->issuer:${token.issuerId}`,
          sourceId: token.id,
          targetId: token.issuerId,
          type: DependencyType.TOKEN_ISSUER,
          weight: 1,
          metadata: {
            tokenType: token.tokenType,
            peggedTo: token.peggedTo,
          },
        },
        targetEntityId: token.issuerId,
      });
    }

    // Collateral dependencies
    if (token.collateral && token.collateral.length > 0) {
      for (const collateralId of token.collateral) {
        deps.push({
          edge: {
            id: `${token.id}->collateral:${collateralId}`,
            sourceId: token.id,
            targetId: collateralId,
            type: DependencyType.COLLATERALIZED_BY,
            weight: 1 / token.collateral.length, // Evenly distributed
            metadata: {},
          },
          targetEntityId: collateralId,
        });
      }
    }

    return deps;
  }

  // ============== N-ORDER EXPOSURES ==============

  /**
   * Calculate N-order exposures using capital propagation
   * Inspired by Dialectic's Nebula approach
   */
  calculateNOrderExposures(graph: DependencyGraph): NOrderExposure[] {
    const exposures = new Map<string, NOrderExposure>();

    // Find all paths from root to each entity
    const allPaths = this.findAllPaths(graph);

    for (const [targetId, paths] of allPaths) {
      const entity = graph.entities.get(targetId);
      if (!entity) continue;

      // Calculate total USD exposure through all paths
      const totalWeight = paths.reduce((sum, p) => sum + p.cumulativeWeight, 0);

      // Determine exposure type
      let exposureType: NOrderExposure['exposureType'];
      switch (entity.type) {
        case EntityType.TOKEN:
          exposureType = 'asset';
          break;
        case EntityType.PROTOCOL:
        case EntityType.VAULT:
          exposureType = 'protocol';
          break;
        case EntityType.ORACLE:
          exposureType = 'oracle';
          break;
        case EntityType.GOVERNANCE:
          exposureType = 'governance';
          break;
        case EntityType.ISSUER:
          exposureType = 'issuer';
          break;
        default:
          exposureType = 'protocol';
      }

      exposures.set(targetId, {
        entityId: targetId,
        exposureType,
        usdExposure: 0, // Will be populated with actual TVL later
        percentage: totalWeight * 100,
        paths,
        riskLevel: scoreToRiskLevel(50), // Placeholder
      });
    }

    return Array.from(exposures.values());
  }

  /**
   * Find all paths from root to each entity
   */
  private findAllPaths(graph: DependencyGraph): Map<string, ExposurePath[]> {
    const allPaths = new Map<string, ExposurePath[]>();
    const visited = new Set<string>();

    const dfs = (
      entityId: string,
      currentPath: string[],
      currentEdges: DependencyEdge[],
      cumulativeWeight: number
    ) => {
      // Add current path to results
      if (entityId !== graph.rootEntityId) {
        const existing = allPaths.get(entityId) ?? [];
        existing.push({
          nodeIds: [...currentPath],
          edges: [...currentEdges],
          targetId: entityId,
          cumulativeWeight,
          depth: currentPath.length - 1,
        });
        allPaths.set(entityId, existing);
      }

      // Prevent infinite loops
      if (visited.has(entityId)) return;
      visited.add(entityId);

      // Find outgoing edges
      const outgoingEdges = graph.edges.filter((e) => e.sourceId === entityId);

      for (const edge of outgoingEdges) {
        dfs(
          edge.targetId,
          [...currentPath, edge.targetId],
          [...currentEdges, edge],
          cumulativeWeight * edge.weight
        );
      }

      visited.delete(entityId); // Allow revisiting via different paths
    };

    dfs(graph.rootEntityId, [graph.rootEntityId], [], 1);

    return allPaths;
  }

  // ============== CAPITAL PROPAGATION ==============

  /**
   * Propagate USD exposure values through the graph
   */
  propagateCapital(
    graph: DependencyGraph,
    rootUsdValue: number
  ): Map<string, number> {
    const exposures = new Map<string, number>();
    exposures.set(graph.rootEntityId, rootUsdValue);

    // BFS propagation
    const queue: string[] = [graph.rootEntityId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const entityId = queue.shift()!;
      if (visited.has(entityId)) continue;
      visited.add(entityId);

      const entityExposure = exposures.get(entityId) ?? 0;
      const outgoingEdges = graph.edges.filter((e) => e.sourceId === entityId);

      for (const edge of outgoingEdges) {
        const targetExposure = exposures.get(edge.targetId) ?? 0;
        exposures.set(
          edge.targetId,
          targetExposure + entityExposure * edge.weight
        );
        queue.push(edge.targetId);
      }
    }

    return exposures;
  }

  // ============== CONTAGION ANALYSIS ==============

  /**
   * Find all entities affected if a specific entity is compromised
   * (Reverse dependency traversal)
   */
  findAffectedByCompromise(
    graph: DependencyGraph,
    compromisedEntityId: string
  ): Set<string> {
    const affected = new Set<string>();
    const queue: string[] = [compromisedEntityId];

    while (queue.length > 0) {
      const entityId = queue.shift()!;
      if (affected.has(entityId)) continue;
      affected.add(entityId);

      // Find all entities that depend on this one (reverse edges)
      const incomingEdges = graph.edges.filter((e) => e.targetId === entityId);
      for (const edge of incomingEdges) {
        queue.push(edge.sourceId);
      }
    }

    return affected;
  }

  /**
   * Find concentration risk - entities that many others depend on
   */
  findConcentrationRisk(
    graph: DependencyGraph
  ): Array<{ entityId: string; dependentCount: number; types: Set<DependencyType> }> {
    const dependencyCounts = new Map<
      string,
      { count: number; types: Set<DependencyType> }
    >();

    for (const edge of graph.edges) {
      const existing = dependencyCounts.get(edge.targetId) ?? {
        count: 0,
        types: new Set(),
      };
      existing.count += 1;
      existing.types.add(edge.type);
      dependencyCounts.set(edge.targetId, existing);
    }

    return Array.from(dependencyCounts.entries())
      .map(([entityId, data]) => ({
        entityId,
        dependentCount: data.count,
        types: data.types,
      }))
      .sort((a, b) => b.dependentCount - a.dependentCount);
  }

  // ============== CACHE MANAGEMENT ==============

  clearCache(): void {
    this.entityCache.clear();
    this.edgeCache.clear();
  }

  preloadEntities(entities: Entity[]): void {
    for (const entity of entities) {
      this.entityCache.set(entity.id, entity);
    }
  }

  preloadEdges(entityId: string, edges: DependencyEdge[]): void {
    this.edgeCache.set(entityId, edges);
  }
}

// ============== FACTORY ==============

export function createDataAggregator(
  fetchEntity: (entityId: string) => Promise<Entity | null>,
  fetchOutgoingEdges: (entityId: string) => Promise<DependencyEdge[]>
): DataAggregatorService {
  return new DataAggregatorService(fetchEntity, fetchOutgoingEdges);
}
