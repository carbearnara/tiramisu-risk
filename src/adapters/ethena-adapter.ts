// Ethena Protocol Adapter
// sUSDe is a rebasing ERC-4626 vault backed by USDe
// USDe is backed by delta-neutral ETH derivatives positions

import { Chain } from '@/types/core';
import { BaseAdapter } from './base-adapter';
import { AllocationResult, TvlResult, Allocation, CACHE_TTL } from './types';

export class EthenaAdapter extends BaseAdapter {
  slug = 'ethena';
  name = 'Ethena';
  isERC4626 = true; // sUSDe is ERC-4626
  hasApi = false;
  chains = [Chain.ETHEREUM];

  async fetchAllocations(
    vaultAddress: string,
    chain: Chain
  ): Promise<AllocationResult | null> {
    // Ethena's sUSDe is 100% backed by USDe
    // USDe itself is backed by delta-neutral positions (futures + spot)
    // For now, we represent sUSDe as 100% Ethena exposure
    const cacheKey = `allocations:${chain}:${vaultAddress}`;
    const cached = this.getCached<AllocationResult>(cacheKey);
    if (cached) return cached;

    try {
      const tvl = await this.fetchTvl(vaultAddress, chain);
      if (!tvl) return null;

      const allocations: Allocation[] = [
        {
          protocol: 'ethena',
          market: 'sUSDe',
          percentage: 100,
          valueUsd: tvl.tvlUsd,
        },
      ];

      const result: AllocationResult = {
        allocations,
        totalAssetsUsd: tvl.tvlUsd,
        source: 'onchain',
        timestamp: new Date(),
      };

      this.setCache(cacheKey, result, CACHE_TTL.onchain);
      return result;
    } catch (error) {
      console.warn(`[EthenaAdapter] Error fetching allocations:`, error);
      return null;
    }
  }

  async fetchTvl(vaultAddress: string, chain: Chain): Promise<TvlResult | null> {
    const cacheKey = `tvl:${chain}:${vaultAddress}`;
    const cached = this.getCached<TvlResult>(cacheKey);
    if (cached) return cached;

    try {
      // sUSDe is ERC-4626 compliant
      const data = await this.fetchERC4626Data(vaultAddress, chain);
      const tvlUsd = Number(data.totalAssets) / Math.pow(10, data.decimals);

      console.log(`[EthenaAdapter] sUSDe totalAssets: ${tvlUsd.toLocaleString()}`);

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
      console.warn(`[EthenaAdapter] Failed to fetch TVL for ${vaultAddress}:`, error);
      return null;
    }
  }
}

// Export singleton
export const ethenaAdapter = new EthenaAdapter();
