import { NextResponse } from 'next/server';
import { defiLlamaClient } from '@/services/data-sources/defillama';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const category = searchParams.get('category');

  try {
    let protocols = await defiLlamaClient.getAllProtocols();

    // Filter by search query
    if (query) {
      protocols = await defiLlamaClient.searchProtocols(query);
    }

    // Filter by category
    if (category) {
      protocols = protocols.filter(
        (p) => p.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Sort by TVL and limit
    const results = protocols
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 100)
      .map((p) => ({
        id: `protocol:${p.slug}`,
        name: p.name,
        slug: p.slug,
        category: p.category,
        tvl: p.tvl,
        chains: p.chains,
        logo: p.logo,
        twitter: p.twitter,
        url: p.url,
      }));

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error fetching protocols:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch protocols',
      },
      { status: 500 }
    );
  }
}
