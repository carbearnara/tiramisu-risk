// Protocol-specific API integrations for fetching real allocation data

import { Chain } from '@/types/core';

// ============== TYPES ==============

export interface ProtocolAllocation {
  protocol: string;       // Protocol slug
  market?: string;        // Market identifier (e.g., "cbBTC/USDC")
  collateral?: string;    // Collateral asset symbol (for lending protocols)
  allocationUsd: number;  // USD value allocated
  allocationPct: number;  // Percentage of total (0-100)
}

export interface VaultAllocations {
  vaultAddress: string;
  totalAssetsUsd: number;
  allocations: ProtocolAllocation[];
  source: 'api' | 'onchain' | 'estimated';
  timestamp: Date;
}

// ============== MORPHO API ==============

const MORPHO_API = 'https://api.morpho.org/graphql';

interface MorphoVaultResponse {
  data: {
    vaultByAddress: {
      address: string;
      name: string;
      symbol: string;
      state: {
        totalAssets: string;
        totalAssetsUsd: number;
        allocation: Array<{
          market: {
            collateralAsset: { symbol: string } | null;
            loanAsset: { symbol: string };
          };
          supplyAssets: string;
          supplyAssetsUsd: number;
        }>;
      };
    } | null;
  };
}

export async function fetchMorphoVaultAllocations(
  vaultAddress: string
): Promise<VaultAllocations | null> {
  try {
    const query = `{
      vaultByAddress(address: "${vaultAddress}") {
        address
        name
        symbol
        state {
          totalAssets
          totalAssetsUsd
          allocation {
            market {
              collateralAsset { symbol }
              loanAsset { symbol }
              oracle { address }
            }
            supplyAssets
            supplyAssetsUsd
          }
        }
      }
    }`;

    const response = await fetch(MORPHO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.warn(`[MorphoAPI] HTTP error: ${response.status}`);
      return null;
    }

    const data: MorphoVaultResponse = await response.json();
    const vault = data.data?.vaultByAddress;

    if (!vault || !vault.state) {
      return null;
    }

    const totalUsd = vault.state.totalAssetsUsd;
    const allocations: ProtocolAllocation[] = vault.state.allocation
      .filter(a => a.supplyAssetsUsd > 0)
      .map(a => {
        const collateral = a.market.collateralAsset?.symbol || 'Idle';
        const loan = a.market.loanAsset.symbol;
        const market = collateral === 'Idle' ? 'Idle' : `${collateral}/${loan}`;

        // For Morpho vaults, the protocol is always morpho
        // The market indicates the collateral type being lent against
        return {
          protocol: 'morpho', // Use 'morpho' which exists in our registry
          market,
          collateral, // Track the collateral type
          allocationUsd: a.supplyAssetsUsd,
          allocationPct: totalUsd > 0 ? (a.supplyAssetsUsd / totalUsd) * 100 : 0,
        };
      });

    return {
      vaultAddress,
      totalAssetsUsd: totalUsd,
      allocations,
      source: 'api',
      timestamp: new Date(),
    };
  } catch (error) {
    console.warn(`[MorphoAPI] Error fetching vault ${vaultAddress}:`, error);
    return null;
  }
}

// ============== YEARN API ==============

const YEARN_API = 'https://api.yexporter.io/v1/chains/1/vaults/all';
const YEARN_V3_API = 'https://ydaemon.yearn.fi/1/vaults/all';

interface YearnVaultResponse {
  address: string;
  name: string;
  symbol: string;
  tvl: { totalAssets: number; tvl: number };
  strategies: Array<{
    address: string;
    name: string;
    description?: string;
    details?: {
      totalDebt: string;
      totalDebtUSD: number;
    };
  }>;
}

export async function fetchYearnVaultAllocations(
  vaultAddress: string
): Promise<VaultAllocations | null> {
  try {
    // Try yDaemon API first (more comprehensive)
    const response = await fetch(YEARN_V3_API);
    if (!response.ok) {
      return null;
    }

    const vaults: YearnVaultResponse[] = await response.json();
    const vault = vaults.find(
      v => v.address.toLowerCase() === vaultAddress.toLowerCase()
    );

    if (!vault) {
      return null;
    }

    const totalUsd = vault.tvl?.tvl || 0;
    const allocations: ProtocolAllocation[] = [];

    for (const strategy of vault.strategies || []) {
      const debtUsd = strategy.details?.totalDebtUSD || 0;
      if (debtUsd > 0) {
        // Try to identify the underlying protocol from strategy name
        const protocol = identifyProtocolFromStrategy(strategy.name);

        allocations.push({
          protocol,
          market: strategy.name,
          allocationUsd: debtUsd,
          allocationPct: totalUsd > 0 ? (debtUsd / totalUsd) * 100 : 0,
        });
      }
    }

    return {
      vaultAddress,
      totalAssetsUsd: totalUsd,
      allocations,
      source: 'api',
      timestamp: new Date(),
    };
  } catch (error) {
    console.warn(`[YearnAPI] Error fetching vault ${vaultAddress}:`, error);
    return null;
  }
}

function identifyProtocolFromStrategy(strategyName: string): string {
  const name = strategyName.toLowerCase();

  if (name.includes('aave')) return 'aave-v3';
  if (name.includes('compound')) return 'compound-v3';
  if (name.includes('morpho')) return 'morpho';
  if (name.includes('lido') || name.includes('steth')) return 'lido';
  if (name.includes('curve')) return 'curve';
  if (name.includes('convex')) return 'convex';
  if (name.includes('maker') || name.includes('dai')) return 'maker';
  if (name.includes('uniswap')) return 'uniswap-v3';
  if (name.includes('balancer')) return 'balancer';
  if (name.includes('frax')) return 'frax';
  if (name.includes('pendle')) return 'pendle';
  if (name.includes('euler')) return 'euler';

  return 'other';
}

// ============== DEFILLAMA YIELDS API ==============

const YIELDS_API = 'https://yields.llama.fi/pools';

interface DefiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  underlyingTokens?: string[];
}

export async function fetchDefiLlamaPoolData(
  projectSlug: string,
  chain: Chain
): Promise<DefiLlamaPool[]> {
  try {
    const response = await fetch(YIELDS_API);
    if (!response.ok) return [];

    const data = await response.json();
    const pools: DefiLlamaPool[] = data.data || [];

    return pools.filter(
      p => p.project === projectSlug &&
           p.chain.toLowerCase() === chain.toLowerCase()
    );
  } catch (error) {
    console.warn(`[DefiLlamaYields] Error fetching pools:`, error);
    return [];
  }
}

// ============== UNIFIED ALLOCATION FETCHER ==============

export async function fetchVaultAllocations(
  vaultAddress: string,
  protocolSlug: string,
  chain: Chain
): Promise<VaultAllocations | null> {
  // Try protocol-specific APIs based on the vault's protocol
  switch (protocolSlug) {
    case 'morpho':
      return fetchMorphoVaultAllocations(vaultAddress);

    case 'yearn-finance':
      return fetchYearnVaultAllocations(vaultAddress);

    case 'reservoir':
      return fetchReservoirAllocations();

    case 'rexyz':
      return fetchReXyzAllocations();

    // Add more protocol-specific fetchers here

    default:
      return null;
  }
}

// ============== RESERVOIR ON-CHAIN ==============

import {
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  type Address,
} from 'viem';
import { mainnet } from 'viem/chains';

const RESERVOIR_CREDIT_ENFORCER = '0x04716DB62C085D9e08050fcF6F7D775A03d07720' as Address;
const RESERVOIR_RUSD = '0x09D4214C03D01F49544C0448DBE3A27f768F2b34' as Address;

// Reservoir Credit Enforcer ABI
const reservoirCreditEnforcerAbi = parseAbi([
  'function assets() view returns (uint256)',
  'function liabilities() view returns (uint256)',
  'function shortTermAssets() view returns (uint256)',
  'function extendedAssets() view returns (uint256)',
  'function assetRatio() view returns (uint256)',
  'function assetAdapterLength() view returns (uint256)',
  'function getAssetAdapterList(uint256 startIndex, uint256 length) view returns (address[])',
]);

// Reservoir Asset Adapter ABI (common interface)
const reservoirAdapterAbi = parseAbi([
  'function currentValue() view returns (uint256)',
  'function name() view returns (string)',
]);

// Known Reservoir adapter names to protocol mapping
const RESERVOIR_ADAPTER_PROTOCOLS: Record<string, string> = {
  'steakusdc': 'morpho',
  'euler': 'euler',
  'pendle': 'pendle',
  'aave': 'aave-v3',
  'ethena': 'ethena',
  'susde': 'ethena',
  'usdc': 'tbills', // PSM/idle funds
  'usdt': 'tbills',
};

function mapAdapterNameToProtocol(name: string): string {
  const lowerName = name.toLowerCase();
  for (const [key, protocol] of Object.entries(RESERVOIR_ADAPTER_PROTOCOLS)) {
    if (lowerName.includes(key)) {
      return protocol;
    }
  }
  return 'other';
}

export async function fetchReservoirAllocations(): Promise<VaultAllocations | null> {
  // Reservoir manages allocations through governance-controlled portfolio managers
  // The on-chain Credit Enforcer doesn't expose individual adapter allocations directly
  // Allocations are to: Steakhouse (Morpho), MEV Capital, T-bills, and other curated vaults
  // Per docs: https://docs.reservoir.xyz/protocol-architecture/asset-adapters
  //
  // Since real-time allocation data isn't available on-chain, we return null
  // to use configured allocations based on their documented strategy
  console.log('[ReservoirAPI] Allocations managed via governance, using configured allocations');
  return null;
}

// ============== RE.XYZ ON-CHAIN ==============

const REXYZ_REUSD_ICL = '0x4691C475bE804Fa85f91c2D6D0aDf03114de3093' as Address;
const REXYZ_REUSD_TOKEN = '0x5086bf358635B81D8C47C66d1C8b9E567Db70c72' as Address;
const REXYZ_SHARE_PRICE_CALC = '0xd1D104a7515989ac82F1AFDa15a23650411b05B8' as Address;
const REXYZ_CUSTODIAN = '0x295F67Fdb21255A3Db82964445628a706FBe689E' as Address;

// Re.xyz doesn't expose on-chain allocation breakdown
// They use Chainlink oracles for NAV and allocations are dynamic between:
// - Ethena sUSDe (basis trade)
// - T-bills (§114 Trust)
// The split is dynamic based on which yield source is higher

const reXyzSharePriceAbi = parseAbi([
  'function getSharePrice(address icl) view returns (uint256)',
  'function totalAssets(address icl) view returns (uint256)',
]);

const erc20Abi = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

export async function fetchReXyzAllocations(): Promise<VaultAllocations | null> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com'),
    });

    // Get total supply of reUSD
    const [totalSupply, decimals] = await Promise.all([
      client.readContract({
        address: REXYZ_REUSD_TOKEN,
        abi: erc20Abi,
        functionName: 'totalSupply',
      }),
      client.readContract({
        address: REXYZ_REUSD_TOKEN,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
    ]);

    const totalAssetsUsd = Number(formatUnits(totalSupply as bigint, decimals as number));

    if (totalAssetsUsd === 0) {
      console.warn('[ReXyzAPI] Total supply is 0');
      return null;
    }

    // Re.xyz allocations are dynamic and not exposed on-chain
    // Per docs: tracks greater of (risk-free rate + 250bps) OR (Ethena basis + 250bps)
    // Typical split based on their transparency dashboard is approximately:
    // - 60% Ethena (when basis trade is favorable)
    // - 30% T-bills (regulatory requirement)
    // - 10% Curve (liquidity)
    // These are estimates based on their documented strategy

    console.log(`[ReXyzAPI] Total reUSD supply: $${totalAssetsUsd.toLocaleString()}`);
    console.log('[ReXyzAPI] Note: Allocations are estimated based on documented strategy (dynamic Ethena/T-bills split)');

    // Return null to use configured allocations since real-time breakdown isn't available
    // The configured allocations in vault-registry.ts will be used as fallback
    return null;
  } catch (error) {
    console.warn('[ReXyzAPI] Error fetching data:', error);
    return null;
  }
}

// ============== CACHE ==============

const allocationCache = new Map<string, { data: VaultAllocations; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchVaultAllocationsWithCache(
  vaultAddress: string,
  protocolSlug: string,
  chain: Chain
): Promise<VaultAllocations | null> {
  const cacheKey = `${chain}:${vaultAddress}`;
  const cached = allocationCache.get(cacheKey);

  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const data = await fetchVaultAllocations(vaultAddress, protocolSlug, chain);

  if (data) {
    allocationCache.set(cacheKey, {
      data,
      expiry: Date.now() + CACHE_TTL,
    });
  }

  return data;
}
