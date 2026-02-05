// Zustand store for graph state management

import { create } from 'zustand';
import {
  DependencyGraph,
  Entity,
  RiskAssessment,
  GraphNode,
  GraphEdge,
  EntityType,
  DependencyType,
  riskLevelToColor,
} from '@/types/core';

interface GraphState {
  // Core data
  graph: DependencyGraph | null;
  assessments: Map<string, RiskAssessment>;
  exposures: Map<string, number>; // USD exposure from root vault

  // React Flow nodes and edges
  nodes: GraphNode[];
  edges: GraphEdge[];

  // UI state
  selectedNodeId: string | null;
  expandedNodes: Set<string>;
  highlightedPath: string[] | null;
  isLoading: boolean;
  error: string | null;

  // Filter state
  visibleEntityTypes: Set<EntityType>;
  visibleDependencyTypes: Set<DependencyType>;
  minRiskScore: number;

  // Actions
  setGraph: (graph: DependencyGraph) => void;
  setAssessments: (assessments: Map<string, RiskAssessment>) => void;
  setExposures: (exposures: Map<string, number>) => void;
  selectNode: (nodeId: string | null) => void;
  toggleNodeExpansion: (nodeId: string) => void;
  highlightPath: (path: string[] | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setVisibleEntityTypes: (types: Set<EntityType>) => void;
  setVisibleDependencyTypes: (types: Set<DependencyType>) => void;
  setMinRiskScore: (score: number) => void;
  reset: () => void;
}

// Convert domain graph to React Flow nodes/edges
function convertToReactFlowNodes(
  graph: DependencyGraph,
  assessments: Map<string, RiskAssessment>,
  exposures: Map<string, number>,
  expandedNodes: Set<string>
): GraphNode[] {
  const nodes: GraphNode[] = [];
  const positions = calculateNodePositions(graph);

  for (const [id, entity] of graph.entities) {
    const assessment = assessments.get(id);
    const exposure = exposures.get(id) ?? 0;
    const position = positions.get(id) ?? { x: 0, y: 0 };

    nodes.push({
      id,
      type: entity.type,
      position,
      data: {
        entity,
        riskAssessment: assessment,
        exposure, // USD exposure from root vault
        expanded: expandedNodes.has(id),
        isRoot: id === graph.rootEntityId,
      },
    });
  }

  return nodes;
}

function convertToReactFlowEdges(
  graph: DependencyGraph,
  assessments: Map<string, RiskAssessment>
): GraphEdge[] {
  return graph.edges.map((edge) => {
    const targetAssessment = assessments.get(edge.targetId);
    const riskContribution = targetAssessment
      ? (100 - targetAssessment.overallScore) * edge.weight
      : 0;

    return {
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: edge.type,
      data: {
        edge,
        riskContribution,
      },
      animated: edge.type === DependencyType.NESTED_VAULT,
      style: {
        stroke: getEdgeColor(edge.type),
        strokeWidth: String(Math.max(1, edge.weight * 3)),
      },
    };
  });
}

// Hierarchical layout algorithm
function calculateNodePositions(
  graph: DependencyGraph
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const levels = new Map<string, number>();
  const levelCounts = new Map<number, number>();

  // Calculate levels using BFS
  const queue: Array<{ id: string; level: number }> = [
    { id: graph.rootEntityId, level: 0 },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    levels.set(id, level);
    levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);

    // Find children
    const children = graph.edges
      .filter((e) => e.sourceId === id)
      .map((e) => e.targetId);

    for (const childId of children) {
      if (!visited.has(childId)) {
        queue.push({ id: childId, level: level + 1 });
      }
    }
  }

  // Assign positions
  const HORIZONTAL_SPACING = 280;
  const VERTICAL_SPACING = 150;
  const levelIndices = new Map<number, number>();

  for (const [id, level] of levels) {
    const count = levelCounts.get(level) ?? 1;
    const index = levelIndices.get(level) ?? 0;
    levelIndices.set(level, index + 1);

    // Center nodes at each level
    const totalWidth = (count - 1) * HORIZONTAL_SPACING;
    const startX = -totalWidth / 2;

    positions.set(id, {
      x: startX + index * HORIZONTAL_SPACING,
      y: level * VERTICAL_SPACING,
    });
  }

  return positions;
}

function getEdgeColor(type: DependencyType): string {
  const colors: Record<DependencyType, string> = {
    [DependencyType.STRATEGY_ALLOCATION]: '#3B82F6', // blue
    [DependencyType.UNDERLYING_ASSET]: '#10B981', // green
    [DependencyType.TOKEN_ISSUER]: '#F97316', // orange
    [DependencyType.COLLATERALIZED_BY]: '#8B5CF6', // purple
    [DependencyType.ORACLE_DEPENDENCY]: '#EAB308', // yellow
    [DependencyType.GOVERNANCE_CONTROL]: '#EC4899', // pink
    [DependencyType.NESTED_VAULT]: '#06B6D4', // cyan
    [DependencyType.LIVES_ON]: '#6B7280', // gray
    [DependencyType.FORK_OF]: '#A78BFA', // light purple
    [DependencyType.BRIDGE_DEPENDENCY]: '#F43F5E', // red
  };

  return colors[type] ?? '#9CA3AF';
}

const initialState = {
  graph: null,
  assessments: new Map(),
  exposures: new Map<string, number>(),
  nodes: [],
  edges: [],
  selectedNodeId: null,
  expandedNodes: new Set<string>(),
  highlightedPath: null,
  isLoading: false,
  error: null,
  visibleEntityTypes: new Set(Object.values(EntityType)),
  visibleDependencyTypes: new Set(Object.values(DependencyType)),
  minRiskScore: 0,
};

export const useGraphStore = create<GraphState>((set, get) => ({
  ...initialState,

  setGraph: (graph) => {
    const { assessments, exposures, expandedNodes } = get();
    const nodes = convertToReactFlowNodes(graph, assessments, exposures, expandedNodes);
    const edges = convertToReactFlowEdges(graph, assessments);
    set({ graph, nodes, edges });
  },

  setAssessments: (assessments) => {
    const { graph, exposures, expandedNodes } = get();
    if (graph) {
      const nodes = convertToReactFlowNodes(graph, assessments, exposures, expandedNodes);
      const edges = convertToReactFlowEdges(graph, assessments);
      set({ assessments, nodes, edges });
    } else {
      set({ assessments });
    }
  },

  setExposures: (exposures) => {
    const { graph, assessments, expandedNodes } = get();
    if (graph) {
      const nodes = convertToReactFlowNodes(graph, assessments, exposures, expandedNodes);
      set({ exposures, nodes });
    } else {
      set({ exposures });
    }
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  toggleNodeExpansion: (nodeId) => {
    const { expandedNodes, graph, assessments, exposures } = get();
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }

    if (graph) {
      const nodes = convertToReactFlowNodes(graph, assessments, exposures, newExpanded);
      set({ expandedNodes: newExpanded, nodes });
    } else {
      set({ expandedNodes: newExpanded });
    }
  },

  highlightPath: (path) => set({ highlightedPath: path }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setVisibleEntityTypes: (types) => set({ visibleEntityTypes: types }),

  setVisibleDependencyTypes: (types) => set({ visibleDependencyTypes: types }),

  setMinRiskScore: (score) => set({ minRiskScore: score }),

  reset: () => set(initialState),
}));
