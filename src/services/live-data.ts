// Live data fetching service
// Connects to DeFiLlama, on-chain sources, and other APIs for real-time vault data

import { defiLlamaClient, type DefiLlamaProtocolDetail } from './data-sources/defillama';
import { onChainService, type VaultOnChainData, type StrategyAllocation } from './data-sources/onchain';
import { fetchVaultAllocationsWithCache, type VaultAllocations } from './data-sources/protocol-apis';
import { type Address } from 'viem';
import {
  TRACKED_VAULTS,
  TRACKED_PROTOCOLS,
  TRACKED_TOKENS,
  TRACKED_ISSUERS,
  getProtocolBySlug,
  getTokenById,
  getIssuerById,
  type TrackedVault,
  type TrackedProtocol,
} from '@/lib/vault-registry';
import {
  Entity,
  EntityType,
  VaultEntity,
  ProtocolEntity,
  TokenEntity,
  IssuerEntity,
  OracleEntity,
  DependencyEdge,
  DependencyType,
  DependencyGraph,
  RiskAssessment,
  Chain,
  GovernanceType,
  GovernanceInfo,
  OracleType,
  ProtocolCategory,
  AuditInfo,
} from '@/types/core';
import { riskCalculator } from './risk-calculator';

// Cache for API responses
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

// ============== LIVE DATA FETCHING ==============

export interface OnChainVaultData {
  totalAssets: string;
  totalAssetsUsd: number;
  totalSupply: string;
  pricePerShare: string;
  strategies?: StrategyAllocation[];
  dataSource: 'onchain';
  timestamp: Date;
}

export interface LiveVaultData {
  tvl: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  onChain?: OnChainVaultData;
  dataSource: 'defillama' | 'onchain' | 'combined';
}

export interface LiveProtocolData {
  tvl: number;
  chains: string[];
  audits: string[];
  category: string;
}

// ============== ON-CHAIN DATA FETCHING ==============

// Token prices for converting on-chain amounts to USD
const TOKEN_PRICES: Record<string, number> = {
  'USDC': 1,
  'USDT': 1,
  'DAI': 1,
  'FRAX': 1,
  'WETH': 3200, // Will be updated dynamically
  'ETH': 3200,
  'stETH': 3200,
  'wstETH': 3700,
  'BTC': 100000, // Will be updated dynamically
  'WBTC': 100000,
  'cbBTC': 100000,
};

async function updateTokenPrices(): Promise<void> {
  try {
    const prices = await defiLlamaClient.getTokenPrices([
      { chain: 'ethereum', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' }, // WETH
      { chain: 'ethereum', address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' }, // stETH
      { chain: 'ethereum', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' }, // WBTC
    ]);

    const wethPrice = prices.get('ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
    if (wethPrice) {
      TOKEN_PRICES['WETH'] = wethPrice;
      TOKEN_PRICES['ETH'] = wethPrice;
      TOKEN_PRICES['stETH'] = wethPrice;
      TOKEN_PRICES['wstETH'] = wethPrice * 1.15; // Approximate wstETH premium
    }

    const wbtcPrice = prices.get('ethereum:0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599');
    if (wbtcPrice) {
      TOKEN_PRICES['BTC'] = wbtcPrice;
      TOKEN_PRICES['WBTC'] = wbtcPrice;
      TOKEN_PRICES['cbBTC'] = wbtcPrice;
    }
  } catch (error) {
    console.warn('Failed to update token prices, using defaults');
  }
}

export async function fetchOnChainVaultData(
  vault: TrackedVault
): Promise<OnChainVaultData | null> {
  if (!vault.address) {
    return null;
  }

  const cacheKey = `onchain:${vault.id}`;
  const cached = getCached<OnChainVaultData>(cacheKey);
  if (cached) return cached;

  try {
    console.log(`[OnChain] Fetching data for ${vault.name} at ${vault.address}`);

    // Try ERC-4626 first
    try {
      const vaultData = await onChainService.getERC4626VaultData(
        vault.chain,
        vault.address as Address
      );

      // Fetch decimals from the actual vault asset token
      let decimals = 18;
      try {
        const assetTokenData = await onChainService.getTokenData(vault.chain, vaultData.asset);
        decimals = assetTokenData.decimals;
        console.log(`[OnChain] ${vault.name} asset ${vaultData.asset} has ${decimals} decimals`);
      } catch {
        decimals = vault.underlying === 'USDC' || vault.underlying === 'USDT' ? 6 : 18;
        console.log(`[OnChain] ${vault.name} fallback to ${decimals} decimals based on underlying ${vault.underlying}`);
      }

      const totalAssetsNum = Number(vaultData.totalAssets) / Math.pow(10, decimals);
      const tokenPrice = TOKEN_PRICES[vault.underlying] || 1;
      const totalAssetsUsd = totalAssetsNum * tokenPrice;

      // Try to get strategy allocations for Yearn vaults
      let strategies: StrategyAllocation[] | undefined;
      if (vault.protocolSlug === 'yearn-finance') {
        try {
          strategies = await onChainService.getYearnV3VaultStrategies(
            vault.chain,
            vault.address as Address
          );
        } catch {
          // Not a Yearn V3 vault
        }
      }

      const data: OnChainVaultData = {
        totalAssets: vaultData.totalAssets.toString(),
        totalAssetsUsd,
        totalSupply: vaultData.totalSupply.toString(),
        pricePerShare: vaultData.pricePerShare.toString(),
        strategies,
        dataSource: 'onchain',
        timestamp: new Date(),
      };

      setCache(cacheKey, data);
      return data;
    } catch (erc4626Error) {
      // Not an ERC-4626 vault - try fetching as plain ERC-20 token (for rebasing stablecoins like reUSD)
      console.log(`[OnChain] ${vault.name} is not ERC-4626, trying ERC-20 totalSupply`);

      try {
        const tokenData = await onChainService.getTokenData(
          vault.chain,
          vault.address as Address
        );

        const totalSupplyNum = Number(tokenData.totalSupply) / Math.pow(10, tokenData.decimals);
        // For stablecoins, assume $1 price; for others use token price
        const tokenPrice = TOKEN_PRICES[vault.underlying] || TOKEN_PRICES[tokenData.symbol] || 1;
        const totalAssetsUsd = totalSupplyNum * tokenPrice;

        console.log(`[OnChain] ${vault.name} totalSupply: ${totalSupplyNum.toLocaleString()} (${tokenData.symbol}), TVL: $${totalAssetsUsd.toLocaleString()}`);

        const data: OnChainVaultData = {
          totalAssets: tokenData.totalSupply.toString(),
          totalAssetsUsd,
          totalSupply: tokenData.totalSupply.toString(),
          pricePerShare: (1e18).toString(), // 1:1 for rebasing tokens
          dataSource: 'onchain',
          timestamp: new Date(),
        };

        setCache(cacheKey, data);
        return data;
      } catch (erc20Error) {
        console.warn(`[OnChain] Failed to fetch ERC-20 data for ${vault.name}:`, erc20Error);
        throw erc4626Error; // Re-throw original error
      }
    }
  } catch (error) {
    console.warn(`[OnChain] Failed to fetch data for ${vault.name}:`, error);
    return null;
  }
}

export async function fetchLiveVaultData(vault: TrackedVault): Promise<LiveVaultData | null> {
  const cacheKey = `vault:${vault.id}`;
  const cached = getCached<LiveVaultData>(cacheKey);
  if (cached) return cached;

  try {
    // Update token prices for accurate USD conversion
    await updateTokenPrices();

    // Fetch both DeFiLlama and on-chain data in parallel
    const [defiLlamaData, onChainData] = await Promise.all([
      (async () => {
        try {
          const pools = await defiLlamaClient.getYieldPoolsByProject(vault.protocolSlug);
          return pools.find(p =>
            p.symbol.toUpperCase().includes(vault.underlying.toUpperCase()) &&
            p.chain.toLowerCase() === vault.chain.toLowerCase()
          );
        } catch {
          return null;
        }
      })(),
      fetchOnChainVaultData(vault),
    ]);

    // Combine data sources - prefer on-chain TVL if available
    if (defiLlamaData) {
      const data: LiveVaultData = {
        tvl: onChainData?.totalAssetsUsd || defiLlamaData.tvl,
        apy: defiLlamaData.apy,
        apyBase: defiLlamaData.apyBase,
        apyReward: defiLlamaData.apyReward,
        onChain: onChainData || undefined,
        dataSource: onChainData ? 'combined' : 'defillama',
      };
      setCache(cacheKey, data);
      return data;
    }

    // If we have on-chain data but no DeFiLlama data
    if (onChainData) {
      const data: LiveVaultData = {
        tvl: onChainData.totalAssetsUsd,
        apy: null,
        apyBase: null,
        apyReward: null,
        onChain: onChainData,
        dataSource: 'onchain',
      };
      setCache(cacheKey, data);
      return data;
    }

    // Fallback: try to get protocol TVL
    const protocol = await defiLlamaClient.getProtocol(vault.protocolSlug);
    if (protocol && protocol.tvl && protocol.tvl.length > 0) {
      const latestTvl = protocol.tvl[protocol.tvl.length - 1].totalLiquidityUSD;
      const data: LiveVaultData = {
        tvl: latestTvl / 10, // Estimate single vault TVL as fraction
        apy: null,
        apyBase: null,
        apyReward: null,
        dataSource: 'defillama',
      };
      setCache(cacheKey, data);
      return data;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching live data for vault ${vault.id}:`, error);
    return null;
  }
}

export async function fetchLiveProtocolData(protocolSlug: string): Promise<LiveProtocolData | null> {
  const cacheKey = `protocol:${protocolSlug}`;
  const cached = getCached<LiveProtocolData>(cacheKey);
  if (cached) return cached;

  try {
    const protocol = await defiLlamaClient.getProtocol(protocolSlug);
    if (!protocol) return null;

    const tvl = protocol.tvl && protocol.tvl.length > 0
      ? protocol.tvl[protocol.tvl.length - 1].totalLiquidityUSD
      : 0;

    const data: LiveProtocolData = {
      tvl,
      chains: protocol.chains ?? [],
      audits: protocol.audit_links ?? [],
      category: protocol.category ?? 'Unknown',
    };
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`Error fetching live data for protocol ${protocolSlug}:`, error);
    return null;
  }
}

// ============== GRAPH BUILDING WITH LIVE DATA ==============

export async function buildLiveVaultGraph(vaultId: string): Promise<{
  graph: DependencyGraph;
  assessments: Map<string, RiskAssessment>;
  exposures: Map<string, number>;
} | null> {
  // Find vault in registry
  const trackedVault = TRACKED_VAULTS.find(v => v.id === vaultId);

  if (!trackedVault) {
    // Try to parse vault ID and create dynamic entry
    return buildDynamicVaultGraph(vaultId);
  }

  const entities = new Map<string, Entity>();
  const edges: DependencyEdge[] = [];

  // Fetch live data for the vault
  const liveVaultData = await fetchLiveVaultData(trackedVault);

  // Create vault entity
  const vaultEntity = await createVaultEntity(trackedVault, liveVaultData);
  entities.set(vaultId, vaultEntity);

  // Get operator protocol
  const operatorProtocol = getProtocolBySlug(trackedVault.protocolSlug);
  if (operatorProtocol) {
    const liveProtocolData = await fetchLiveProtocolData(operatorProtocol.slug);
    const protocolEntity = await createProtocolEntity(operatorProtocol, liveProtocolData);
    entities.set(operatorProtocol.id, protocolEntity);

    // Add vault -> operator edge
    edges.push({
      id: `${vaultId}->operator:${operatorProtocol.id}`,
      sourceId: vaultId,
      targetId: operatorProtocol.id,
      type: DependencyType.STRATEGY_ALLOCATION,
      weight: 1,
      metadata: { description: 'Vault operator' },
    });

    // Add oracle dependency if protocol uses one
    if (operatorProtocol.oracle) {
      const oracleId = `oracle:${operatorProtocol.oracle.provider.toLowerCase()}`;
      const oracleEntity = createOracleEntity(oracleId, operatorProtocol.oracle.provider, operatorProtocol.oracle.type);
      entities.set(oracleId, oracleEntity);

      edges.push({
        id: `${operatorProtocol.id}->oracle:${oracleId}`,
        sourceId: operatorProtocol.id,
        targetId: oracleId,
        type: DependencyType.ORACLE_DEPENDENCY,
        weight: 1,
        metadata: {},
      });
    }
  }

  // Get underlying token
  const tokenId = `token:${trackedVault.underlying}:${trackedVault.chain}`;
  const trackedToken = getTokenById(tokenId);
  if (trackedToken) {
    const tokenEntity = createTokenEntity(trackedToken);
    entities.set(tokenId, tokenEntity);

    // Add vault -> underlying edge
    edges.push({
      id: `${vaultId}->underlying:${tokenId}`,
      sourceId: vaultId,
      targetId: tokenId,
      type: DependencyType.UNDERLYING_ASSET,
      weight: 1,
      metadata: {},
    });

    // Add token -> issuer edge if applicable
    if (trackedToken.issuer) {
      const issuer = getIssuerById(trackedToken.issuer);
      if (issuer) {
        const issuerEntity = createIssuerEntity(issuer);
        entities.set(issuer.id, issuerEntity);

        edges.push({
          id: `${tokenId}->issuer:${issuer.id}`,
          sourceId: tokenId,
          targetId: issuer.id,
          type: DependencyType.TOKEN_ISSUER,
          weight: 1,
          metadata: {},
        });
      } else if (trackedToken.issuer.startsWith('protocol:')) {
        // Token issued by a protocol (e.g., stETH by Lido)
        const protocolSlug = trackedToken.issuer.replace('protocol:', '');
        const protocol = getProtocolBySlug(protocolSlug);
        if (protocol) {
          const liveData = await fetchLiveProtocolData(protocol.slug);
          const protocolEntity = await createProtocolEntity(protocol, liveData);
          if (!entities.has(protocol.id)) {
            entities.set(protocol.id, protocolEntity);
          }

          edges.push({
            id: `${tokenId}->issuer:${protocol.id}`,
            sourceId: tokenId,
            targetId: protocol.id,
            type: DependencyType.TOKEN_ISSUER,
            weight: 1,
            metadata: {},
          });
        }
      }
    }
  }

  // Add strategy dependencies - try real API data first, then fall back to configured/estimated
  let allocationSource: 'api' | 'configured' | 'estimated' = 'estimated';
  let strategyAllocations: Array<{ protocol: string; allocation: number; market?: string }> = [];

  // 1. Try to fetch real allocations from protocol-specific APIs
  if (trackedVault.address) {
    const apiAllocations = await fetchVaultAllocationsWithCache(
      trackedVault.address,
      trackedVault.protocolSlug,
      trackedVault.chain
    );

    if (apiAllocations && apiAllocations.allocations.length > 0) {
      allocationSource = 'api';

      // Aggregate allocations by protocol (e.g., Morpho markets are all one protocol)
      const protocolTotals = new Map<string, { allocation: number; markets: string[] }>();
      for (const a of apiAllocations.allocations) {
        const existing = protocolTotals.get(a.protocol) || { allocation: 0, markets: [] };
        existing.allocation += a.allocationPct;
        if (a.market) existing.markets.push(`${a.market}: ${a.allocationPct.toFixed(1)}%`);
        protocolTotals.set(a.protocol, existing);
      }

      strategyAllocations = Array.from(protocolTotals.entries()).map(([protocol, data]) => ({
        protocol,
        allocation: data.allocation,
        market: data.markets.length > 0 ? data.markets.join(', ') : undefined,
      }));

      console.log(`[Allocations] ${trackedVault.name}: Using real API data - ${apiAllocations.allocations.map(a => `${a.market || a.protocol}: ${a.allocationPct.toFixed(1)}%`).join(', ')}`);
    }
  }

  // 2. Fall back to manually configured allocations
  if (strategyAllocations.length === 0 && trackedVault.strategyAllocations) {
    allocationSource = 'configured';
    strategyAllocations = trackedVault.strategyAllocations.map(sa => ({
      protocol: sa.protocol,
      allocation: sa.allocation,
    }));
    console.log(`[Allocations] ${trackedVault.name}: Using configured allocations`);
  }

  // 3. Fall back to equal distribution
  if (strategyAllocations.length === 0 && trackedVault.strategies) {
    allocationSource = 'estimated';
    const equalPct = 100 / trackedVault.strategies.length;
    strategyAllocations = trackedVault.strategies.map(s => ({
      protocol: s,
      allocation: equalPct,
    }));
    console.log(`[Allocations] ${trackedVault.name}: Using estimated equal distribution`);
  }

  // Add strategy entities and edges
  for (const { protocol: strategySlug, allocation, market } of strategyAllocations) {
    const protocol = getProtocolBySlug(strategySlug);
    if (protocol) {
      // Create entity if it doesn't exist
      if (!entities.has(protocol.id)) {
        const liveData = await fetchLiveProtocolData(protocol.slug);
        const protocolEntity = await createProtocolEntity(protocol, liveData);
        entities.set(protocol.id, protocolEntity);
      }

      // Check if we already have an edge to this protocol (e.g., as operator)
      const existingEdgeIdx = edges.findIndex(
        e => e.sourceId === vaultId && e.targetId === protocol.id
      );

      if (existingEdgeIdx >= 0) {
        // Update existing edge with allocation data
        edges[existingEdgeIdx] = {
          ...edges[existingEdgeIdx],
          weight: allocation / 100,
          metadata: {
            ...edges[existingEdgeIdx].metadata,
            strategyName: market || protocol.name,
            allocationPercent: allocation,
            allocationSource,
          },
        };
      } else {
        // Create new edge
        edges.push({
          id: `${vaultId}->strategy:${protocol.id}`,
          sourceId: vaultId,
          targetId: protocol.id,
          type: DependencyType.STRATEGY_ALLOCATION,
          weight: allocation / 100,
          metadata: {
            strategyName: market || protocol.name,
            allocationPercent: allocation,
            allocationSource,
          },
        });
      }

      // Add oracle for strategy protocol
      if (protocol.oracle) {
        const oracleId = `oracle:${protocol.oracle.provider.toLowerCase()}`;
        if (!entities.has(oracleId)) {
          const oracleEntity = createOracleEntity(oracleId, protocol.oracle.provider, protocol.oracle.type);
          entities.set(oracleId, oracleEntity);
        }

        // Check if oracle edge already exists
        const oracleEdgeExists = edges.some(
          e => e.sourceId === protocol.id && e.targetId === oracleId
        );
        if (!oracleEdgeExists) {
          edges.push({
            id: `${protocol.id}->oracle:${oracleId}`,
            sourceId: protocol.id,
            targetId: oracleId,
            type: DependencyType.ORACLE_DEPENDENCY,
            weight: 1,
            metadata: {},
          });
        }
      }

      // Add nested protocol allocations (e.g., Cap → BUIDL/PYUSD/BENJI)
      if (protocol.strategyAllocations) {
        for (const nestedAlloc of protocol.strategyAllocations) {
          const nestedProtocol = getProtocolBySlug(nestedAlloc.protocol);
          if (nestedProtocol) {
            // Create nested protocol entity if it doesn't exist
            if (!entities.has(nestedProtocol.id)) {
              const nestedLiveData = await fetchLiveProtocolData(nestedProtocol.slug);
              const nestedProtocolEntity = await createProtocolEntity(nestedProtocol, nestedLiveData);
              entities.set(nestedProtocol.id, nestedProtocolEntity);
            }

            // Add edge from parent protocol to nested protocol
            const nestedEdgeId = `${protocol.id}->nested:${nestedProtocol.id}`;
            if (!edges.some(e => e.id === nestedEdgeId)) {
              edges.push({
                id: nestedEdgeId,
                sourceId: protocol.id,
                targetId: nestedProtocol.id,
                type: DependencyType.STRATEGY_ALLOCATION,
                weight: nestedAlloc.allocation / 100,
                metadata: {
                  strategyName: nestedAlloc.asset || nestedProtocol.name,
                  allocationPercent: nestedAlloc.allocation,
                },
              });
            }

            // Add edge to the asset token if specified
            if (nestedAlloc.asset) {
              const assetTokenId = `token:${nestedAlloc.asset}:${trackedVault.chain}`;
              const assetToken = getTokenById(assetTokenId);
              if (assetToken && !entities.has(assetTokenId)) {
                const tokenEntity = createTokenEntity(assetToken);
                entities.set(assetTokenId, tokenEntity);

                // Add token issuer if applicable
                if (assetToken.issuer) {
                  const issuer = getIssuerById(assetToken.issuer);
                  if (issuer && !entities.has(issuer.id)) {
                    const issuerEntity = createIssuerEntity(issuer);
                    entities.set(issuer.id, issuerEntity);

                    edges.push({
                      id: `${assetTokenId}->issuer:${issuer.id}`,
                      sourceId: assetTokenId,
                      targetId: issuer.id,
                      type: DependencyType.TOKEN_ISSUER,
                      weight: 1,
                      metadata: {},
                    });
                  }
                }
              }

              // Add edge from nested protocol to asset token
              const assetEdgeId = `${nestedProtocol.id}->asset:${assetTokenId}`;
              if (!edges.some(e => e.id === assetEdgeId)) {
                edges.push({
                  id: assetEdgeId,
                  sourceId: nestedProtocol.id,
                  targetId: assetTokenId,
                  type: DependencyType.UNDERLYING_ASSET,
                  weight: 1,
                  metadata: {},
                });
              }
            }
          }
        }
      }
    }
  }

  const graph: DependencyGraph = {
    entities,
    edges,
    rootEntityId: vaultId,
  };

  // Calculate USD exposure for each entity based on allocation weights
  const exposures = calculateExposures(graph, liveVaultData?.tvl ?? 0);

  // Calculate risk assessments
  const assessments = await riskCalculator.calculateGraphRisks(graph);

  return { graph, assessments, exposures };
}

// ============== EXPOSURE CALCULATION ==============

/**
 * Calculate USD exposure for each entity in the graph using BFS traversal.
 * Propagates exposure from root vault through edges based on allocation weights.
 */
function calculateExposures(
  graph: DependencyGraph,
  rootTvl: number
): Map<string, number> {
  const exposures = new Map<string, number>();

  if (rootTvl <= 0) return exposures;

  // Build adjacency list for BFS
  const adjacency = new Map<string, Array<{ targetId: string; weight: number }>>();
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.sourceId)) {
      adjacency.set(edge.sourceId, []);
    }
    adjacency.get(edge.sourceId)!.push({
      targetId: edge.targetId,
      weight: edge.weight,
    });
  }

  // BFS from root
  const queue: Array<{ entityId: string; exposure: number }> = [
    { entityId: graph.rootEntityId, exposure: rootTvl }
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { entityId, exposure } = queue.shift()!;

    // Accumulate exposure (entity may be reachable via multiple paths)
    exposures.set(entityId, (exposures.get(entityId) ?? 0) + exposure);

    if (visited.has(entityId)) continue;
    visited.add(entityId);

    // Propagate to connected entities
    const neighbors = adjacency.get(entityId) ?? [];
    for (const { targetId, weight } of neighbors) {
      const childExposure = exposure * weight;
      if (childExposure > 0) {
        queue.push({ entityId: targetId, exposure: childExposure });
      }
    }
  }

  return exposures;
}

// ============== DYNAMIC GRAPH FOR UNKNOWN VAULTS ==============

async function buildDynamicVaultGraph(vaultId: string): Promise<{
  graph: DependencyGraph;
  assessments: Map<string, RiskAssessment>;
  exposures: Map<string, number>;
} | null> {
  // Parse vault ID format: protocol:name:chain
  const parts = vaultId.split(':');
  if (parts.length < 3) return null;

  const [protocolName, vaultName, chainName] = parts;
  const chain = chainName as Chain;

  const entities = new Map<string, Entity>();
  const edges: DependencyEdge[] = [];

  // Try to fetch protocol data from DeFiLlama
  const liveProtocolData = await fetchLiveProtocolData(protocolName);

  // Try to find matching yield pool
  const pools = await defiLlamaClient.getYieldPoolsByProject(protocolName);
  const matchingPool = pools.find(p =>
    p.symbol.toLowerCase().includes(vaultName.toLowerCase()) ||
    vaultName.toLowerCase().includes(p.symbol.toLowerCase())
  );

  // Create vault entity
  const vaultEntity: VaultEntity = {
    id: vaultId,
    name: `${protocolName.charAt(0).toUpperCase() + protocolName.slice(1)} ${vaultName}`,
    type: EntityType.VAULT,
    chain,
    metadata: {
      logo: `https://icons.llamao.fi/icons/protocols/${protocolName}`,
    },
    underlying: {
      symbol: matchingPool?.symbol.split('-')[0] ?? vaultName.toUpperCase(),
      name: matchingPool?.symbol ?? vaultName,
      address: '',
      decimals: 18,
      chain,
    },
    tvl: matchingPool?.tvl ?? liveProtocolData?.tvl ?? 0,
    apy: matchingPool?.apy ?? undefined,
    operatorId: `protocol:${protocolName}`,
    strategies: [],
    isERC4626: true,
  };
  entities.set(vaultId, vaultEntity);

  // Create protocol entity
  const protocolId = `protocol:${protocolName}`;
  const category = liveProtocolData?.category
    ? defiLlamaClient.mapCategoryToProtocolCategory(liveProtocolData.category)
    : ProtocolCategory.OTHER;

  const protocolEntity: ProtocolEntity = {
    id: protocolId,
    name: protocolName.charAt(0).toUpperCase() + protocolName.slice(1),
    type: EntityType.PROTOCOL,
    chain,
    metadata: {
      logo: `https://icons.llamao.fi/icons/protocols/${protocolName}`,
    },
    category,
    tvl: liveProtocolData?.tvl ?? 0,
    audits: liveProtocolData?.audits?.map((url, i) => ({
      id: `audit-${i}`,
      auditor: 'Unknown',
      date: new Date(),
      scope: 'Protocol',
      reportUrl: url,
      findings: { critical: 0, high: 0, medium: 0, low: 0, informational: 0, resolved: 0 },
    })) ?? [],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    incidentHistory: [],
    deployedChains: liveProtocolData?.chains?.map(c => defiLlamaClient.mapChainToEnum(c)).filter(Boolean) as Chain[] ?? [chain],
    isUpgradeable: true,
    hasTimeLock: false,
  };
  entities.set(protocolId, protocolEntity);

  // Add vault -> protocol edge
  edges.push({
    id: `${vaultId}->operator:${protocolId}`,
    sourceId: vaultId,
    targetId: protocolId,
    type: DependencyType.STRATEGY_ALLOCATION,
    weight: 1,
    metadata: { description: 'Vault operator' },
  });

  const graph: DependencyGraph = {
    entities,
    edges,
    rootEntityId: vaultId,
  };

  // Calculate USD exposure
  const vaultTvl = matchingPool?.tvl ?? liveProtocolData?.tvl ?? 0;
  const exposures = calculateExposures(graph, vaultTvl);

  // Calculate risk assessments
  const assessments = await riskCalculator.calculateGraphRisks(graph);

  return { graph, assessments, exposures };
}

// ============== ENTITY CREATION HELPERS ==============

async function createVaultEntity(
  vault: TrackedVault,
  liveData: LiveVaultData | null
): Promise<VaultEntity> {
  return {
    id: vault.id,
    name: vault.name,
    type: EntityType.VAULT,
    chain: vault.chain,
    address: vault.address,
    metadata: {
      logo: `https://icons.llamao.fi/icons/protocols/${vault.protocolSlug}`,
      curator: vault.curator,
    },
    underlying: {
      symbol: vault.underlying,
      name: vault.underlying,
      address: vault.underlyingAddress ?? '',
      // Note: decimals here represent the user-facing underlying (e.g., USDC=6)
      // For actual vault asset decimals, see fetchOnChainVaultData which queries on-chain
      decimals: vault.underlying === 'USDC' || vault.underlying === 'USDT' ? 6 : 18,
      chain: vault.chain,
    },
    tvl: liveData?.tvl ?? 0,
    apy: liveData?.apy ?? undefined,
    operatorId: `protocol:${vault.protocolSlug}`,
    strategies: vault.strategyAllocations
      ? vault.strategyAllocations.map((sa, i) => ({
          id: `strategy-${i}`,
          name: sa.protocol,
          allocation: sa.allocation,
          targetProtocolId: `protocol:${sa.protocol}`,
          isActive: true,
        }))
      : vault.strategies?.map((s, i) => ({
          id: `strategy-${i}`,
          name: s,
          allocation: 100 / (vault.strategies?.length ?? 1),
          targetProtocolId: `protocol:${s}`,
          isActive: true,
        })) ?? [],
    isERC4626: true,
  };
}

async function createProtocolEntity(
  protocol: TrackedProtocol,
  liveData: LiveProtocolData | null
): Promise<ProtocolEntity> {
  const governance: GovernanceInfo = {
    type: protocol.governance.type,
    multisigThreshold: protocol.governance.multisigThreshold,
    timelockDuration: protocol.governance.timelockHours
      ? protocol.governance.timelockHours * 3600
      : undefined,
  };

  const audits: AuditInfo[] = protocol.auditors.map((auditor, i) => ({
    id: `audit-${i}`,
    auditor,
    date: new Date(Date.now() - i * 90 * 24 * 60 * 60 * 1000), // Stagger dates
    scope: 'Full protocol',
    findings: { critical: 0, high: 0, medium: 0, low: 0, informational: 0, resolved: 0 },
  }));

  // Add audit links from live data
  if (liveData?.audits) {
    liveData.audits.forEach((url, i) => {
      if (!audits.some(a => a.reportUrl === url)) {
        audits.push({
          id: `live-audit-${i}`,
          auditor: 'See Report',
          date: new Date(),
          scope: 'Protocol',
          reportUrl: url,
          findings: { critical: 0, high: 0, medium: 0, low: 0, informational: 0, resolved: 0 },
        });
      }
    });
  }

  return {
    id: protocol.id,
    name: protocol.name,
    type: EntityType.PROTOCOL,
    metadata: {
      logo: `https://icons.llamao.fi/icons/protocols/${protocol.slug}`,
    },
    category: protocol.category,
    tvl: liveData?.tvl ?? 0,
    audits,
    governance,
    oracle: protocol.oracle ? {
      providerId: `oracle:${protocol.oracle.provider.toLowerCase()}`,
      type: protocol.oracle.type,
      priceFeeds: [],
    } : undefined,
    incidentHistory: [],
    deployedChains: protocol.chains,
    isUpgradeable: protocol.isUpgradeable,
    hasTimeLock: !!protocol.governance.timelockHours,
    forkedFrom: protocol.forkedFrom,
  };
}

function createTokenEntity(token: typeof TRACKED_TOKENS[0]): TokenEntity {
  return {
    id: token.id,
    name: token.name,
    type: EntityType.TOKEN,
    chain: token.chain,
    address: token.address,
    metadata: {
      logo: `https://icons.llamao.fi/icons/tokens/${token.symbol.toLowerCase()}`,
    },
    symbol: token.symbol,
    decimals: token.decimals,
    issuerId: token.issuer,
    tokenType: token.type,
    peggedTo: token.peggedTo,
  };
}

function createIssuerEntity(issuer: typeof TRACKED_ISSUERS[0]): IssuerEntity {
  return {
    id: issuer.id,
    name: issuer.name,
    type: EntityType.ISSUER,
    metadata: {
      logo: `https://icons.llamao.fi/icons/protocols/${issuer.name.toLowerCase()}`,
    },
    issuerType: issuer.type,
    issuedTokens: issuer.tokens,
  };
}

function createOracleEntity(id: string, name: string, oracleType: OracleType): OracleEntity {
  return {
    id,
    name,
    type: EntityType.ORACLE,
    metadata: {
      logo: `https://icons.llamao.fi/icons/protocols/${name.toLowerCase()}`,
    },
    oracleType,
    supportedFeeds: [],
    incidents: [],
  };
}

// ============== EXPORTS ==============

export async function getTrackedVaults(): Promise<Array<TrackedVault & { liveData: LiveVaultData | null }>> {
  const results = await Promise.all(
    TRACKED_VAULTS.map(async (vault) => {
      const liveData = await fetchLiveVaultData(vault);
      return { ...vault, liveData };
    })
  );
  return results;
}

export async function getTrackedProtocols(): Promise<Array<TrackedProtocol & { liveData: LiveProtocolData | null }>> {
  const results = await Promise.all(
    TRACKED_PROTOCOLS.map(async (protocol) => {
      const liveData = await fetchLiveProtocolData(protocol.slug);
      return { ...protocol, liveData };
    })
  );
  return results;
}
