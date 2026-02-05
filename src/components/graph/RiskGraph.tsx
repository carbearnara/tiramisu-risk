'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type Node,
  ConnectionMode,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGraphStore } from '@/stores/graph-store';
import { EntityType } from '@/types/core';

// Custom node components
import { VaultNode } from './nodes/VaultNode';
import { ProtocolNode } from './nodes/ProtocolNode';
import { TokenNode } from './nodes/TokenNode';
import { GenericNode } from './nodes/GenericNode';

// Node type mapping
const nodeTypes: NodeTypes = {
  [EntityType.VAULT]: VaultNode as unknown as NodeTypes[string],
  [EntityType.PROTOCOL]: ProtocolNode as unknown as NodeTypes[string],
  [EntityType.TOKEN]: TokenNode as unknown as NodeTypes[string],
  [EntityType.ORACLE]: GenericNode as unknown as NodeTypes[string],
  [EntityType.ISSUER]: GenericNode as unknown as NodeTypes[string],
  [EntityType.BRIDGE]: GenericNode as unknown as NodeTypes[string],
  [EntityType.GOVERNANCE]: GenericNode as unknown as NodeTypes[string],
  [EntityType.CUSTODIAN]: GenericNode as unknown as NodeTypes[string],
};

interface RiskGraphProps {
  className?: string;
}

// Entity type display config
const entityTypeConfig: { type: EntityType; color: string; label: string }[] = [
  { type: EntityType.VAULT, color: '#3B82F6', label: 'Vault' },
  { type: EntityType.PROTOCOL, color: '#8B5CF6', label: 'Protocol' },
  { type: EntityType.TOKEN, color: '#22C55E', label: 'Token' },
  { type: EntityType.ISSUER, color: '#F59E0B', label: 'Issuer' },
  { type: EntityType.ORACLE, color: '#EAB308', label: 'Oracle' },
  { type: EntityType.BRIDGE, color: '#6366F1', label: 'Bridge' },
  { type: EntityType.GOVERNANCE, color: '#EC4899', label: 'Governance' },
  { type: EntityType.CUSTODIAN, color: '#EF4444', label: 'Custodian' },
];

export function RiskGraph({ className }: RiskGraphProps) {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    selectedNodeId,
    selectNode,
    highlightedPath,
    isLoading,
    isConsolidated,
    toggleConsolidatedView,
    getConsolidatedNodes,
    getConsolidatedEdges,
    visibleEntityTypes,
    setVisibleEntityTypes,
  } = useGraphStore();

  const [legendExpanded, setLegendExpanded] = useState(false);

  // Toggle entity type visibility
  const toggleEntityType = useCallback((type: EntityType) => {
    const newVisible = new Set(visibleEntityTypes);
    if (newVisible.has(type)) {
      // Don't allow hiding all types
      if (newVisible.size > 1) {
        newVisible.delete(type);
      }
    } else {
      newVisible.add(type);
    }
    setVisibleEntityTypes(newVisible);
  }, [visibleEntityTypes, setVisibleEntityTypes]);

  // Convert store data to React Flow format, filtering by visible entity types
  const initialNodes = useMemo(() => {
    const sourceNodes = isConsolidated ? getConsolidatedNodes() : storeNodes;
    return sourceNodes
      .filter((node) => visibleEntityTypes.has(node.type))
      .map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        selected: node.id === selectedNodeId,
      }));
  }, [storeNodes, selectedNodeId, isConsolidated, getConsolidatedNodes, visibleEntityTypes]);

  // Get set of visible node IDs for edge filtering
  const visibleNodeIds = useMemo(() => {
    return new Set(initialNodes.map((node) => node.id));
  }, [initialNodes]);

  const initialEdges = useMemo(() => {
    const sourceEdges = isConsolidated ? getConsolidatedEdges() : storeEdges;
    return sourceEdges
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: edge.animated,
        label: edge.label,
        labelStyle: { fill: '#6B7280', fontSize: 10 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.8 },
        labelBgPadding: [4, 2] as [number, number],
        style: {
          ...edge.style,
          opacity:
            highlightedPath && !highlightedPath.includes(edge.source)
              ? 0.2
              : 1,
        },
      }));
  }, [storeEdges, highlightedPath, isConsolidated, getConsolidatedEdges, visibleNodeIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when store changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading graph...</p>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-gray-500">
          <p className="text-sm">No graph data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full bg-gray-50 ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        {/* Controls - consolidated floating toolbar */}
        <Controls className="bg-white border rounded-lg shadow-sm" />

        {/* View Toggle + Legend */}
        <Panel position="top-right">
          <div
            className="bg-white border rounded-lg shadow-sm overflow-hidden transition-all duration-200"
            onMouseEnter={() => setLegendExpanded(true)}
            onMouseLeave={() => setLegendExpanded(false)}
          >
            {/* View Toggle */}
            <div className="flex text-xs border-b">
              <button
                onClick={() => isConsolidated && toggleConsolidatedView()}
                className={`px-3 py-1.5 transition-colors ${!isConsolidated ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
              >
                Detailed
              </button>
              <button
                onClick={() => !isConsolidated && toggleConsolidatedView()}
                className={`px-3 py-1.5 transition-colors ${isConsolidated ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
              >
                Consolidated
              </button>
            </div>
            {/* Legend */}
            {legendExpanded ? (
              <div className="p-3 space-y-1">
                <h4 className="text-xs font-medium text-gray-500 mb-2">Entity Types</h4>
                {entityTypeConfig.map(({ type, color, label }) => (
                  <LegendItem
                    key={type}
                    color={color}
                    label={label}
                    active={visibleEntityTypes.has(type)}
                    onClick={() => toggleEntityType(type)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-2 flex gap-1">
                {entityTypeConfig.slice(0, 4).map(({ type, color }) => (
                  <div
                    key={type}
                    className="w-2.5 h-2.5 rounded-full cursor-pointer transition-opacity"
                    style={{
                      backgroundColor: color,
                      opacity: visibleEntityTypes.has(type) ? 1 : 0.3,
                    }}
                    onClick={() => toggleEntityType(type)}
                  />
                ))}
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

function LegendItem({
  color,
  label,
  active,
  onClick,
}: {
  color: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full text-left px-1 py-0.5 rounded hover:bg-gray-50 transition-opacity ${
        active ? 'opacity-100' : 'opacity-40'
      }`}
    >
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-gray-600">{label}</span>
    </button>
  );
}
