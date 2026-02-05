'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Entity,
  EntityType,
  RiskAssessment,
  riskLevelToColor,
} from '@/types/core';
import { Badge } from '@/components/ui/badge';

interface GenericNodeData {
  entity: Entity;
  riskAssessment?: RiskAssessment;
  exposure: number; // USD exposure from root vault
  isRoot: boolean;
  expanded: boolean;
}

interface GenericNodeProps {
  data: GenericNodeData;
  selected?: boolean;
}

const entityTypeConfig: Record<
  EntityType,
  { bg: string; label: string; badgeColor: string }
> = {
  [EntityType.VAULT]: {
    bg: 'bg-white',
    label: 'Vault',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  [EntityType.PROTOCOL]: {
    bg: 'bg-blue-50',
    label: 'Protocol',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  [EntityType.TOKEN]: {
    bg: 'bg-green-50',
    label: 'Token',
    badgeColor: 'bg-green-100 text-green-700',
  },
  [EntityType.ORACLE]: {
    bg: 'bg-yellow-50',
    label: 'Oracle',
    badgeColor: 'bg-yellow-100 text-yellow-700',
  },
  [EntityType.ISSUER]: {
    bg: 'bg-orange-50',
    label: 'Issuer',
    badgeColor: 'bg-orange-100 text-orange-700',
  },
  [EntityType.BRIDGE]: {
    bg: 'bg-purple-50',
    label: 'Bridge',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
  [EntityType.GOVERNANCE]: {
    bg: 'bg-pink-50',
    label: 'Governance',
    badgeColor: 'bg-pink-100 text-pink-700',
  },
  [EntityType.CUSTODIAN]: {
    bg: 'bg-red-50',
    label: 'Custodian',
    badgeColor: 'bg-red-100 text-red-700',
  },
};

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

export const GenericNode = memo(({ data, selected }: GenericNodeProps) => {
  const { entity, riskAssessment, exposure, isRoot } = data;
  const borderColor = riskAssessment
    ? riskLevelToColor(riskAssessment.overallLevel)
    : '#9CA3AF';

  const config = entityTypeConfig[entity.type] ?? {
    bg: 'bg-gray-50',
    label: entity.type,
    badgeColor: 'bg-gray-100 text-gray-700',
  };

  return (
    <div
      className={`
        px-3 py-2 rounded-lg border-2 ${config.bg} shadow-md
        min-w-[140px] max-w-[200px]
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
            alt={entity.name}
            className="w-4 h-4 rounded-full"
          />
        )}
        <span className="font-semibold text-xs truncate flex-1">
          {entity.name}
        </span>
      </div>

      {/* Exposure */}
      {exposure > 0 && (
        <div className="text-xs font-medium text-gray-700 mb-1">
          {formatCurrency(exposure)}
        </div>
      )}

      {/* Type Badge */}
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 ${config.badgeColor}`}
      >
        {config.label}
      </Badge>

      {/* Risk Indicator */}
      {riskAssessment && (
        <div className="mt-2 flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: borderColor }}
          />
          <span className="text-[10px] text-gray-600">
            {Math.round(riskAssessment.overallScore)}
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

GenericNode.displayName = 'GenericNode';
