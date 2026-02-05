'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ProtocolEntity, RiskAssessment, riskLevelToColor } from '@/types/core';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ProtocolNodeData {
  entity: ProtocolEntity;
  riskAssessment?: RiskAssessment;
  exposure: number; // USD exposure from root vault
  isRoot: boolean;
  expanded: boolean;
}

interface ProtocolNodeProps {
  data: ProtocolNodeData;
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

export const ProtocolNode = memo(({ data, selected }: ProtocolNodeProps) => {
  const { entity, riskAssessment, exposure, isRoot } = data;
  const borderColor = riskAssessment
    ? riskLevelToColor(riskAssessment.overallLevel)
    : '#9CA3AF';

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 bg-blue-50 shadow-md
        min-w-[200px] max-w-[260px]
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
            className="w-5 h-5 rounded-full"
          />
        )}
        <span className="font-semibold text-sm truncate flex-1">
          {entity.name}
        </span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-100">
          Protocol
        </Badge>
      </div>

      {/* Exposure - Primary metric (vault's capital at risk with this protocol) */}
      {exposure > 0 && (
        <div className="bg-blue-100 rounded px-2 py-1.5 mb-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-blue-700 font-medium">Exposure</span>
            <span className="text-sm font-bold text-blue-900">
              {formatCurrency(exposure)}
            </span>
          </div>
        </div>
      )}

      {/* Protocol Info */}
      <div className="text-xs text-gray-600 space-y-1">
        <div className="flex justify-between">
          <span>Category:</span>
          <span className="font-medium capitalize">
            {entity.category.replace('_', ' ')}
          </span>
        </div>
        {entity.tvl > 0 && (
          <div className="flex justify-between">
            <span>Platform TVL:</span>
            <span className="font-medium text-gray-500">{formatCurrency(entity.tvl)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Governance:</span>
          <span className="font-medium capitalize">
            {entity.governance.type}
          </span>
        </div>
        {entity.audits.length > 0 && (
          <div className="flex justify-between">
            <span>Audits:</span>
            <span className="font-medium">{entity.audits.length}</span>
          </div>
        )}
      </div>

      {/* Risk Score */}
      {riskAssessment && (
        <div className="mt-3 pt-2 border-t border-blue-200">
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

ProtocolNode.displayName = 'ProtocolNode';
