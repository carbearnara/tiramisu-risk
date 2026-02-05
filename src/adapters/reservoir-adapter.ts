// Reservoir Protocol Adapter
// rUSD is an ERC-4626 vault with dynamic allocations managed via governance
// Allocations shown at app.reservoir.xyz/reserves

import { Chain } from '@/types/core';
import { BaseAdapter } from './base-adapter';
import { AllocationResult, TvlResult, CACHE_TTL } from './types';

export class ReservoirAdapter extends BaseAdapter {
  slug = 'reservoir';
  name = 'Reservoir';
  isERC4626 = true;
  hasApi = false; // Allocations managed via governance, no public API
  chains = [Chain.ETHEREUM];

  async fetchAllocations(
    vaultAddress: string,
    chain: Chain
  ): Promise<AllocationResult | null> {
    // Reservoir manages allocations via governance off-chain
    // The getAssetAdapterList() function exists but returns empty
    // Allocations shown at app.reservoir.xyz/reserves
    console.log(`[ReservoirAdapter] No API for allocations, using configured`);
    return null;
  }

  async fetchTvl(vaultAddress: string, chain: Chain): Promise<TvlResult | null> {
    const cacheKey = `tvl:${chain}:${vaultAddress}`;
    const cached = this.getCached<TvlResult>(cacheKey);
    if (cached) return cached;

    try {
      // rUSD is ERC-4626 compliant
      const data = await this.fetchERC4626Data(vaultAddress, chain);
      const tvlUsd = Number(data.totalAssets) / Math.pow(10, data.decimals);

      console.log(`[ReservoirAdapter] totalAssets: ${tvlUsd.toLocaleString()}, TVL: $${tvlUsd.toLocaleString()}`);

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
      console.warn(`[ReservoirAdapter] Failed to fetch TVL for ${vaultAddress}:`, error);
      return null;
    }
  }
}

// Export singleton
export const reservoirAdapter = new ReservoirAdapter();
