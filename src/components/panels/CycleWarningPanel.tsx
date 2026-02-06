'use client';

import { useGraphStore } from '@/stores/graph-store';
import { CycleInfo, CycleExposure } from '@/types/core';

interface CycleWarningPanelProps {
  className?: string;
}

export function CycleWarningPanel({ className }: CycleWarningPanelProps) {
  const { cycles, cycleExposures, graph } = useGraphStore();

  if (cycles.length === 0) {
    return null;
  }

  // Get entity names for display
  const getEntityName = (entityId: string): string => {
    if (!graph) return entityId;
    const entity = graph.entities.get(entityId);
    if (entity) return entity.name;
    // Fallback: parse ID
    if (entityId.startsWith('protocol:')) {
      const slug = entityId.replace('protocol:', '');
      return slug.charAt(0).toUpperCase() + slug.slice(1);
    }
    return entityId;
  };

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-start gap-2">
        <svg
          className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-amber-800">
            Circular Dependency Detected
          </h4>
          <p className="text-xs text-amber-600 mt-0.5">
            Mutual exposure between protocols may amplify risk
          </p>

          <div className="mt-2 space-y-2">
            {cycles.map((cycle, idx) => {
              const cycleExp = cycleExposures[idx];
              const impactPercent = cycleExp
                ? ((1 / (1 - cycleExp.convergenceRatio) - 1) * 100).toFixed(2)
                : '0';

              return (
                <div
                  key={cycle.id}
                  className="bg-white rounded border border-amber-100 p-2"
                >
                  <div className="flex items-center gap-1.5 text-xs text-gray-700 flex-wrap">
                    {cycle.nodes.map((nodeId, i) => (
                      <span key={nodeId} className="flex items-center gap-1.5">
                        <span className="font-medium">{getEntityName(nodeId)}</span>
                        {i < cycle.nodes.length - 1 && (
                          <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </span>
                    ))}
                    <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-medium">{getEntityName(cycle.nodes[0])}</span>
                  </div>

                  {cycleExp && cycleExp.convergenceRatio > 0.001 && (
                    <div className="mt-1.5 text-xs text-amber-700">
                      Exposure amplification: +{impactPercent}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
