// Base Protocol Adapter
// Provides common functionality for all protocol adapters

import {
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  type PublicClient,
  type Address,
} from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { Chain } from '@/types/core';
import {
  ProtocolAdapter,
  AllocationResult,
  TvlResult,
  CacheEntry,
  CACHE_TTL,
} from './types';

// ============== CHAIN CONFIG ==============

const CHAIN_CONFIG = {
  [Chain.ETHEREUM]: {
    chain: mainnet,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
  },
  [Chain.ARBITRUM]: {
    chain: arbitrum,
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arbitrum.llamarpc.com',
  },
  [Chain.OPTIMISM]: {
    chain: optimism,
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://optimism.llamarpc.com',
  },
  [Chain.POLYGON]: {
    chain: polygon,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com',
  },
  [Chain.BASE]: {
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL || 'https://base.llamarpc.com',
  },
  [Chain.AVALANCHE]: {
    chain: avalanche,
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://avalanche.drpc.org',
  },
};

// ============== ABIS ==============

const ERC20_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
]);

const ERC4626_ABI = parseAbi([
  'function asset() view returns (address)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
]);

// ============== BASE ADAPTER ==============

export abstract class BaseAdapter implements ProtocolAdapter {
  abstract slug: string;
  abstract name: string;
  abstract isERC4626: boolean;
  abstract hasApi: boolean;
  abstract chains: Chain[];

  // Cache for this adapter
  protected cache = new Map<string, CacheEntry<unknown>>();

  // Viem clients per chain
  private clients = new Map<Chain, PublicClient>();

  /**
   * Get or create a viem client for a chain
   */
  protected getClient(chain: Chain): PublicClient {
    let client = this.clients.get(chain);
    if (!client) {
      const config = CHAIN_CONFIG[chain];
      if (!config) {
        throw new Error(`Unsupported chain: ${chain}`);
      }
      client = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
        batch: { multicall: true },
      }) as unknown as PublicClient;
      this.clients.set(chain, client);
    }
    return client;
  }

  /**
   * Get cached data if not expired
   */
  protected getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiry) {
      return entry.data as T;
    }
    return null;
  }

  /**
   * Set cached data with TTL
   */
  protected setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, { data, expiry: Date.now() + ttl });
  }

  /**
   * Fetch ERC-4626 vault data (totalAssets, totalSupply)
   */
  protected async fetchERC4626Data(
    vaultAddress: string,
    chain: Chain
  ): Promise<{ totalAssets: bigint; totalSupply: bigint; asset: string; decimals: number }> {
    const client = this.getClient(chain);
    const address = vaultAddress as Address;

    // Fetch vault data
    const [asset, totalAssets, totalSupply] = await Promise.all([
      client.readContract({ address, abi: ERC4626_ABI, functionName: 'asset' }),
      client.readContract({ address, abi: ERC4626_ABI, functionName: 'totalAssets' }),
      client.readContract({ address, abi: ERC4626_ABI, functionName: 'totalSupply' }),
    ]);

    // Fetch asset decimals
    const decimals = await client.readContract({
      address: asset as Address,
      abi: ERC20_ABI,
      functionName: 'decimals',
    });

    return {
      totalAssets: totalAssets as bigint,
      totalSupply: totalSupply as bigint,
      asset: asset as string,
      decimals: decimals as number,
    };
  }

  /**
   * Fetch ERC-20 token data (totalSupply, decimals)
   */
  protected async fetchERC20Data(
    tokenAddress: string,
    chain: Chain
  ): Promise<{ totalSupply: bigint; decimals: number; symbol: string }> {
    const client = this.getClient(chain);
    const address = tokenAddress as Address;

    const [totalSupply, decimals, symbol] = await Promise.all([
      client.readContract({ address, abi: ERC20_ABI, functionName: 'totalSupply' }),
      client.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' }),
      client.readContract({ address, abi: ERC20_ABI, functionName: 'symbol' }),
    ]);

    return {
      totalSupply: totalSupply as bigint,
      decimals: decimals as number,
      symbol: symbol as string,
    };
  }

  /**
   * Convert raw token amount to USD value
   * Override this for custom pricing logic
   */
  protected getTokenPriceUsd(symbol: string): number {
    const upperSymbol = symbol.toUpperCase();

    // Stablecoins = $1
    const stablecoins = ['USDC', 'USDT', 'DAI', 'FRAX', 'USDS', 'USDe', 'sUSDe', 'rUSD', 'reUSD', 'iUSD', 'USR', 'USN'];
    if (stablecoins.some(s => upperSymbol.includes(s.toUpperCase()))) {
      return 1;
    }

    // ETH-based tokens
    if (upperSymbol.includes('ETH') || upperSymbol.includes('STETH') || upperSymbol === 'WETH') {
      return 3200; // TODO: Fetch live price
    }

    // BTC-based tokens
    if (upperSymbol.includes('BTC') || upperSymbol === 'WBTC' || upperSymbol === 'CBBTC') {
      return 100000; // TODO: Fetch live price
    }

    // Default for unknown tokens
    return 1;
  }

  // Abstract methods to implement
  abstract fetchAllocations(
    vaultAddress: string,
    chain: Chain
  ): Promise<AllocationResult | null>;

  abstract fetchTvl(
    vaultAddress: string,
    chain: Chain
  ): Promise<TvlResult | null>;
}

// ============== GENERIC ADAPTERS ==============

/**
 * Generic ERC-4626 adapter
 * Uses on-chain totalAssets() for TVL, no allocation data
 */
export class GenericERC4626Adapter extends BaseAdapter {
  slug = 'generic-erc4626';
  name = 'Generic ERC-4626';
  isERC4626 = true;
  hasApi = false;
  chains = [Chain.ETHEREUM, Chain.ARBITRUM, Chain.OPTIMISM, Chain.POLYGON, Chain.BASE, Chain.AVALANCHE];

  async fetchAllocations(): Promise<AllocationResult | null> {
    // Generic adapter doesn't know allocations
    return null;
  }

  async fetchTvl(vaultAddress: string, chain: Chain): Promise<TvlResult | null> {
    const cacheKey = `tvl:${chain}:${vaultAddress}`;
    const cached = this.getCached<TvlResult>(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetchERC4626Data(vaultAddress, chain);
      const tvlUsd = Number(formatUnits(data.totalAssets, data.decimals));

      const result: TvlResult = {
        tvlUsd,
        totalSupply: data.totalSupply.toString(),
        decimals: data.decimals,
        source: 'erc4626',
        timestamp: new Date(),
      };

      this.setCache(cacheKey, result, CACHE_TTL.onchain);
      return result;
    } catch (error) {
      console.warn(`[${this.slug}] Failed to fetch ERC-4626 TVL for ${vaultAddress}:`, error);
      return null;
    }
  }
}

/**
 * Generic ERC-20 adapter (for rebasing tokens like reUSD)
 * Uses totalSupply * price for TVL, no allocation data
 */
export class GenericERC20Adapter extends BaseAdapter {
  slug = 'generic-erc20';
  name = 'Generic ERC-20';
  isERC4626 = false;
  hasApi = false;
  chains = [Chain.ETHEREUM, Chain.ARBITRUM, Chain.OPTIMISM, Chain.POLYGON, Chain.BASE, Chain.AVALANCHE];

  async fetchAllocations(): Promise<AllocationResult | null> {
    return null;
  }

  async fetchTvl(tokenAddress: string, chain: Chain): Promise<TvlResult | null> {
    const cacheKey = `tvl:${chain}:${tokenAddress}`;
    const cached = this.getCached<TvlResult>(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetchERC20Data(tokenAddress, chain);
      const totalSupply = Number(formatUnits(data.totalSupply, data.decimals));
      const price = this.getTokenPriceUsd(data.symbol);
      const tvlUsd = totalSupply * price;

      console.log(`[${this.slug}] ${data.symbol} totalSupply: ${totalSupply.toLocaleString()}, TVL: $${tvlUsd.toLocaleString()}`);

      const result: TvlResult = {
        tvlUsd,
        totalSupply: data.totalSupply.toString(),
        decimals: data.decimals,
        source: 'erc20',
        timestamp: new Date(),
      };

      this.setCache(cacheKey, result, CACHE_TTL.onchain);
      return result;
    } catch (error) {
      console.warn(`[${this.slug}] Failed to fetch ERC-20 TVL for ${tokenAddress}:`, error);
      return null;
    }
  }
}
