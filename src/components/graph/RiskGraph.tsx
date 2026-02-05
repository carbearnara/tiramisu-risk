'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type Node,
  type Edge,
  ConnectionMode,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGraphStore } from '@/stores/graph-store';
import { EntityType, riskLevelToColor } from '@/types/core';

// Custom node components
import { VaultNode } from './nodes/VaultNode';
import { ProtocolNode } from './nodes/ProtocolNode';
import { TokenNode } from './nodes/TokenNode';
import { GenericNode } from './nodes/GenericNode';

// Node type mapping - using type assertion for custom node components
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
    assessments,
    selectedNodeId,
    selectNode,
    highlightedPath,
    isLoading,
  } = useGraphStore();

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

  // Color nodes based on risk level in minimap
  const nodeColor = useCallback(
    (node: Node) => {
      const assessment = assessments.get(node.id);
      if (!assessment) return '#6B7280';
      return riskLevelToColor(assessment.overallLevel);
    },
    [assessments]
  );

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-500">Loading dependency graph...</p>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-gray-500">
          <p>No graph data available.</p>
          <p className="text-sm mt-2">Search for a vault to visualize its risk dependencies.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${className}`}>
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
        <Controls />
        <MiniMap
          nodeColor={nodeColor}
          maskColor="rgba(0, 0, 0, 0.1)"
          className="bg-white border rounded-lg shadow-sm"
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />

        {/* Legend */}
        <Panel position="top-right" className="bg-white p-3 rounded-lg shadow-sm border">
          <h4 className="text-xs font-semibold mb-2 text-gray-700">Risk Level</h4>
          <div className="space-y-1">
            <LegendItem color="#DC2626" label="Critical (0-20)" />
            <LegendItem color="#F97316" label="High (21-40)" />
            <LegendItem color="#EAB308" label="Medium (41-60)" />
            <LegendItem color="#22C55E" label="Low (61-80)" />
            <LegendItem color="#10B981" label="Minimal (81-100)" />
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
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}
