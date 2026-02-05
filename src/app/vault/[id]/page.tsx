'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RiskGraph } from '@/components/graph/RiskGraph';
import { RiskDetailPanel } from '@/components/panels/RiskDetailPanel';
import { useGraphStore } from '@/stores/graph-store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Network,
  AlertCircle,
  MoreHorizontal,
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
  const [showActions, setShowActions] = useState(false);

  const { setGraph, setAssessments, setExposures, graph, assessments } =
    useGraphStore();

  const fetchVaultData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vaults/${encodeURIComponent(vaultId)}/graph`);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

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

      const newExposures = new Map<string, number>();
      if (data.exposures) {
        for (const [id, exposure] of Object.entries(data.exposures)) {
          newExposures.set(id, exposure as number);
        }
      }

      setGraph(newGraph);
      setAssessments(newAssessments);
      setExposures(newExposures);
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
  const vaultTvl = rootEntity && isVaultEntity(rootEntity) ? (rootEntity as VaultEntity).tvl : 0;
  const vaultApy = rootEntity && isVaultEntity(rootEntity) ? (rootEntity as VaultEntity).apy : undefined;

  const formatTvl = (tvl: number) => {
    if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(2)}B`;
    if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`;
    if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(2)}K`;
    return `$${tvl.toFixed(2)}`;
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Simplified Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between shrink-0">
        {/* Left: Back + Name */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-600" />
            {rootEntity && (
              <span className="font-semibold">{rootEntity.name}</span>
            )}
          </div>
        </div>

        {/* Center: Key Metrics */}
        {rootEntity && (
          <div className="flex items-center gap-6">
            {vaultTvl > 0 && (
              <div className="text-center">
                <div className="text-xs text-gray-500">TVL</div>
                <div className="font-semibold">{formatTvl(vaultTvl)}</div>
              </div>
            )}
            {vaultApy !== undefined && (
              <div className="text-center">
                <div className="text-xs text-gray-500">APY</div>
                <div className="font-semibold text-green-600">{vaultApy.toFixed(2)}%</div>
              </div>
            )}
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowActions(!showActions)}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>

          {/* Simple dropdown */}
          {showActions && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowActions(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 py-1 min-w-[140px]">
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => {
                    handleRefresh();
                    setShowActions(false);
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => {
                    handleExport();
                    setShowActions(false);
                  }}
                >
                  <Download className="w-4 h-4" />
                  Export JSON
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph Area */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Loading...</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center max-w-sm">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                <p className="text-red-600 font-medium text-sm">{error}</p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button variant="outline" size="sm" onClick={() => router.push('/')}>
                    Back
                  </Button>
                  <Button size="sm" onClick={handleRefresh}>
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <RiskGraph />
          )}
        </div>

        {/* Side Panel */}
        <div className="w-80 border-l bg-white overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <RiskDetailPanel />
          )}
        </div>
      </div>
    </div>
  );
}
