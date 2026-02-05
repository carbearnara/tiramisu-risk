// Allocation Discovery Service
// Automatically discovers and validates vault allocations via DeBank

import { debankAdapter, DEBANK_BUNDLES } from '@/adapters/debank-adapter';
import { AllocationResult, Allocation, ConfiguredAllocation } from '@/adapters/types';
import { TRACKED_VAULTS } from '@/lib/vault-registry';

// ============== TYPES ==============

export interface AllocationDiscrepancy {
  protocol: string;
  configuredPct: number;
  discoveredPct: number;
  difference: number;
  severity: 'critical' | 'warning' | 'info';
}

export interface AllocationDiscoveryResult {
  vaultId: string;
  protocolSlug: string;
  configured: ConfiguredAllocation[];
  discovered: Allocation[];
  discrepancies: AllocationDiscrepancy[];
  confidence: 'high' | 'medium' | 'low';
  totalDiscoveredUsd: number;
  lastUpdated: Date;
}

// ============== SERVICE ==============

class AllocationDiscoveryService {
  private discoveryCache = new Map<string, AllocationDiscoveryResult>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Discover allocations for a vault using DeBank
   */
  async discoverAllocations(vaultId: string): Promise<AllocationDiscoveryResult | null> {
    // Check cache
    const cached = this.discoveryCache.get(vaultId);
    if (cached && Date.now() - cached.lastUpdated.getTime() < this.CACHE_TTL) {
      return cached;
    }

    // Find vault config
    const vault = TRACKED_VAULTS.find((v) => v.id === vaultId);
    if (!vault) {
      console.warn(`[AllocationDiscovery] Vault not found: ${vaultId}`);
      return null;
    }

    const protocolSlug = vault.protocolSlug;

    // Check if this protocol has a DeBank bundle
    if (!debankAdapter.hasBundleFor(protocolSlug)) {
      console.log(`[AllocationDiscovery] No DeBank bundle for ${protocolSlug}`);
      return null;
    }

    // Fetch from DeBank
    console.log(`[AllocationDiscovery] Discovering allocations for ${vaultId}...`);
    const debankResult = await debankAdapter.fetchBundleAllocations(protocolSlug);

    if (!debankResult) {
      console.warn(`[AllocationDiscovery] DeBank fetch failed for ${protocolSlug}`);
      return null;
    }

    // Compare with configured
    const configured = vault.strategyAllocations || [];
    const discovered = debankResult.allocations;
    const discrepancies = this.compareAllocations(configured, discovered);

    const result: AllocationDiscoveryResult = {
      vaultId,
      protocolSlug,
      configured,
      discovered,
      discrepancies,
      confidence: this.calculateConfidence(discrepancies, discovered.length),
      totalDiscoveredUsd: debankResult.totalAssetsUsd,
      lastUpdated: new Date(),
    };

    // Cache result
    this.discoveryCache.set(vaultId, result);

    console.log(
      `[AllocationDiscovery] ${vaultId}: ${discovered.length} allocations discovered, ` +
        `${discrepancies.length} discrepancies (confidence: ${result.confidence})`
    );

    return result;
  }

  /**
   * Compare configured vs discovered allocations
   */
  private compareAllocations(
    configured: ConfiguredAllocation[],
    discovered: Allocation[]
  ): AllocationDiscrepancy[] {
    const discrepancies: AllocationDiscrepancy[] = [];

    // Build maps for comparison
    const discoveredMap = new Map<string, number>();
    for (const d of discovered) {
      const existing = discoveredMap.get(d.protocol) || 0;
      discoveredMap.set(d.protocol, existing + d.percentage);
    }

    const configuredMap = new Map<string, number>();
    for (const c of configured) {
      const existing = configuredMap.get(c.protocol) || 0;
      configuredMap.set(c.protocol, existing + c.allocation);
    }

    // Check all configured protocols
    for (const [protocol, configPct] of configuredMap) {
      const discPct = discoveredMap.get(protocol) || 0;
      const diff = Math.abs(configPct - discPct);

      if (diff > 2) {
        // 2% threshold
        discrepancies.push({
          protocol,
          configuredPct: configPct,
          discoveredPct: discPct,
          difference: diff,
          severity: this.getSeverity(diff, discPct === 0),
        });
      }
    }

    // Check for discovered protocols not in config
    for (const [protocol, discPct] of discoveredMap) {
      if (!configuredMap.has(protocol) && discPct > 2) {
        discrepancies.push({
          protocol,
          configuredPct: 0,
          discoveredPct: discPct,
          difference: discPct,
          severity: this.getSeverity(discPct, true),
        });
      }
    }

    return discrepancies.sort((a, b) => b.difference - a.difference);
  }

  /**
   * Determine severity of a discrepancy
   */
  private getSeverity(
    difference: number,
    isMissing: boolean
  ): 'critical' | 'warning' | 'info' {
    if (isMissing && difference > 10) return 'critical';
    if (difference > 15) return 'critical';
    if (difference > 5) return 'warning';
    return 'info';
  }

  /**
   * Calculate confidence level based on discrepancies
   */
  private calculateConfidence(
    discrepancies: AllocationDiscrepancy[],
    discoveredCount: number
  ): 'high' | 'medium' | 'low' {
    if (discoveredCount === 0) return 'low';

    const criticalCount = discrepancies.filter((d) => d.severity === 'critical').length;
    const warningCount = discrepancies.filter((d) => d.severity === 'warning').length;

    if (criticalCount > 0) return 'low';
    if (warningCount > 2) return 'medium';
    return 'high';
  }

  /**
   * Get best available allocations
   * Prefers discovered data if confidence is high, otherwise uses configured
   */
  async getBestAllocations(
    vaultId: string,
    preferDiscovered: boolean = true
  ): Promise<AllocationResult | null> {
    const vault = TRACKED_VAULTS.find((v) => v.id === vaultId);
    if (!vault) return null;

    // Try discovery if we prefer discovered data
    if (preferDiscovered) {
      const discovery = await this.discoverAllocations(vaultId);

      if (discovery && discovery.confidence !== 'low') {
        return {
          allocations: discovery.discovered,
          totalAssetsUsd: discovery.totalDiscoveredUsd,
          source: 'api',
          timestamp: discovery.lastUpdated,
        };
      }
    }

    // Fall back to configured
    const configured = vault.strategyAllocations;
    if (!configured || configured.length === 0) {
      return null;
    }

    return {
      allocations: configured.map((c) => ({
        protocol: c.protocol,
        market: c.market,
        asset: c.asset,
        percentage: c.allocation,
      })),
      totalAssetsUsd: 0,
      source: 'configured',
      timestamp: new Date(),
    };
  }

  /**
   * Discover allocations for all vaults with DeBank bundles
   */
  async discoverAllBundles(): Promise<AllocationDiscoveryResult[]> {
    const results: AllocationDiscoveryResult[] = [];
    const bundleSlugs = debankAdapter.getSupportedBundles();

    for (const slug of bundleSlugs) {
      // Find vaults for this protocol
      const vaults = TRACKED_VAULTS.filter((v) => v.protocolSlug === slug);

      for (const vault of vaults) {
        const result = await this.discoverAllocations(vault.id);
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Get summary of all discrepancies across vaults
   */
  async getDiscrepancySummary(): Promise<{
    totalVaults: number;
    vaultsWithDiscrepancies: number;
    criticalDiscrepancies: number;
    warningDiscrepancies: number;
    details: Array<{
      vaultId: string;
      discrepancies: AllocationDiscrepancy[];
    }>;
  }> {
    const allResults = await this.discoverAllBundles();

    let criticalCount = 0;
    let warningCount = 0;
    const details: Array<{
      vaultId: string;
      discrepancies: AllocationDiscrepancy[];
    }> = [];

    for (const result of allResults) {
      if (result.discrepancies.length > 0) {
        details.push({
          vaultId: result.vaultId,
          discrepancies: result.discrepancies,
        });

        for (const d of result.discrepancies) {
          if (d.severity === 'critical') criticalCount++;
          else if (d.severity === 'warning') warningCount++;
        }
      }
    }

    return {
      totalVaults: allResults.length,
      vaultsWithDiscrepancies: details.length,
      criticalDiscrepancies: criticalCount,
      warningDiscrepancies: warningCount,
      details,
    };
  }

  /**
   * Clear discovery cache
   */
  clearCache(): void {
    this.discoveryCache.clear();
  }
}

// Export singleton
export const allocationDiscovery = new AllocationDiscoveryService();
