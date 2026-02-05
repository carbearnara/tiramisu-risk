// Re.xyz Protocol Adapter
// reUSD is a rebasing ERC-20 token, not ERC-4626
// Allocations are dynamic between Ethena sUSDe and T-bills

import { Chain } from '@/types/core';
import { BaseAdapter } from './base-adapter';
import { AllocationResult, TvlResult, CACHE_TTL } from './types';

export class ReXyzAdapter extends BaseAdapter {
  slug = 'rexyz';
  name = 'Re.xyz';
  isERC4626 = false; // reUSD is rebasing ERC-20
  hasApi = false; // Transparency page loads dynamically
  chains = [Chain.ETHEREUM, Chain.AVALANCHE];

  async fetchAllocations(
    vaultAddress: string,
    chain: Chain
  ): Promise<AllocationResult | null> {
    // Re.xyz doesn't expose allocation data via API
    // Allocations are dynamic between Ethena (sUSDe) and T-bills
    // Based on which yield source is higher
    // See: https://docs.re.xyz/insurance-capital-layers/what-is-reusd
    //
    // We return null to use configured allocations from vault-registry
    console.log(`[ReXyzAdapter] No API for allocations, using configured`);
    return null;
  }

  async fetchTvl(tokenAddress: string, chain: Chain): Promise<TvlResult | null> {
    const cacheKey = `tvl:${chain}:${tokenAddress}`;
    const cached = this.getCached<TvlResult>(cacheKey);
    if (cached) return cached;

    try {
      // reUSD is a rebasing token - use totalSupply
      const data = await this.fetchERC20Data(tokenAddress, chain);
      const totalSupply = Number(data.totalSupply) / Math.pow(10, data.decimals);

      // reUSD trades at ~$1.06 (accrued yield) but we use $1 for TVL calculation
      // as the underlying value is still 1:1 with deposits
      const price = 1;
      const tvlUsd = totalSupply * price;

      console.log(`[ReXyzAdapter] ${data.symbol} totalSupply: ${totalSupply.toLocaleString()}, TVL: $${tvlUsd.toLocaleString()}`);

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
      console.warn(`[ReXyzAdapter] Failed to fetch TVL for ${tokenAddress}:`, error);
      return null;
    }
  }
}

// Export singleton
export const reXyzAdapter = new ReXyzAdapter();
