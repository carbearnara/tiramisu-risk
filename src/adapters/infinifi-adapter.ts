// infiniFi Protocol Adapter
// siUSD is an ERC-4626 vault with multi-protocol allocations
// Allocations are fetched from configured data (scraped from stats.infinifi.xyz)

import { Chain } from '@/types/core';
import { BaseAdapter } from './base-adapter';
import { AllocationResult, TvlResult, CACHE_TTL } from './types';

export class InfiniFiAdapter extends BaseAdapter {
  slug = 'infinifi';
  name = 'infiniFi';
  isERC4626 = true;
  hasApi = false; // No public API, allocations scraped from stats page
  chains = [Chain.ETHEREUM];

  async fetchAllocations(
    vaultAddress: string,
    chain: Chain
  ): Promise<AllocationResult | null> {
    // infiniFi doesn't expose allocation data via API
    // Allocations are managed dynamically and shown on stats.infinifi.xyz
    // We return null to use configured allocations from vault-registry
    console.log(`[InfiniFiAdapter] No API for allocations, using configured`);
    return null;
  }

  async fetchTvl(vaultAddress: string, chain: Chain): Promise<TvlResult | null> {
    const cacheKey = `tvl:${chain}:${vaultAddress}`;
    const cached = this.getCached<TvlResult>(cacheKey);
    if (cached) return cached;

    try {
      // siUSD is ERC-4626 compliant
      const data = await this.fetchERC4626Data(vaultAddress, chain);
      const tvlUsd = Number(data.totalAssets) / Math.pow(10, data.decimals);

      console.log(`[InfiniFiAdapter] totalAssets: ${tvlUsd.toLocaleString()}, TVL: $${tvlUsd.toLocaleString()}`);

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
      console.warn(`[InfiniFiAdapter] Failed to fetch TVL for ${vaultAddress}:`, error);
      return null;
    }
  }
}

// Export singleton
export const infiniFiAdapter = new InfiniFiAdapter();
