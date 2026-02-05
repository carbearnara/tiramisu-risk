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

export function RiskGraph({ className }: RiskGraphProps) {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    selectedNodeId,
    selectNode,
    highlightedPath,
    isLoading,
  } = useGraphStore();

  const [legendExpanded, setLegendExpanded] = useState(false);

  // Convert store data to React Flow format
  const initialNodes = useMemo(() => {
    return storeNodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      selected: node.id === selectedNodeId,
    }));
  }, [storeNodes, selectedNodeId]);

  const initialEdges = useMemo(() => {
    return storeEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: edge.animated,
      style: {
        ...edge.style,
        opacity:
          highlightedPath && !highlightedPath.includes(edge.source)
            ? 0.2
            : 1,
      },
    }));
  }, [storeEdges, highlightedPath]);

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

        {/* Simplified Legend - icon-only, expands on hover */}
        <Panel position="top-right">
          <div
            className="bg-white border rounded-lg shadow-sm overflow-hidden transition-all duration-200"
            onMouseEnter={() => setLegendExpanded(true)}
            onMouseLeave={() => setLegendExpanded(false)}
          >
            {legendExpanded ? (
              <div className="p-3 space-y-1.5">
                <h4 className="text-xs font-medium text-gray-500 mb-2">Entity Types</h4>
                <LegendItem color="#3B82F6" label="Vault" />
                <LegendItem color="#8B5CF6" label="Protocol" />
                <LegendItem color="#22C55E" label="Token" />
                <LegendItem color="#F59E0B" label="Issuer" />
              </div>
            ) : (
              <div className="p-2 flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}
