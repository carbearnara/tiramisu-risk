import { NextRequest, NextResponse } from 'next/server';
import { getVaultExposures } from '@/services/graph-builder';
import { swrCache, CacheKeys, CacheTTL } from '@/services/cache';

// Type for exposures result
type ExposuresResult = Awaited<ReturnType<typeof getVaultExposures>>;

/**
 * GET /api/vaults/[id]/exposures
 *
 * Fetches exposure breakdown for a vault using the adapter system.
 * Returns TVL and percentage allocations to underlying protocols.
 * Uses SWR caching for fast responses with background refresh.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vaultId = decodeURIComponent(id);
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  try {
    console.log(`[API] Fetching exposures for vault: ${vaultId}`);

    // Force refresh if requested
    if (forceRefresh) {
      swrCache.invalidate(CacheKeys.vaultExposures(vaultId));
    }

    // Use SWR cache
    const { data: result, fromCache, isStale } = await swrCache.get(
      CacheKeys.vaultExposures(vaultId),
      async () => {
        console.log(`[API] Cache miss - fetching exposures for ${vaultId}...`);
        return await getVaultExposures(vaultId);
      },
      CacheTTL.live // Use live TTL since TVL changes frequently
    );

    return NextResponse.json({
      success: true,
      vaultId,
      tvl: result.tvl,
      exposures: result.exposures,
      cache: {
        hit: fromCache,
        stale: isStale,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[API] Error fetching exposures for ${vaultId}:`, error);

    // Try to return cached data on error
    const cachedResult = swrCache.getCached<ExposuresResult>(
      CacheKeys.vaultExposures(vaultId)
    );

    if (cachedResult) {
      console.log(`[API] Returning stale cache on error for ${vaultId}`);
      return NextResponse.json({
        success: true,
        vaultId,
        tvl: cachedResult.tvl,
        exposures: cachedResult.exposures,
        cache: { hit: true, stale: true, error: true },
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch exposures',
        vaultId,
      },
      { status: 500 }
    );
  }
}
