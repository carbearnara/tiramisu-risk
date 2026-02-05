'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Entity, EntityType, RiskAssessment, riskLevelToColor } from '@/types/core';

interface GenericNodeData {
  entity: Entity;
  riskAssessment?: RiskAssessment;
  exposure: number;
  isRoot: boolean;
  expanded: boolean;
}

interface GenericNodeProps {
  data: GenericNodeData;
  selected?: boolean;
}

// Entity type colors
const entityTypeColors: Record<EntityType, string> = {
  [EntityType.VAULT]: 'bg-blue-500',
  [EntityType.PROTOCOL]: 'bg-purple-500',
  [EntityType.TOKEN]: 'bg-green-500',
  [EntityType.ORACLE]: 'bg-yellow-500',
  [EntityType.ISSUER]: 'bg-amber-500',
  [EntityType.BRIDGE]: 'bg-indigo-500',
  [EntityType.GOVERNANCE]: 'bg-pink-500',
  [EntityType.CUSTODIAN]: 'bg-red-500',
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export const GenericNode = memo(({ data, selected }: GenericNodeProps) => {
  const { entity, riskAssessment, exposure, isRoot } = data;
  const riskColor = riskAssessment ? riskLevelToColor(riskAssessment.overallLevel) : '#9CA3AF';
  const dotColor = entityTypeColors[entity.type] || 'bg-gray-500';

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

      {/* Entity type indicator + Name */}
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
        <span className="font-medium text-xs truncate">{entity.name}</span>
      </div>

      {/* Exposure - Key metric (only if > 0) */}
      {exposure > 0 && (
        <div className="text-sm font-semibold text-gray-900">
          {formatCurrency(exposure)}
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

GenericNode.displayName = 'GenericNode';
