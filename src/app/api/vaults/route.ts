import { NextResponse } from 'next/server';
import { defiLlamaClient } from '@/services/data-sources/defillama';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const chain = searchParams.get('chain');
  const protocol = searchParams.get('protocol');

  try {
    // Get yield pools from DeFiLlama
    let pools = await defiLlamaClient.getYieldPools();

    // Filter by search query
    if (query) {
      const lowerQuery = query.toLowerCase();
      pools = pools.filter(
        (p) =>
          p.symbol.toLowerCase().includes(lowerQuery) ||
          p.project.toLowerCase().includes(lowerQuery)
      );
    }

    // Filter by chain
    if (chain) {
      pools = pools.filter(
        (p) => p.chain.toLowerCase() === chain.toLowerCase()
      );
    }

    // Filter by protocol/project
    if (protocol) {
      pools = pools.filter(
        (p) => p.project.toLowerCase() === protocol.toLowerCase()
      );
    }

    // Limit results
    const results = pools.slice(0, 50).map((p) => ({
      id: `${p.project}:${p.symbol}:${p.chain}`.toLowerCase(),
      name: `${p.project} ${p.symbol}`,
      symbol: p.symbol,
      chain: p.chain,
      protocol: p.project,
      tvl: p.tvl,
      apy: p.apy,
      underlyingTokens: p.underlyingTokens,
      stablecoin: p.stablecoin,
    }));

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error fetching vaults:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch vaults',
      },
      { status: 500 }
    );
  }
}
