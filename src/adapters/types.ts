// Protocol Adapter Types
// Defines the interface for fetching allocation and TVL data from different protocols

import { Chain } from '@/types/core';

/**
 * Represents a single allocation from a vault to a target protocol/asset
 */
export interface Allocation {
  /** Target protocol slug (e.g., 'ethena', 'aave-v3') */
  protocol: string;
  /** Market or strategy identifier (e.g., 'cbBTC/USDC', 'sUSDe') */
  market?: string;
  /** Allocation percentage (0-100) */
  percentage: number;
  /** USD value of allocation (if available) */
  valueUsd?: number;
}

/**
 * Result of fetching allocations from a protocol
 */
export interface AllocationResult {
  /** List of allocations */
  allocations: Allocation[];
  /** Total assets in USD */
  totalAssetsUsd: number;
  /** Data source for attribution */
  source: 'api' | 'onchain' | 'configured' | 'estimated';
  /** When the data was fetched */
  timestamp: Date;
}

/**
 * Result of fetching TVL from a protocol
 */
export interface TvlResult {
  /** Total value locked in USD */
  tvlUsd: number;
  /** Total supply of tokens (raw) */
  totalSupply?: string;
  /** Token decimals */
  decimals?: number;
  /** Data source */
  source: 'erc4626' | 'erc20' | 'api' | 'configured';
  /** When the data was fetched */
  timestamp: Date;
}

/**
 * Protocol adapter interface
 * Each protocol implements this to define how to fetch its data
 */
export interface ProtocolAdapter {
  /** Protocol slug (must match vault-registry protocolSlug) */
  slug: string;

  /** Human-readable name */
  name: string;

  /** Whether the protocol uses ERC-4626 vaults */
  isERC4626: boolean;

  /** Whether the protocol has a real-time API */
  hasApi: boolean;

  /** Supported chains */
  chains: Chain[];

  /**
   * Fetch allocation breakdown for a vault
   * @param vaultAddress - The vault contract address
   * @param chain - The blockchain network
   * @returns Allocation data or null if not available
   */
  fetchAllocations(
    vaultAddress: string,
    chain: Chain
  ): Promise<AllocationResult | null>;

  /**
   * Fetch TVL for a vault
   * @param vaultAddress - The vault contract address
   * @param chain - The blockchain network
   * @returns TVL data or null if not available
   */
  fetchTvl(
    vaultAddress: string,
    chain: Chain
  ): Promise<TvlResult | null>;
}

/**
 * Configuration for a vault's allocations (fallback when no API)
 */
export interface ConfiguredAllocation {
  protocol: string;
  allocation: number; // Percentage 0-100
  market?: string;
}

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
  data: T;
  expiry: number;
}

/**
 * Cache TTL configuration (milliseconds)
 */
export const CACHE_TTL = {
  /** On-chain data - changes slowly */
  onchain: 5 * 60 * 1000,
  /** API data - more dynamic */
  api: 2 * 60 * 1000,
  /** Protocol TVL - aggregated */
  protocolTvl: 10 * 60 * 1000,
  /** Scraped/configured - manual updates */
  configured: 60 * 60 * 1000,
} as const;
