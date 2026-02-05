// DeFiLlama API client for protocol and yield data

import { z } from 'zod';
import { Chain, ProtocolCategory } from '@/types/core';

const DEFILLAMA_BASE_URL = 'https://api.llama.fi';
const YIELDS_BASE_URL = 'https://yields.llama.fi';

// ============== RESPONSE SCHEMAS ==============

const ProtocolSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  symbol: z.string().optional(),
  category: z.string(),
  chains: z.array(z.string()),
  tvl: z.number().nullable(),
  chainTvls: z.record(z.string(), z.number()).optional(),
  change_1h: z.number().nullable().optional(),
  change_1d: z.number().nullable().optional(),
  change_7d: z.number().nullable().optional(),
  mcap: z.number().nullable().optional(),
  url: z.string().optional(),
  twitter: z.string().nullable().optional(),
  audit_links: z.array(z.string()).optional(),
  logo: z.string().optional(),
  description: z.string().optional(),
  audits: z.string().optional(),
  listedAt: z.number().optional(),
  parentProtocol: z.string().optional(),
});

const ProtocolDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(), // Not always present in detail endpoint
  symbol: z.string().optional(),
  category: z.string().optional(), // Not always present in detail endpoint
  chains: z.array(z.string()).optional().default([]), // May be empty or missing
  tvl: z.array(z.object({
    date: z.number(),
    totalLiquidityUSD: z.number(),
  })).optional(),
  currentChainTvls: z.record(z.string(), z.number()).optional(),
  // chainTvls has complex nested structure with borrowed/staking variants - use passthrough
  chainTvls: z.unknown().optional(),
  url: z.string().optional(),
  twitter: z.string().nullable().optional(),
  audit_links: z.array(z.string()).optional(),
  logo: z.string().optional(),
  description: z.string().optional(),
  audits: z.string().optional(),
  address: z.string().nullable().optional(),
  oracles: z.array(z.string()).optional(),
  forkedFrom: z.array(z.string()).optional(),
  governanceID: z.array(z.string()).optional(),
  treasury: z.string().nullable().optional(),
}).passthrough(); // Allow additional fields from API

const YieldPoolSchema = z.object({
  pool: z.string(),
  chain: z.string(),
  project: z.string(),
  symbol: z.string(),
  tvlUsd: z.number().nullable(),
  apyBase: z.number().nullable(),
  apyReward: z.number().nullable(),
  apy: z.number().nullable(),
  rewardTokens: z.array(z.unknown()).nullable().optional(),
  underlyingTokens: z.array(z.unknown()).nullable().optional(),
  poolMeta: z.string().nullable().optional(),
  il7d: z.number().nullable().optional(),
  apyBase7d: z.number().nullable().optional(),
  apyMean30d: z.number().nullable().optional(),
  volumeUsd1d: z.number().nullable().optional(),
  volumeUsd7d: z.number().nullable().optional(),
  apyBaseInception: z.number().nullable().optional(),
  stablecoin: z.boolean().optional(),
  ilRisk: z.string().optional(),
  exposure: z.string().optional(),
  predictedClass: z.string().nullable().optional(),
  predictedProbability: z.number().nullable().optional(),
  binnedConfidence: z.number().nullable().optional(),
  mu: z.number().nullable().optional(),
  sigma: z.number().nullable().optional(),
  count: z.number().nullable().optional(),
  outlier: z.boolean().nullable().optional(),
});

// ============== TYPES ==============

export type DefiLlamaProtocol = z.infer<typeof ProtocolSchema>;
export type DefiLlamaProtocolDetail = z.infer<typeof ProtocolDetailSchema>;
export type DefiLlamaYieldPool = z.infer<typeof YieldPoolSchema>;

export interface ProtocolSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  tvl: number;
  chains: string[];
  logo?: string;
  twitter?: string;
  url?: string;
}

export interface YieldPoolSummary {
  poolId: string;
  chain: string;
  project: string;
  symbol: string;
  tvl: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  underlyingTokens: string[];
  stablecoin: boolean;
}

// ============== CACHE ==============

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============== RATE LIMITER ==============

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(maxRequests: number, windowMs: number) {
    this.maxTokens = maxRequests;
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
    this.refillRate = maxRequests / windowMs;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.refill();
    }
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// ============== CLIENT ==============

export class DefiLlamaClient {
  private cache = new SimpleCache();
  private rateLimiter = new RateLimiter(100, 60000); // 100 requests per minute

  private async fetch<T>(url: string, schema?: z.ZodSchema<T>): Promise<T> {
    await this.rateLimiter.acquire();

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`DeFiLlama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (schema) {
      return schema.parse(data);
    }

    return data as T;
  }

  // ============== PROTOCOLS ==============

  async getAllProtocols(): Promise<ProtocolSummary[]> {
    const cacheKey = 'protocols:all';
    const cached = this.cache.get<ProtocolSummary[]>(cacheKey);
    if (cached) return cached;

    const data = await this.fetch<DefiLlamaProtocol[]>(
      `${DEFILLAMA_BASE_URL}/protocols`,
      z.array(ProtocolSchema)
    );

    const protocols: ProtocolSummary[] = data.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      tvl: p.tvl ?? 0,
      chains: p.chains,
      logo: p.logo,
      twitter: p.twitter ?? undefined,
      url: p.url,
    }));

    this.cache.set(cacheKey, protocols, 5 * 60 * 1000); // 5 min cache
    return protocols;
  }

  async getProtocol(slug: string): Promise<DefiLlamaProtocolDetail | null> {
    const cacheKey = `protocol:${slug}`;
    const cached = this.cache.get<DefiLlamaProtocolDetail>(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetch<DefiLlamaProtocolDetail>(
        `${DEFILLAMA_BASE_URL}/protocol/${slug}`,
        ProtocolDetailSchema
      );

      this.cache.set(cacheKey, data, 10 * 60 * 1000); // 10 min cache
      return data;
    } catch {
      return null;
    }
  }

  async getProtocolTvl(slug: string): Promise<number> {
    const protocol = await this.getProtocol(slug);
    if (!protocol || !protocol.tvl || protocol.tvl.length === 0) {
      return 0;
    }
    // Return latest TVL
    return protocol.tvl[protocol.tvl.length - 1].totalLiquidityUSD;
  }

  async searchProtocols(query: string): Promise<ProtocolSummary[]> {
    const protocols = await this.getAllProtocols();
    const lowerQuery = query.toLowerCase();
    return protocols.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.slug.toLowerCase().includes(lowerQuery)
    );
  }

  async getProtocolsByCategory(category: string): Promise<ProtocolSummary[]> {
    const protocols = await this.getAllProtocols();
    return protocols.filter(
      (p) => p.category.toLowerCase() === category.toLowerCase()
    );
  }

  // ============== YIELDS ==============

  async getYieldPools(): Promise<YieldPoolSummary[]> {
    const cacheKey = 'yields:pools';
    const cached = this.cache.get<YieldPoolSummary[]>(cacheKey);
    if (cached) return cached;

    interface YieldResponse {
      status: string;
      data: DefiLlamaYieldPool[];
    }

    const response = await this.fetch<YieldResponse>(`${YIELDS_BASE_URL}/pools`);
    const validPools = z.array(YieldPoolSchema).parse(response.data);

    const pools: YieldPoolSummary[] = validPools.map((p) => ({
      poolId: p.pool,
      chain: p.chain,
      project: p.project,
      symbol: p.symbol,
      tvl: p.tvlUsd ?? 0,
      apy: p.apy,
      apyBase: p.apyBase,
      apyReward: p.apyReward,
      underlyingTokens: (p.underlyingTokens ?? []).map(t => typeof t === 'string' ? t : String(t)),
      stablecoin: p.stablecoin ?? false,
    }));

    this.cache.set(cacheKey, pools, 5 * 60 * 1000); // 5 min cache
    return pools;
  }

  async getYieldPoolsByProject(project: string): Promise<YieldPoolSummary[]> {
    const pools = await this.getYieldPools();
    return pools.filter(
      (p) => p.project.toLowerCase() === project.toLowerCase()
    );
  }

  async getYieldPoolsByChain(chain: string): Promise<YieldPoolSummary[]> {
    const pools = await this.getYieldPools();
    return pools.filter(
      (p) => p.chain.toLowerCase() === chain.toLowerCase()
    );
  }

  async getPoolById(poolId: string): Promise<YieldPoolSummary | null> {
    const pools = await this.getYieldPools();
    return pools.find((p) => p.poolId === poolId) ?? null;
  }

  // ============== TOKEN PRICES ==============

  async getTokenPrices(
    tokens: Array<{ chain: string; address: string }>
  ): Promise<Map<string, number>> {
    const coins = tokens.map((t) => `${t.chain}:${t.address}`).join(',');
    const cacheKey = `prices:${coins}`;
    const cached = this.cache.get<Map<string, number>>(cacheKey);
    if (cached) return cached;

    const response = await this.fetch<{
      coins: Record<string, { price: number; symbol: string; decimals: number }>;
    }>(`${DEFILLAMA_BASE_URL}/prices/current/${coins}`);

    const prices = new Map<string, number>();
    for (const [key, value] of Object.entries(response.coins)) {
      prices.set(key, value.price);
    }

    this.cache.set(cacheKey, prices, 60 * 1000); // 1 min cache
    return prices;
  }

  // ============== STABLECOINS ==============

  async getStablecoins(): Promise<
    Array<{
      id: string;
      name: string;
      symbol: string;
      pegType: string;
      circulating: number;
      chains: string[];
    }>
  > {
    const cacheKey = 'stablecoins';
    const cached = this.cache.get<
      Array<{
        id: string;
        name: string;
        symbol: string;
        pegType: string;
        circulating: number;
        chains: string[];
      }>
    >(cacheKey);
    if (cached) return cached;

    interface StablecoinResponse {
      peggedAssets: Array<{
        id: string;
        name: string;
        symbol: string;
        pegType: string;
        circulating: { peggedUSD: number };
        chains: string[];
      }>;
    }

    const response = await this.fetch<StablecoinResponse>(
      'https://stablecoins.llama.fi/stablecoins?includePrices=false'
    );

    const stablecoins = response.peggedAssets.map((s) => ({
      id: s.id,
      name: s.name,
      symbol: s.symbol,
      pegType: s.pegType,
      circulating: s.circulating.peggedUSD,
      chains: s.chains,
    }));

    this.cache.set(cacheKey, stablecoins, 30 * 60 * 1000); // 30 min cache
    return stablecoins;
  }

  // ============== UTILITY ==============

  mapCategoryToProtocolCategory(category: string): ProtocolCategory {
    const mapping: Record<string, ProtocolCategory> = {
      'lending': ProtocolCategory.LENDING,
      'dexes': ProtocolCategory.DEX,
      'dex': ProtocolCategory.DEX,
      'yield': ProtocolCategory.YIELD_AGGREGATOR,
      'yield aggregator': ProtocolCategory.YIELD_AGGREGATOR,
      'derivatives': ProtocolCategory.DERIVATIVES,
      'bridge': ProtocolCategory.BRIDGE,
      'liquid staking': ProtocolCategory.LIQUID_STAKING,
      'staking': ProtocolCategory.STAKING,
      'cdp': ProtocolCategory.CDP,
    };

    return mapping[category.toLowerCase()] ?? ProtocolCategory.OTHER;
  }

  mapChainToEnum(chain: string): Chain | null {
    const mapping: Record<string, Chain> = {
      'ethereum': Chain.ETHEREUM,
      'arbitrum': Chain.ARBITRUM,
      'optimism': Chain.OPTIMISM,
      'polygon': Chain.POLYGON,
      'base': Chain.BASE,
      'avalanche': Chain.AVALANCHE,
      'avax': Chain.AVALANCHE,
    };

    return mapping[chain.toLowerCase()] ?? null;
  }
}

// Export singleton instance
export const defiLlamaClient = new DefiLlamaClient();
