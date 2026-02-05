import { NextRequest, NextResponse } from 'next/server';
import { buildLiveVaultGraph } from '@/services/live-data';
import { buildVaultGraph, GraphBuildResult } from '@/services/graph-builder';
import { Entity, RiskAssessment } from '@/types/core';
import { riskCalculator } from '@/services/risk-calculator';
import { swrCache, CacheKeys, CacheTTL } from '@/services/cache';

// Type for the live-data graph result
type LiveGraphResult = Awaited<ReturnType<typeof buildLiveVaultGraph>>;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vaultId = decodeURIComponent(id);

  // Check for adapter mode and refresh query params
  const useAdapters = request.nextUrl.searchParams.get('adapters') === 'true';
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  try {
    console.log(`[API] Fetching graph for vault: ${vaultId} (adapters=${useAdapters})`);

    // Force refresh if requested
    if (forceRefresh) {
      swrCache.invalidate(CacheKeys.vaultGraph(vaultId));
    }

    // Use new adapter-based system if requested
    if (useAdapters) {
      const { data: adapterResult, fromCache, isStale } = await swrCache.get(
        CacheKeys.vaultGraph(vaultId),
        async () => {
          console.log(`[API] Cache miss - building graph for ${vaultId}...`);
          return await buildVaultGraph(vaultId, {
            includeGovernance: true,
            includeOracles: true,
          });
        },
        CacheTTL.graph
      );

      if (!adapterResult) {
        return NextResponse.json(
          { error: `Vault not found: ${vaultId}` },
          { status: 404 }
        );
      }

      // Calculate risk assessments (cached separately or inline)
      const assessments = await riskCalculator.calculateGraphRisks(adapterResult.graph);

      // Convert exposures Map to serializable format
      const exposuresObject: Record<string, number> = {};
      adapterResult.exposures.forEach((exp) => {
        exposuresObject[exp.entityId] = exp.exposure;
      });

      const entitiesArray: { id: string; entity: Entity; exposure: number }[] = [];
      adapterResult.graph.entities.forEach((entity, entityId) => {
        entitiesArray.push({
          id: entityId,
          entity,
          exposure: adapterResult.exposures.get(entityId)?.exposure ?? 0,
        });
      });

      const assessmentsObject: Record<string, RiskAssessment> = {};
      assessments.forEach((assessment, entityId) => {
        assessmentsObject[entityId] = assessment;
      });

      return NextResponse.json({
        success: true,
        rootEntityId: adapterResult.graph.rootEntityId,
        graph: {
          entities: entitiesArray,
          edges: adapterResult.graph.edges,
        },
        exposures: exposuresObject,
        riskAssessments: assessmentsObject,
        totalTvl: adapterResult.totalTvl,
        warnings: adapterResult.warnings,
        source: 'adapters',
        cache: {
          hit: fromCache,
          stale: isStale,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Default: use existing live-data system with caching
    const cacheKey = `${CacheKeys.vaultGraph(vaultId)}:legacy`;
    const { data: result, fromCache, isStale } = await swrCache.get(
      cacheKey,
      async () => {
        console.log(`[API] Cache miss - building legacy graph for ${vaultId}...`);
        return await buildLiveVaultGraph(vaultId);
      },
      CacheTTL.graph
    );

    if (!result) {
      return NextResponse.json(
        {
          error: `Vault not found: ${vaultId}`,
          suggestion: 'Check if the vault ID is correct or try a different vault.',
        },
        { status: 404 }
      );
    }

    const { graph, assessments, exposures } = result;

    // Convert Map to serializable format
    const entitiesArray: { id: string; entity: Entity; exposure: number }[] = [];
    graph.entities.forEach((entity, id) => {
      entitiesArray.push({
        id,
        entity,
        exposure: exposures.get(id) ?? 0, // USD exposure from root vault
      });
    });

    const assessmentsObject: Record<string, RiskAssessment> = {};
    assessments.forEach((assessment, id) => {
      assessmentsObject[id] = assessment;
    });

    // Convert exposures to object for convenience
    const exposuresObject: Record<string, number> = {};
    exposures.forEach((exposure, id) => {
      exposuresObject[id] = exposure;
    });

    return NextResponse.json({
      success: true,
      rootEntityId: graph.rootEntityId,
      graph: {
        entities: entitiesArray,
        edges: graph.edges,
      },
      exposures: exposuresObject,
      riskAssessments: assessmentsObject,
      cache: {
        hit: fromCache,
        stale: isStale,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[API] Error fetching vault graph for ${vaultId}:`, error);

    // Try to return cached data on error
    const cachedResult = swrCache.getCached<GraphBuildResult | LiveGraphResult>(
      CacheKeys.vaultGraph(vaultId)
    ) || swrCache.getCached<LiveGraphResult>(`${CacheKeys.vaultGraph(vaultId)}:legacy`);

    if (cachedResult) {
      console.log(`[API] Returning stale cache on error for ${vaultId}`);
      // Return minimal cached response
      return NextResponse.json({
        success: true,
        error: 'Returning cached data due to fetch error',
        cache: { hit: true, stale: true, error: true },
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch vault data',
        vaultId,
      },
      { status: 500 }
    );
  }
}
