'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { VaultEntity, RiskAssessment, riskLevelToColor } from '@/types/core';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface VaultNodeData {
  entity: VaultEntity;
  riskAssessment?: RiskAssessment;
  exposure: number; // USD exposure from root vault
  isRoot: boolean;
  expanded: boolean;
}

interface VaultNodeProps {
  data: VaultNodeData;
  selected?: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export const VaultNode = memo(({ data, selected }: VaultNodeProps) => {
  const { entity, riskAssessment, isRoot } = data;
  const borderColor = riskAssessment
    ? riskLevelToColor(riskAssessment.overallLevel)
    : '#9CA3AF';

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 bg-white shadow-md
        min-w-[220px] max-w-[280px]
        transition-all duration-200
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
        ${isRoot ? 'border-4' : ''}
      `}
      style={{ borderColor }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-gray-400"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {entity.metadata.logo && (
          <img
            src={entity.metadata.logo as string}
            alt={entity.name}
            className="w-6 h-6 rounded-full"
          />
        )}
        <span className="font-semibold text-sm truncate flex-1">
          {entity.name}
        </span>
        {isRoot && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            ROOT
          </Badge>
        )}
      </div>

      {/* Vault Info */}
      <div className="text-xs text-gray-600 space-y-1">
        <div className="flex justify-between">
          <span>TVL:</span>
          <span className="font-medium">{formatCurrency(entity.tvl)}</span>
        </div>
        {entity.apy !== undefined && (
          <div className="flex justify-between">
            <span>APY:</span>
            <span className="font-medium text-green-600">
              {formatPercent(entity.apy)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Underlying:</span>
          <span className="font-medium">{entity.underlying.symbol}</span>
        </div>
        <div className="flex justify-between">
          <span>Strategies:</span>
          <span className="font-medium">{entity.strategies.length}</span>
        </div>
      </div>

      {/* Risk Score */}
      {riskAssessment && (
        <div className="mt-3 pt-2 border-t">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-gray-600">Risk Score</span>
            <span
              className="text-sm font-bold"
              style={{ color: borderColor }}
            >
              {Math.round(riskAssessment.overallScore)}
            </span>
          </div>
          <Progress
            value={riskAssessment.overallScore}
            className="h-2"
          />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-gray-400"
      />
    </div>
  );
});

VaultNode.displayName = 'VaultNode';
