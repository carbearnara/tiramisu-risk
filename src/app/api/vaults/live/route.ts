import { NextResponse } from 'next/server';
import { getTrackedVaults } from '@/services/live-data';

export async function GET() {
  try {
    console.log('[API] Fetching live data for all tracked vaults');

    const vaultsWithLiveData = await getTrackedVaults();

    const results = vaultsWithLiveData.map(vault => ({
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

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching live vault data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch live vault data',
      },
      { status: 500 }
    );
  }
}
