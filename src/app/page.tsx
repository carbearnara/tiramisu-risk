'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, TrendingUp, Shield, Network, ExternalLink, Loader2 } from 'lucide-react';
import { TRACKED_VAULTS, TrackedVault } from '@/lib/vault-registry';

// Group vaults by category
const VAULT_CATEGORIES = {
  'Tracked Portfolios': [
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
  ],
  'Yearn Vaults': [
    'yearn:yvUSDC:ethereum',
    'yearn:yvDAI:ethereum',
    'yearn:yvWETH:ethereum',
  ],
  'Morpho Vaults': [
    'morpho:steakhouse-usdc:ethereum',
    'morpho:gauntlet-usdc:ethereum',
    'morpho:yearn-usdc:base',
    'morpho:re7-weth:ethereum',
  ],
  'Lending Protocols': [
    'aave:usdc:ethereum',
    'aave:weth:ethereum',
    'compound:usdc:ethereum',
    'euler:usdc:ethereum',
  ],
  'Sommelier': [
    'sommelier:turbo-steth:ethereum',
    'sommelier:real-yield-usd:ethereum',
  ],
};

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
  const [activeTab, setActiveTab] = useState('Tracked Portfolios');
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

  const getVaultsForCategory = (category: string): VaultWithLiveData[] => {
    const vaultIds = VAULT_CATEGORIES[category as keyof typeof VAULT_CATEGORIES] || [];
    return vaultIds
      .map(id => vaultsWithData.get(id))
      .filter((v): v is VaultWithLiveData => v !== undefined);
  };

  const formatTvl = (tvl: number | undefined) => {
    if (!tvl) return '-';
    if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(2)}B`;
    if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`;
    if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(2)}K`;
    return `$${tvl.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold">Tiramisu Risk</span>
              <Badge variant="outline" className="ml-2">
                Live Data
              </Badge>
            </div>
            <nav className="flex items-center gap-4">
              <a href="#features" className="text-sm text-gray-600 hover:text-gray-900">
                Features
              </a>
              <a href="#about" className="text-sm text-gray-600 hover:text-gray-900">
                About
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            DeFi Vault Risk Analysis
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Visualize risk dependencies for yield-bearing stablecoins and DeFi vaults.
            Track infiniFi, Resolv, Yuzu, Avant, Noon, YieldNest, and more.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-12">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Enter vault ID (e.g., infinifi:siusd:ethereum)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-lg"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 px-8">
              Analyze
            </Button>
          </div>
        </form>

        {/* Vault Categories */}
        <section className="mb-16">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 flex flex-wrap justify-center">
              {Object.keys(VAULT_CATEGORIES).map((category) => (
                <TabsTrigger key={category} value={category} className="text-sm">
                  {category}
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {VAULT_CATEGORIES[category as keyof typeof VAULT_CATEGORIES].length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.keys(VAULT_CATEGORIES).map((category) => (
              <TabsContent key={category} value={category}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="ml-2 text-gray-500">Loading live data...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getVaultsForCategory(category).map((vault) => (
                      <Card
                        key={vault.id}
                        className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-blue-500"
                        onClick={() => handleVaultClick(vault.id)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{vault.name}</CardTitle>
                            <Badge variant="outline" className="capitalize">
                              {vault.chain}
                            </Badge>
                          </div>
                          <CardDescription className="flex items-center gap-2">
                            {vault.protocol}
                            {vault.curator && (
                              <span className="text-xs text-gray-400">
                                • Curator: {vault.curator}
                              </span>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-500">Underlying</span>
                            <span className="font-medium">{vault.underlying}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-500">TVL</span>
                            <span className="font-medium">
                              {formatTvl(vault.liveData?.tvl)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-500">APY</span>
                            <span className="font-medium text-green-600">
                              {vault.liveData?.apy !== null && vault.liveData?.apy !== undefined
                                ? `${vault.liveData.apy.toFixed(2)}%`
                                : '-'}
                            </span>
                          </div>
                          {vault.strategies && vault.strategies.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {vault.strategies.slice(0, 3).map((strategy) => (
                                <Badge key={strategy} variant="secondary" className="text-xs">
                                  {strategy}
                                </Badge>
                              ))}
                              {vault.strategies.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{vault.strategies.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </section>

        {/* Features */}
        <section id="features" className="py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Risk Categories Analyzed
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Smart Contract Risk"
              description="Audit status, incident history, code maturity, and upgradability analysis"
            />
            <FeatureCard
              icon={<TrendingUp className="w-6 h-6" />}
              title="Counterparty Risk"
              description="Token issuer risks, custodian exposure, and centralization concerns"
            />
            <FeatureCard
              icon={<Network className="w-6 h-6" />}
              title="N-Order Dependencies"
              description="Trace nested vault structures and hidden concentration risks through delta-neutral strategies"
            />
          </div>
        </section>

        {/* Tracked Protocols Info */}
        <section className="py-16 border-t">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Tracked Yield Protocols
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-center">
            {['infiniFi', 'Re.xyz', 'Reservoir', 'Resolv', 'Yuzu', 'Avant', 'Noon', 'YieldNest', 'Ethena', 'Yearn', 'Morpho', 'Aave', 'Pendle', 'Euler'].map((protocol) => (
              <div key={protocol} className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <span className="font-medium text-gray-700">{protocol}</span>
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section id="about" className="py-16 border-t">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              About Tiramisu Risk
            </h2>
            <p className="text-gray-600 mb-4">
              When holding yield-bearing stablecoins like siUSD (infiniFi), USR (Resolv),
              or yzUSD (Yuzu), you&apos;re exposed to multiple layers of risk: the protocol operator,
              underlying strategies (delta-neutral positions, lending protocols), asset issuers,
              oracles, and more. This tool helps you visualize and quantify those dependencies.
            </p>
            <p className="text-gray-600 mb-6">
              Built using graph-based risk modeling inspired by{' '}
              <a
                href="https://dialectic.com/editorial/nebula-defi-graph-1"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Dialectic&apos;s Nebula
              </a>
              , with live data from DeFiLlama.
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://defillama.com/yields"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <ExternalLink className="w-4 h-4" />
                DeFiLlama Yields
              </a>
              <a
                href="https://debank.com/bundles"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <ExternalLink className="w-4 h-4" />
                DeBank Bundles
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-blue-600" />
              <span className="font-semibold">Tiramisu Risk</span>
            </div>
            <p className="text-sm text-gray-500">
              DeFi Vault Risk Dependency Analysis • Live Data from DeFiLlama
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 mb-2">
          {icon}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 text-sm">{description}</p>
      </CardContent>
    </Card>
  );
}
