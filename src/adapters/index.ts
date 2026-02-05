// Protocol Adapter Registry
// Central registry for all protocol adapters with fallback to configured allocations

import { Chain } from '@/types/core';
import {
  ProtocolAdapter,
  AllocationResult,
  TvlResult,
  Allocation,
  ConfiguredAllocation,
  CACHE_TTL,
} from './types';
import { GenericERC4626Adapter, GenericERC20Adapter } from './base-adapter';
import { morphoAdapter } from './morpho-adapter';
import { reXyzAdapter } from './rexyz-adapter';
import { infiniFiAdapter } from './infinifi-adapter';
import { reservoirAdapter } from './reservoir-adapter';
import { ethenaAdapter } from './ethena-adapter';

// Re-export types
export * from './types';

// ============== ADAPTER REGISTRY ==============

class AdapterRegistry {
  private adapters = new Map<string, ProtocolAdapter>();
  private genericERC4626 = new GenericERC4626Adapter();
  private genericERC20 = new GenericERC20Adapter();

  constructor() {
    // Register all protocol adapters
    this.register(morphoAdapter);
    this.register(reXyzAdapter);
    this.register(infiniFiAdapter);
    this.register(reservoirAdapter);
    this.register(ethenaAdapter);
  }

  /**
   * Register a protocol adapter
   */
  register(adapter: ProtocolAdapter): void {
    this.adapters.set(adapter.slug, adapter);
    console.log(`[AdapterRegistry] Registered adapter: ${adapter.slug}`);
  }

  /**
   * Get adapter by protocol slug
   */
  getAdapter(protocolSlug: string): ProtocolAdapter | null {
    return this.adapters.get(protocolSlug) || null;
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): ProtocolAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Fetch allocations for a vault
   * Strategy: API/On-chain → Configured fallback
   */
  async fetchAllocations(
    protocolSlug: string,
    vaultAddress: string,
    chain: Chain,
    configuredAllocations?: ConfiguredAllocation[]
  ): Promise<AllocationResult> {
    const adapter = this.getAdapter(protocolSlug);

    // Try adapter first
    if (adapter) {
      const result = await adapter.fetchAllocations(vaultAddress, chain);
      if (result) {
        return result;
      }
    }

    // Fall back to configured allocations
    if (configuredAllocations && configuredAllocations.length > 0) {
      const allocations: Allocation[] = configuredAllocations.map(c => ({
        protocol: c.protocol,
        market: c.market,
        percentage: c.allocation,
      }));

      return {
        allocations,
        totalAssetsUsd: 0, // Will be filled in by TVL fetch
        source: 'configured',
        timestamp: new Date(),
      };
    }

    // No data available
    return {
      allocations: [],
      totalAssetsUsd: 0,
      source: 'configured',
      timestamp: new Date(),
    };
  }

  /**
   * Fetch TVL for a vault
   * Strategy: Protocol adapter → Generic ERC-4626 → Generic ERC-20
   */
  async fetchTvl(
    protocolSlug: string,
    vaultAddress: string,
    chain: Chain,
    isERC4626: boolean = true
  ): Promise<TvlResult | null> {
    // Try protocol-specific adapter first
    const adapter = this.getAdapter(protocolSlug);
    if (adapter) {
      const result = await adapter.fetchTvl(vaultAddress, chain);
      if (result) {
        return result;
      }
    }

    // Fall back to generic adapters
    if (isERC4626) {
      const result = await this.genericERC4626.fetchTvl(vaultAddress, chain);
      if (result) {
        return result;
      }
    }

    // Try ERC-20 totalSupply as last resort
    return this.genericERC20.fetchTvl(vaultAddress, chain);
  }

  /**
   * Fetch complete vault data (TVL + allocations)
   * Returns exposure breakdown with USD values
   */
  async fetchVaultData(
    protocolSlug: string,
    vaultAddress: string,
    chain: Chain,
    configuredAllocations?: ConfiguredAllocation[],
    isERC4626: boolean = true
  ): Promise<{
    tvl: TvlResult | null;
    allocations: AllocationResult;
    exposures: Array<{ protocol: string; market?: string; valueUsd: number; percentage: number }>;
  }> {
    // Fetch TVL and allocations in parallel
    const [tvl, allocations] = await Promise.all([
      this.fetchTvl(protocolSlug, vaultAddress, chain, isERC4626),
      this.fetchAllocations(protocolSlug, vaultAddress, chain, configuredAllocations),
    ]);

    const totalUsd = tvl?.tvlUsd || allocations.totalAssetsUsd || 0;

    // Calculate USD exposures from percentages
    const exposures = allocations.allocations.map(a => ({
      protocol: a.protocol,
      market: a.market,
      percentage: a.percentage,
      valueUsd: a.valueUsd || (totalUsd * a.percentage) / 100,
    }));

    // Update allocations with totalAssetsUsd if it was 0
    if (allocations.totalAssetsUsd === 0 && totalUsd > 0) {
      allocations.totalAssetsUsd = totalUsd;
    }

    return { tvl, allocations, exposures };
  }
}

// Export singleton registry
export const adapterRegistry = new AdapterRegistry();

// ============== CONVENIENCE FUNCTIONS ==============

/**
 * Fetch vault data using the adapter registry
 */
export async function fetchVaultData(
  protocolSlug: string,
  vaultAddress: string,
  chain: Chain,
  configuredAllocations?: ConfiguredAllocation[],
  isERC4626: boolean = true
) {
  return adapterRegistry.fetchVaultData(
    protocolSlug,
    vaultAddress,
    chain,
    configuredAllocations,
    isERC4626
  );
}

/**
 * Get an adapter by protocol slug
 */
export function getAdapter(protocolSlug: string): ProtocolAdapter | null {
  return adapterRegistry.getAdapter(protocolSlug);
}
