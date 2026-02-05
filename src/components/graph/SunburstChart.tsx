'use client';

import { useMemo, useState } from 'react';
import { EntityType, riskLevelToColor } from '@/types/core';
import { useGraphStore } from '@/stores/graph-store';

interface SunburstNode {
  id: string;
  name: string;
  type: EntityType;
  value: number; // USD exposure
  percentage: number;
  depth: number;
  children: SunburstNode[];
  riskColor?: string;
}

interface SunburstChartProps {
  className?: string;
  onNodeClick?: (nodeId: string) => void;
}

// Entity type colors
const entityColors: Record<EntityType, string> = {
  [EntityType.VAULT]: '#3B82F6',
  [EntityType.PROTOCOL]: '#8B5CF6',
  [EntityType.TOKEN]: '#22C55E',
  [EntityType.ISSUER]: '#F59E0B',
  [EntityType.ORACLE]: '#EAB308',
  [EntityType.BRIDGE]: '#6366F1',
  [EntityType.GOVERNANCE]: '#EC4899',
  [EntityType.CUSTODIAN]: '#EF4444',
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function SunburstChart({ className, onNodeClick }: SunburstChartProps) {
  const { graph, exposures, assessments, selectedNodeId, selectNode } = useGraphStore();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Build hierarchical data from flat graph
  const sunburstData = useMemo(() => {
    if (!graph) return null;

    const rootId = graph.rootEntityId;
    const rootEntity = graph.entities.get(rootId);
    if (!rootEntity) return null;

    const rootExposure = exposures.get(rootId) || 0;

    // Build adjacency list (parent -> children)
    const children = new Map<string, string[]>();
    for (const edge of graph.edges) {
      const existing = children.get(edge.sourceId) || [];
      if (!existing.includes(edge.targetId)) {
        existing.push(edge.targetId);
      }
      children.set(edge.sourceId, existing);
    }

    // Build tree recursively
    const visited = new Set<string>();
    const buildNode = (id: string, depth: number): SunburstNode | null => {
      if (visited.has(id) || depth > 4) return null; // Limit depth for readability
      visited.add(id);

      const entity = graph.entities.get(id);
      if (!entity) return null;

      const exposure = exposures.get(id) || 0;
      const assessment = assessments.get(id);

      const childIds = children.get(id) || [];
      const childNodes: SunburstNode[] = [];

      for (const childId of childIds) {
        const childNode = buildNode(childId, depth + 1);
        if (childNode && childNode.value > 0) {
          childNodes.push(childNode);
        }
      }

      // Sort children by value descending
      childNodes.sort((a, b) => b.value - a.value);

      return {
        id,
        name: entity.name,
        type: entity.type,
        value: exposure,
        percentage: rootExposure > 0 ? (exposure / rootExposure) * 100 : 0,
        depth,
        children: childNodes,
        riskColor: assessment ? riskLevelToColor(assessment.overallLevel) : undefined,
      };
    };

    return buildNode(rootId, 0);
  }, [graph, exposures, assessments]);

  // Calculate arc paths
  const arcs = useMemo(() => {
    if (!sunburstData) return [];

    const result: Array<{
      id: string;
      name: string;
      type: EntityType;
      value: number;
      percentage: number;
      depth: number;
      startAngle: number;
      endAngle: number;
      innerRadius: number;
      outerRadius: number;
      color: string;
      riskColor?: string;
    }> = [];

    const ringWidth = 60;
    const innerRadius = 80;

    // Recursive function to calculate arcs
    const processNode = (
      node: SunburstNode,
      startAngle: number,
      endAngle: number
    ) => {
      const angle = endAngle - startAngle;

      // Skip very small slices
      if (angle < 0.02 && node.depth > 0) return;

      const ir = innerRadius + node.depth * ringWidth;
      const or = ir + ringWidth - 2; // Small gap between rings

      result.push({
        id: node.id,
        name: node.name,
        type: node.type,
        value: node.value,
        percentage: node.percentage,
        depth: node.depth,
        startAngle,
        endAngle,
        innerRadius: ir,
        outerRadius: or,
        color: entityColors[node.type] || '#9CA3AF',
        riskColor: node.riskColor,
      });

      // Process children
      if (node.children.length > 0) {
        const totalChildValue = node.children.reduce((sum, c) => sum + c.value, 0);
        let childStartAngle = startAngle;

        for (const child of node.children) {
          const childAngle = totalChildValue > 0
            ? (child.value / totalChildValue) * angle
            : angle / node.children.length;

          processNode(child, childStartAngle, childStartAngle + childAngle);
          childStartAngle += childAngle;
        }
      }
    };

    processNode(sunburstData, 0, Math.PI * 2);
    return result;
  }, [sunburstData]);

  // Generate SVG path for an arc
  const arcPath = (
    startAngle: number,
    endAngle: number,
    innerRadius: number,
    outerRadius: number
  ) => {
    const startOuter = polarToCartesian(outerRadius, startAngle);
    const endOuter = polarToCartesian(outerRadius, endAngle);
    const startInner = polarToCartesian(innerRadius, startAngle);
    const endInner = polarToCartesian(innerRadius, endAngle);

    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
      'Z',
    ].join(' ');
  };

  const polarToCartesian = (radius: number, angle: number) => ({
    x: radius * Math.cos(angle - Math.PI / 2),
    y: radius * Math.sin(angle - Math.PI / 2),
  });

  const handleClick = (nodeId: string) => {
    selectNode(nodeId);
    onNodeClick?.(nodeId);
  };

  if (!sunburstData) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-gray-500">
          <p className="text-sm">No graph data available</p>
        </div>
      </div>
    );
  }

  const hoveredArc = arcs.find((a) => a.id === hoveredNode);
  const selectedArc = arcs.find((a) => a.id === selectedNodeId);
  const displayArc = hoveredArc || selectedArc;

  return (
    <div className={`w-full h-full bg-gray-50 flex items-center justify-center ${className}`}>
      <svg
        viewBox="-350 -350 700 700"
        className="w-full h-full max-w-[700px] max-h-[700px]"
      >
        {/* Arcs */}
        {arcs.map((arc) => {
          const isHovered = arc.id === hoveredNode;
          const isSelected = arc.id === selectedNodeId;
          const isHighlighted = isHovered || isSelected;

          return (
            <g key={arc.id}>
              <path
                d={arcPath(arc.startAngle, arc.endAngle, arc.innerRadius, arc.outerRadius)}
                fill={arc.color}
                fillOpacity={isHighlighted ? 1 : 0.85}
                stroke={isHighlighted ? '#1F2937' : '#ffffff'}
                strokeWidth={isHighlighted ? 2 : 1}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredNode(arc.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => handleClick(arc.id)}
              />
              {/* Risk indicator on outer edge */}
              {arc.riskColor && arc.depth > 0 && (
                <path
                  d={arcPath(
                    arc.startAngle,
                    arc.endAngle,
                    arc.outerRadius - 4,
                    arc.outerRadius
                  )}
                  fill={arc.riskColor}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}

        {/* Center info */}
        <g className="pointer-events-none">
          {displayArc ? (
            <>
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                y="-20"
                className="fill-gray-900 text-sm font-medium"
                style={{ fontSize: '14px' }}
              >
                {displayArc.name.length > 20
                  ? displayArc.name.slice(0, 18) + '...'
                  : displayArc.name}
              </text>
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                y="5"
                className="fill-gray-700 font-semibold"
                style={{ fontSize: '18px' }}
              >
                {formatCurrency(displayArc.value)}
              </text>
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                y="28"
                className="fill-gray-500"
                style={{ fontSize: '12px' }}
              >
                {displayArc.percentage.toFixed(1)}% exposure
              </text>
            </>
          ) : (
            <>
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                y="-15"
                className="fill-gray-900 text-sm font-medium"
                style={{ fontSize: '14px' }}
              >
                {sunburstData.name}
              </text>
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                y="12"
                className="fill-gray-700 font-semibold"
                style={{ fontSize: '20px' }}
              >
                {formatCurrency(sunburstData.value)}
              </text>
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
