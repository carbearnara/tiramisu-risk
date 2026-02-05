import { NextRequest, NextResponse } from 'next/server';
import { getVaultExposures } from '@/services/graph-builder';

/**
 * GET /api/vaults/[id]/exposures
 *
 * Fetches exposure breakdown for a vault using the adapter system.
 * Returns TVL and percentage allocations to underlying protocols.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vaultId = decodeURIComponent(id);

  try {
    console.log(`[API] Fetching exposures for vault: ${vaultId}`);

    const result = await getVaultExposures(vaultId);

    return NextResponse.json({
      success: true,
      vaultId,
      tvl: result.tvl,
      exposures: result.exposures,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[API] Error fetching exposures for ${vaultId}:`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch exposures',
        vaultId,
      },
      { status: 500 }
    );
  }
}
