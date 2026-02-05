'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TokenEntity, RiskAssessment, riskLevelToColor } from '@/types/core';

interface TokenNodeData {
  entity: TokenEntity;
  riskAssessment?: RiskAssessment;
  exposure: number;
  exposurePercent?: number;
  isConsolidated?: boolean;
  isRoot: boolean;
  expanded: boolean;
}

interface TokenNodeProps {
  data: TokenNodeData;
  selected?: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export const TokenNode = memo(({ data, selected }: TokenNodeProps) => {
  const { entity, riskAssessment, exposure, exposurePercent, isConsolidated, isRoot } = data;
  const riskColor = riskAssessment ? riskLevelToColor(riskAssessment.overallLevel) : '#9CA3AF';

  return (
    <div
      className={`
        px-3 py-2 rounded-lg bg-white border shadow-sm
        min-w-[80px] max-w-[100px]
        transition-all duration-150
        ${selected ? 'ring-2 ring-blue-500' : ''}
        ${isRoot ? 'border-2 border-gray-400' : 'border-gray-200'}
      `}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-gray-300" />

      {/* Entity type indicator + Symbol */}
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <span className="font-medium text-xs">{entity.symbol}</span>
      </div>

      {/* Exposure - Key metric */}
      {exposure > 0 && (
        <div className="text-sm font-semibold text-gray-900">
          {isConsolidated && exposurePercent !== undefined ? (
            <span className="text-blue-600">{exposurePercent.toFixed(1)}%</span>
          ) : (
            formatCurrency(exposure)
          )}
        </div>
      )}

      {/* Risk indicator dot */}
      {riskAssessment && (
        <div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
          style={{ backgroundColor: riskColor }}
        />
      )}

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-300" />
    </div>
  );
});

TokenNode.displayName = 'TokenNode';
