'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RiskGraph } from '@/components/graph/RiskGraph';
import { RiskDetailPanel } from '@/components/panels/RiskDetailPanel';
import { useGraphStore } from '@/stores/graph-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Network,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { DependencyGraph, RiskAssessment, VaultEntity, isVaultEntity } from '@/types/core';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function VaultPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const vaultId = decodeURIComponent(resolvedParams.id);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'live' | 'cached'>('live');

  const { setGraph, setAssessments, setExposures, graph, assessments, selectedNodeId } =
    useGraphStore();

  const fetchVaultData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch from our API which uses live data
      const response = await fetch(`/api/vaults/${encodeURIComponent(vaultId)}/graph`);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Reconstruct graph and assessments from API response
      const graphEntities = new Map<string, typeof data.graph.entities[0]['entity']>();
      for (const { id, entity } of data.graph.entities) {
        graphEntities.set(id, entity);
      }

      const newGraph: DependencyGraph = {
        entities: graphEntities,
        edges: data.graph.edges,
        rootEntityId: data.rootEntityId,
      };

      const newAssessments = new Map<string, RiskAssessment>();
      for (const [id, assessment] of Object.entries(data.riskAssessments)) {
        newAssessments.set(id, assessment as RiskAssessment);
      }

      // Process exposures (USD exposure from root vault to each entity)
      const newExposures = new Map<string, number>();
      if (data.exposures) {
        for (const [id, exposure] of Object.entries(data.exposures)) {
          newExposures.set(id, exposure as number);
        }
      }

      setGraph(newGraph);
      setAssessments(newAssessments);
      setExposures(newExposures);
      setDataSource(data.cached ? 'cached' : 'live');
    } catch (err) {
      console.error('Error loading vault data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load vault data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVaultData();
  }, [vaultId]);

  const handleRefresh = () => {
    fetchVaultData();
  };

  const handleExport = () => {
    if (!graph) return;

    const exportData = {
      vaultId,
      timestamp: new Date().toISOString(),
      dataSource,
      entities: Array.from(graph.entities.entries()),
      edges: graph.edges,
      assessments: Array.from(assessments.entries()),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk-analysis-${vaultId.replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rootEntity = graph?.entities.get(vaultId);
  const rootAssessment = assessments.get(vaultId);

  // Get TVL and APY from vault entity
  const vaultTvl = rootEntity && isVaultEntity(rootEntity) ? (rootEntity as VaultEntity).tvl : 0;
  const vaultApy = rootEntity && isVaultEntity(rootEntity) ? (rootEntity as VaultEntity).apy : undefined;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-600" />
            <span className="font-semibold">Tiramisu Risk</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {rootEntity && (
            <div className="flex items-center gap-3">
              <div>
                <span className="font-medium">{rootEntity.name}</span>
                {vaultTvl > 0 && (
                  <span className="ml-2 text-sm text-gray-500">
                    TVL: ${(vaultTvl / 1_000_000).toFixed(2)}M
                  </span>
                )}
                {vaultApy !== undefined && (
                  <span className="ml-2 text-sm text-green-600">
                    APY: {vaultApy.toFixed(2)}%
                  </span>
                )}
              </div>
              {rootAssessment && (
                <Badge
                  variant={
                    rootAssessment.overallLevel === 'critical' ||
                    rootAssessment.overallLevel === 'high'
                      ? 'destructive'
                      : rootAssessment.overallLevel === 'medium'
                        ? 'secondary'
                        : 'outline'
                  }
                  className="capitalize"
                >
                  {rootAssessment.overallLevel} Risk (
                  {Math.round(rootAssessment.overallScore)})
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {dataSource === 'live' ? '🟢 Live' : '📦 Cached'}
              </Badge>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            {rootEntity?.address && (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href={`https://etherscan.io/address/${rootEntity.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Etherscan
                </a>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph Area */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
                <p className="text-gray-500">Loading live data from DeFiLlama...</p>
                <p className="text-gray-400 text-sm mt-1">Fetching TVL, APY, and protocol data</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 font-medium">{error}</p>
                <p className="text-gray-500 text-sm mt-2">
                  The vault may not be in our registry or the DeFiLlama API may be unavailable.
                </p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button variant="outline" onClick={() => router.push('/')}>
                    Go Back
                  </Button>
                  <Button onClick={handleRefresh}>
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <RiskGraph />
          )}
        </div>

        {/* Side Panel */}
        <div className="w-96 border-l bg-white overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <RiskDetailPanel />
          )}
        </div>
      </div>
    </div>
  );
}
