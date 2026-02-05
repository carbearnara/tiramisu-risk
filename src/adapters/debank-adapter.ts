// DeBank Adapter
// Fetches real portfolio data from DeBank bundles via web scraping

import { Chain } from '@/types/core';
import { BaseAdapter } from './base-adapter';
import { AllocationResult, Allocation, CACHE_TTL } from './types';

// DeBank public API endpoints (no auth required)
const DEBANK_API_BASE = 'https://api.debank.com';

// Bundle configurations from vault-registry.ts comments
export const DEBANK_BUNDLES: Record<string, { bundleId: string; name: string }> = {
  infinifi: { bundleId: '220816', name: 'infiniFi' },
  rexyz: { bundleId: '220455', name: 'Re.xyz' },
  reservoir: { bundleId: '220818', name: 'Reservoir' },
  resolv: { bundleId: '220554', name: 'Resolv' },
  'avant-protocol': { bundleId: '220645', name: 'Avant' },
  noon: { bundleId: '220819', name: 'Noon' },
};

// DeBank API Response Types
interface DebankProtocol {
  id: string;
  name: string;
  site_url: string;
  logo_url: string;
  chain: string;
  portfolio_item_list: DebankPortfolioItem[];
}

interface DebankPortfolioItem {
  name: string;
  asset_usd_value: number;
  detail: {
    supply_token_list?: DebankToken[];
    borrow_token_list?: DebankToken[];
    reward_token_list?: DebankToken[];
  };
}

interface DebankToken {
  symbol: string;
  amount: number;
  price: number;
}

interface DebankBundleAddress {
  user_addr: string;
  usd_value: number;
}

export interface BundlePortfolioData {
  bundleId: string;
  totalValueUsd: number;
  protocolAllocations: Map<
    string,
    {
      protocol: string;
      name: string;
      valueUsd: number;
      percentage: number;
      positions: Array<{ name: string; valueUsd: number; tokens: string[] }>;
    }
  >;
  tokenHoldings: Map<
    string,
    {
      symbol: string;
      valueUsd: number;
    }
  >;
  addresses: string[];
  fetchedAt: Date;
}

// Protocol ID mapping from DeBank to our slugs
const DEBANK_PROTOCOL_MAP: Record<string, string> = {
  // Ethena
  ethena: 'ethena',
  ethena2: 'ethena',

  // Aave
  aave3: 'aave-v3',
  aave: 'aave-v3',
  aave2: 'aave-v2',

  // Morpho
  morpho: 'morpho',
  morpho_blue: 'morpho',
  morpho_aave: 'morpho',

  // Compound
  compound: 'compound-v3',
  compound3: 'compound-v3',

  // Other major protocols
  euler: 'euler',
  fluid: 'fluid',
  curve: 'curve',
  spark: 'spark',
  pendle2: 'pendle',
  pendle: 'pendle',
  uniswap3: 'uniswap-v3',
  uniswap_v3: 'uniswap-v3',
  maple: 'maple',
  lido: 'lido',
  cap_money: 'cap',
  dinari: 'dinari',
  dolomite: 'dolomite',
  yearn: 'yearn-finance',
  yearn2: 'yearn-finance',

  // Stablecoin issuers
  circle: 'usdc-reserve',
  tether: 'usdt-reserve',
  makerdao: 'maker',

  // Bridges & others
  across: 'across',
  stargate: 'stargate',
};

class DebankAdapter extends BaseAdapter {
  slug = 'debank';
  name = 'DeBank';
  isERC4626 = false;
  hasApi = true;
  chains = [
    Chain.ETHEREUM,
    Chain.ARBITRUM,
    Chain.AVALANCHE,
    Chain.BASE,
    Chain.POLYGON,
    Chain.OPTIMISM,
  ];

  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 500; // 500ms between requests
  private apiAvailable: boolean | null = null; // Track if API is available

  /**
   * Rate-limited fetch to avoid getting blocked
   */
  private async rateLimitedFetch<T>(url: string): Promise<T | null> {
    // Wait if needed
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.REQUEST_DELAY - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; RiskDashboard/1.0)',
        },
      });

      if (!response.ok) {
        console.warn(`[DebankAdapter] HTTP ${response.status} for ${url}`);
        return null;
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      console.warn(`[DebankAdapter] Fetch error for ${url}:`, error);
      return null;
    }
  }

  /**
   * Fetch addresses in a bundle
   */
  async fetchBundleAddresses(bundleId: string): Promise<string[]> {
    const cacheKey = `bundle-addrs:${bundleId}`;
    const cached = this.getCached<string[]>(cacheKey);
    if (cached) return cached;

    const url = `${DEBANK_API_BASE}/bundle/addr_list?bundle_id=${bundleId}`;
    const data = await this.rateLimitedFetch<{ data: DebankBundleAddress[] }>(url);

    if (!data?.data) {
      console.warn(`[DebankAdapter] No addresses found for bundle ${bundleId}`);
      return [];
    }

    const addresses = data.data.map((a) => a.user_addr);
    this.setCache(cacheKey, addresses, CACHE_TTL.configured); // Addresses don't change often
    console.log(
      `[DebankAdapter] Found ${addresses.length} addresses in bundle ${bundleId}`
    );
    return addresses;
  }

  /**
   * Fetch protocol positions for a single address
   */
  async fetchAddressProtocols(address: string): Promise<DebankProtocol[]> {
    const url = `${DEBANK_API_BASE}/user/project_list?user_addr=${address}`;
    const data = await this.rateLimitedFetch<{ data: DebankProtocol[] }>(url);
    return data?.data || [];
  }

  /**
   * Fetch all wallet token balances for an address
   */
  async fetchAddressTokens(
    address: string
  ): Promise<Array<{ symbol: string; amount: number; price: number; chain: string }>> {
    const url = `${DEBANK_API_BASE}/user/all_token_list?user_addr=${address}&is_all=true`;
    const data = await this.rateLimitedFetch<{
      data: Array<{ symbol: string; amount: number; price: number; chain: string }>;
    }>(url);
    return data?.data || [];
  }

  /**
   * Fetch complete portfolio for a bundle (aggregates all addresses)
   */
  async fetchBundlePortfolio(bundleId: string): Promise<BundlePortfolioData | null> {
    // Skip if we know API is unavailable
    if (this.apiAvailable === false) {
      console.log(`[DebankAdapter] Skipping bundle ${bundleId} - API unavailable, using configured fallback`);
      return null;
    }

    const cacheKey = `bundle-portfolio:${bundleId}`;
    const cached = this.getCached<BundlePortfolioData>(cacheKey);
    if (cached) {
      console.log(`[DebankAdapter] Using cached portfolio for bundle ${bundleId}`);
      return cached;
    }

    console.log(`[DebankAdapter] Fetching portfolio for bundle ${bundleId}...`);

    // Get addresses in bundle
    const addresses = await this.fetchBundleAddresses(bundleId);
    if (addresses.length === 0) {
      // Mark API as unavailable if we can't fetch addresses
      this.apiAvailable = false;
      console.log(`[DebankAdapter] DeBank API unavailable - will use configured allocations`);
      return null;
    }

    // API is working
    this.apiAvailable = true;

    const protocolAllocations = new Map<
      string,
      {
        protocol: string;
        name: string;
        valueUsd: number;
        percentage: number;
        positions: Array<{ name: string; valueUsd: number; tokens: string[] }>;
      }
    >();
    const tokenHoldings = new Map<string, { symbol: string; valueUsd: number }>();
    let totalValueUsd = 0;

    // Fetch data for each address (with rate limiting built in)
    for (const address of addresses) {
      // Fetch protocol positions
      const protocols = await this.fetchAddressProtocols(address);

      for (const protocol of protocols) {
        for (const item of protocol.portfolio_item_list) {
          const value = item.asset_usd_value;
          if (value < 100) continue; // Skip dust

          totalValueUsd += value;

          const existing = protocolAllocations.get(protocol.id);
          const tokens =
            item.detail.supply_token_list?.map((t) => t.symbol) || [];

          if (existing) {
            existing.valueUsd += value;
            existing.positions.push({
              name: item.name,
              valueUsd: value,
              tokens,
            });
          } else {
            protocolAllocations.set(protocol.id, {
              protocol: protocol.id,
              name: protocol.name,
              valueUsd: value,
              percentage: 0, // Calculated after totaling
              positions: [{ name: item.name, valueUsd: value, tokens }],
            });
          }
        }
      }

      // Fetch wallet token balances
      const tokens = await this.fetchAddressTokens(address);
      for (const token of tokens) {
        const value = token.price * token.amount;
        if (value < 100) continue; // Skip dust

        totalValueUsd += value;

        const existing = tokenHoldings.get(token.symbol);
        if (existing) {
          existing.valueUsd += value;
        } else {
          tokenHoldings.set(token.symbol, {
            symbol: token.symbol,
            valueUsd: value,
          });
        }
      }
    }

    // Calculate percentages
    for (const alloc of protocolAllocations.values()) {
      alloc.percentage =
        totalValueUsd > 0 ? (alloc.valueUsd / totalValueUsd) * 100 : 0;
    }

    const result: BundlePortfolioData = {
      bundleId,
      totalValueUsd,
      protocolAllocations,
      tokenHoldings,
      addresses,
      fetchedAt: new Date(),
    };

    this.setCache(cacheKey, result, CACHE_TTL.api);
    console.log(
      `[DebankAdapter] Fetched bundle ${bundleId}: $${totalValueUsd.toLocaleString()} across ${protocolAllocations.size} protocols`
    );

    return result;
  }

  /**
   * Convert bundle portfolio to our allocation format
   */
  portfolioToAllocations(portfolio: BundlePortfolioData): AllocationResult {
    const allocations: Allocation[] = [];

    // Convert protocol positions to allocations
    for (const [protocolId, data] of portfolio.protocolAllocations) {
      const slug = this.mapDebankProtocolToSlug(protocolId);
      const primaryToken = this.determinePrimaryAsset(data.positions);

      allocations.push({
        protocol: slug,
        market:
          data.positions.length > 0 ? data.positions[0].name : undefined,
        asset: primaryToken,
        percentage: data.percentage,
        valueUsd: data.valueUsd,
      });
    }

    // Add significant wallet token holdings as reserves
    for (const [symbol, holding] of portfolio.tokenHoldings) {
      const percentage =
        portfolio.totalValueUsd > 0
          ? (holding.valueUsd / portfolio.totalValueUsd) * 100
          : 0;

      if (percentage > 1) {
        // Only if > 1%
        const reserveSlug = this.tokenToReserveSlug(symbol);
        allocations.push({
          protocol: reserveSlug,
          asset: symbol,
          percentage,
          valueUsd: holding.valueUsd,
        });
      }
    }

    return {
      allocations: allocations.sort((a, b) => b.percentage - a.percentage),
      totalAssetsUsd: portfolio.totalValueUsd,
      source: 'api',
      timestamp: portfolio.fetchedAt,
    };
  }

  /**
   * Map DeBank protocol ID to our slug
   */
  private mapDebankProtocolToSlug(debankId: string): string {
    const normalized = debankId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    return DEBANK_PROTOCOL_MAP[normalized] || debankId;
  }

  /**
   * Determine primary asset from positions
   */
  private determinePrimaryAsset(
    positions: Array<{ tokens: string[] }>
  ): string | undefined {
    const tokenCounts = new Map<string, number>();
    for (const pos of positions) {
      for (const token of pos.tokens) {
        tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
      }
    }

    let maxToken: string | undefined;
    let maxCount = 0;
    for (const [token, count] of tokenCounts) {
      if (count > maxCount) {
        maxCount = count;
        maxToken = token;
      }
    }
    return maxToken;
  }

  /**
   * Map token symbol to reserve protocol slug
   */
  private tokenToReserveSlug(symbol: string): string {
    const upper = symbol.toUpperCase();
    if (upper === 'USDC') return 'usdc-reserve';
    if (upper === 'USDT') return 'usdt-reserve';
    if (upper === 'DAI') return 'dai-reserve';
    if (upper.includes('ETH')) return 'eth-reserve';
    if (upper.includes('BTC')) return 'btc-reserve';
    return `${symbol.toLowerCase()}-reserve`;
  }

  // ============== ProtocolAdapter Interface ==============

  async fetchAllocations(): Promise<AllocationResult | null> {
    // Standard adapter interface not used for DeBank
    // Use fetchBundleAllocations() instead
    return null;
  }

  async fetchTvl(): Promise<null> {
    // TVL comes from bundle portfolio
    return null;
  }

  /**
   * Fetch allocations for a known bundle by protocol slug
   */
  async fetchBundleAllocations(
    protocolSlug: string
  ): Promise<AllocationResult | null> {
    const bundleConfig = DEBANK_BUNDLES[protocolSlug];
    if (!bundleConfig) {
      return null;
    }

    const portfolio = await this.fetchBundlePortfolio(bundleConfig.bundleId);
    if (!portfolio) {
      return null;
    }

    return this.portfolioToAllocations(portfolio);
  }

  /**
   * Check if a protocol has a DeBank bundle
   */
  hasBundleFor(protocolSlug: string): boolean {
    return protocolSlug in DEBANK_BUNDLES;
  }

  /**
   * Get all supported bundle protocol slugs
   */
  getSupportedBundles(): string[] {
    return Object.keys(DEBANK_BUNDLES);
  }
}

// Export singleton
export const debankAdapter = new DebankAdapter();
