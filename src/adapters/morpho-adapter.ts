// Morpho Protocol Adapter
// Fetches real allocation data from Morpho's GraphQL API

import { Chain } from '@/types/core';
import { BaseAdapter } from './base-adapter';
import { AllocationResult, TvlResult, Allocation, CACHE_TTL } from './types';

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

export class MorphoAdapter extends BaseAdapter {
  slug = 'morpho';
  name = 'Morpho';
  isERC4626 = true;
  hasApi = true;
  chains = [Chain.ETHEREUM, Chain.BASE];

  async fetchAllocations(
    vaultAddress: string,
    chain: Chain
  ): Promise<AllocationResult | null> {
    const cacheKey = `allocations:${chain}:${vaultAddress}`;
    const cached = this.getCached<AllocationResult>(cacheKey);
    if (cached) return cached;

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
        console.warn(`[MorphoAdapter] HTTP error: ${response.status}`);
        return null;
      }

      const data: MorphoVaultResponse = await response.json();
      const vault = data.data?.vaultByAddress;

      if (!vault || !vault.state) {
        return null;
      }

      const totalUsd = vault.state.totalAssetsUsd;
      const allocations: Allocation[] = vault.state.allocation
        .filter(a => a.supplyAssetsUsd > 0)
        .map(a => {
          const collateral = a.market.collateralAsset?.symbol || 'Idle';
          const loan = a.market.loanAsset.symbol;
          const market = collateral === 'Idle' ? 'Idle' : `${collateral}/${loan}`;

          return {
            protocol: 'morpho', // All allocations are within Morpho markets
            market,
            percentage: totalUsd > 0 ? (a.supplyAssetsUsd / totalUsd) * 100 : 0,
            valueUsd: a.supplyAssetsUsd,
          };
        })
        .sort((a, b) => b.percentage - a.percentage);

      const result: AllocationResult = {
        allocations,
        totalAssetsUsd: totalUsd,
        source: 'api',
        timestamp: new Date(),
      };

      console.log(`[MorphoAdapter] Fetched allocations for ${vaultAddress}: ${allocations.map(a => `${a.market}: ${a.percentage.toFixed(1)}%`).join(', ')}`);

      this.setCache(cacheKey, result, CACHE_TTL.api);
      return result;
    } catch (error) {
      console.warn(`[MorphoAdapter] Error fetching allocations for ${vaultAddress}:`, error);
      return null;
    }
  }

  async fetchTvl(vaultAddress: string, chain: Chain): Promise<TvlResult | null> {
    // Try API first for TVL
    const allocations = await this.fetchAllocations(vaultAddress, chain);
    if (allocations) {
      return {
        tvlUsd: allocations.totalAssetsUsd,
        source: 'api',
        timestamp: allocations.timestamp,
      };
    }

    // Fall back to on-chain ERC-4626
    const cacheKey = `tvl:${chain}:${vaultAddress}`;
    const cached = this.getCached<TvlResult>(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetchERC4626Data(vaultAddress, chain);
      const tvlUsd = Number(data.totalAssets) / Math.pow(10, data.decimals);

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
      console.warn(`[MorphoAdapter] Failed to fetch TVL for ${vaultAddress}:`, error);
      return null;
    }
  }
}

// Export singleton
export const morphoAdapter = new MorphoAdapter();
