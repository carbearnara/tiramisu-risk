import { NextResponse } from 'next/server';
import { getTrackedVaults } from '@/services/live-data';
import { swrCache, CacheKeys, CacheTTL } from '@/services/cache';

// Transform vault data for API response
function transformVaultData(vaultsWithLiveData: Awaited<ReturnType<typeof getTrackedVaults>>) {
  return vaultsWithLiveData.map(vault => ({
    id: vault.id,
    name: vault.name,
    protocol: vault.protocol,
    protocolSlug: vault.protocolSlug,
    chain: vault.chain,
    address: vault.address,
    underlying: vault.underlying,
    curator: vault.curator,
    strategies: vault.strategies,
    liveData: vault.liveData ? {
      tvl: vault.liveData.tvl,
      apy: vault.liveData.apy,
      dataSource: vault.liveData.dataSource,
      onChain: vault.liveData.onChain ? {
        totalAssets: vault.liveData.onChain.totalAssets,
        totalAssetsUsd: vault.liveData.onChain.totalAssetsUsd,
        pricePerShare: vault.liveData.onChain.pricePerShare,
        timestamp: vault.liveData.onChain.timestamp,
      } : undefined,
    } : null,
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Force refresh if requested
    if (forceRefresh) {
      swrCache.invalidate(CacheKeys.liveVaults());
    }

    console.log('[API] Fetching live data for all tracked vaults (SWR cache)');

    // Use SWR cache - returns immediately if cached, refreshes in background if stale
    const { data: vaultsWithLiveData, fromCache, isStale } = await swrCache.get(
      CacheKeys.liveVaults(),
      async () => {
        console.log('[API] Cache miss or refresh - fetching fresh data...');
        return await getTrackedVaults();
      },
      CacheTTL.live
    );

    const results = transformVaultData(vaultsWithLiveData);

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
      timestamp: new Date().toISOString(),
      cache: {
        hit: fromCache,
        stale: isStale,
        stats: swrCache.getStats(),
      },
    });
  } catch (error) {
    console.error('[API] Error fetching live vault data:', error);

    // On error, try to return stale cached data
    const cachedData = swrCache.getCached<Awaited<ReturnType<typeof getTrackedVaults>>>(
      CacheKeys.liveVaults()
    );

    if (cachedData) {
      console.log('[API] Returning stale cache on error');
      return NextResponse.json({
        success: true,
        data: transformVaultData(cachedData),
        count: cachedData.length,
        timestamp: new Date().toISOString(),
        cache: { hit: true, stale: true, error: true },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch live vault data',
      },
      { status: 500 }
    );
  }
}
