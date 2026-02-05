'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TokenEntity, RiskAssessment, riskLevelToColor } from '@/types/core';
import { Badge } from '@/components/ui/badge';

interface TokenNodeData {
  entity: TokenEntity;
  riskAssessment?: RiskAssessment;
  exposure: number; // USD exposure from root vault
  isRoot: boolean;
  expanded: boolean;
}

interface TokenNodeProps {
  data: TokenNodeData;
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

export const TokenNode = memo(({ data, selected }: TokenNodeProps) => {
  const { entity, riskAssessment, exposure, isRoot } = data;
  const borderColor = riskAssessment
    ? riskLevelToColor(riskAssessment.overallLevel)
    : '#9CA3AF';

  const tokenTypeColors: Record<string, string> = {
    stablecoin: 'bg-green-100 text-green-700',
    native: 'bg-purple-100 text-purple-700',
    wrapped: 'bg-orange-100 text-orange-700',
    lst: 'bg-cyan-100 text-cyan-700',
    lrt: 'bg-teal-100 text-teal-700',
    governance: 'bg-yellow-100 text-yellow-700',
    other: 'bg-gray-100 text-gray-700',
  };

  return (
    <div
      className={`
        px-3 py-2 rounded-lg border-2 bg-green-50 shadow-md
        min-w-[140px] max-w-[180px]
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
      <div className="flex items-center gap-2 mb-1">
        {entity.metadata.logo && (
          <img
            src={entity.metadata.logo as string}
            alt={entity.symbol}
            className="w-5 h-5 rounded-full"
          />
        )}
        <span className="font-bold text-sm">{entity.symbol}</span>
      </div>

      {/* Exposure */}
      {exposure > 0 && (
        <div className="text-xs font-medium text-green-700 mb-1">
          {formatCurrency(exposure)}
        </div>
      )}

      {/* Token Type Badge */}
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 ${
          tokenTypeColors[entity.tokenType] ?? tokenTypeColors.other
        }`}
      >
        {entity.tokenType.toUpperCase()}
      </Badge>

      {/* Peg Info */}
      {entity.peggedTo && (
        <div className="mt-1 text-[10px] text-gray-500">
          Pegged to {entity.peggedTo}
        </div>
      )}

      {/* Risk Indicator */}
      {riskAssessment && (
        <div className="mt-2 flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: borderColor }}
          />
          <span className="text-[10px] text-gray-600">
            Score: {Math.round(riskAssessment.overallScore)}
          </span>
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

TokenNode.displayName = 'TokenNode';
