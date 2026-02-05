'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Network, Loader2 } from 'lucide-react';
import { TRACKED_VAULTS, TrackedVault } from '@/lib/vault-registry';

// All vault IDs for the unified list
const ALL_VAULT_IDS = [
  'infinifi:siusd:ethereum',
  'infinifi:liusd:ethereum',
  'rexyz:reusd:ethereum',
  'rexyz:reusde:ethereum',
  'reservoir:rusd:ethereum',
  'reservoir:srusd:ethereum',
  'resolv:usr:ethereum',
  'resolv:rlp:ethereum',
  'yuzu:yzusd:ethereum',
  'yuzu:syzusd:ethereum',
  'avant:savusd:avalanche',
  'noon:susn:ethereum',
  'yieldnest:yneth:ethereum',
  'yieldnest:ynethx:ethereum',
  'ethena:susde:ethereum',
  'cap:stcusd:ethereum',
  'yearn:yvUSDC:ethereum',
  'yearn:yvDAI:ethereum',
  'yearn:yvWETH:ethereum',
  'morpho:steakhouse-usdc:ethereum',
  'morpho:gauntlet-usdc:ethereum',
  'morpho:yearn-usdc:base',
  'morpho:re7-weth:ethereum',
  'aave:usdc:ethereum',
  'aave:weth:ethereum',
  'compound:usdc:ethereum',
  'euler:usdc:ethereum',
  'sommelier:turbo-steth:ethereum',
  'sommelier:real-yield-usd:ethereum',
];

interface VaultWithLiveData extends TrackedVault {
  liveData?: {
    tvl: number;
    apy: number | null;
  } | null;
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [vaultsWithData, setVaultsWithData] = useState<Map<string, VaultWithLiveData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [protocolFilter, setProtocolFilter] = useState<string>('all');
  const router = useRouter();

  // Fetch live data for vaults
  useEffect(() => {
    async function fetchLiveData() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/vaults/live');
        if (response.ok) {
          const data = await response.json();
          const vaultMap = new Map<string, VaultWithLiveData>();

          // Initialize with tracked vaults
          TRACKED_VAULTS.forEach(vault => {
            vaultMap.set(vault.id, vault);
          });

          // Merge live data
          if (data.data) {
            for (const vault of data.data) {
              const existing = vaultMap.get(vault.id);
              if (existing) {
                vaultMap.set(vault.id, {
                  ...existing,
                  liveData: vault.liveData,
                });
              }
            }
          }

          setVaultsWithData(vaultMap);
        }
      } catch (error) {
        console.error('Error fetching live data:', error);
        // Fall back to static data
        const vaultMap = new Map<string, VaultWithLiveData>();
        TRACKED_VAULTS.forEach(vault => {
          vaultMap.set(vault.id, vault);
        });
        setVaultsWithData(vaultMap);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLiveData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/vault/${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleVaultClick = (vaultId: string) => {
    router.push(`/vault/${encodeURIComponent(vaultId)}`);
  };

  // Get unique protocols for filter
  const protocols = useMemo(() => {
    const protocolSet = new Set<string>();
    ALL_VAULT_IDS.forEach(id => {
      const vault = vaultsWithData.get(id);
      if (vault) protocolSet.add(vault.protocol);
    });
    return Array.from(protocolSet).sort();
  }, [vaultsWithData]);

  // Filter vaults
  const filteredVaults = useMemo(() => {
    return ALL_VAULT_IDS
      .map(id => vaultsWithData.get(id))
      .filter((v): v is VaultWithLiveData => {
        if (!v) return false;
        if (protocolFilter !== 'all' && v.protocol !== protocolFilter) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            v.name.toLowerCase().includes(query) ||
            v.protocol.toLowerCase().includes(query) ||
            v.id.toLowerCase().includes(query)
          );
        }
        return true;
      });
  }, [vaultsWithData, protocolFilter, searchQuery]);

  const formatTvl = (tvl: number | undefined) => {
    if (!tvl) return '-';
    if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(2)}B`;
    if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`;
    if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(2)}K`;
    return `$${tvl.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Compact Header */}
      <header className="border-b px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-6 h-6 text-blue-600" />
            <span className="font-semibold text-lg">Tiramisu Risk</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Large Search Bar - Primary Focus */}
        <div className="max-w-2xl mx-auto mb-12">
          <h1 className="text-2xl font-semibold text-center text-gray-900 mb-6">
            DeFi Vault Risk Analysis
          </h1>
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search vaults or enter vault ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg rounded-xl border-gray-200 shadow-sm"
              />
              <Button
                type="submit"
                size="lg"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10"
              >
                Analyze
              </Button>
            </div>
          </form>
        </div>

        {/* Filter */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500">
            {filteredVaults.length} vaults
          </span>
          <Select value={protocolFilter} onValueChange={setProtocolFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Protocols" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Protocols</SelectItem>
              {protocols.map(protocol => (
                <SelectItem key={protocol} value={protocol}>
                  {protocol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vault Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading...</span>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b text-left text-sm text-gray-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Protocol</th>
                  <th className="px-4 py-3 font-medium">Chain</th>
                  <th className="px-4 py-3 font-medium text-right">TVL</th>
                  <th className="px-4 py-3 font-medium text-right">APY</th>
                </tr>
              </thead>
              <tbody>
                {filteredVaults.map((vault) => (
                  <tr
                    key={vault.id}
                    onClick={() => handleVaultClick(vault.id)}
                    className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{vault.name}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{vault.protocol}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize text-xs">
                        {vault.chain}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatTvl(vault.liveData?.tvl)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-green-600">
                        {vault.liveData?.apy !== null && vault.liveData?.apy !== undefined
                          ? `${vault.liveData.apy.toFixed(2)}%`
                          : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t py-6 mt-12">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          DeFi Vault Risk Dependency Analysis
        </div>
      </footer>
    </div>
  );
}
