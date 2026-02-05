// Cycle Detector Service
// Detects and handles circular dependencies in the risk dependency graph

import { DependencyGraph, DependencyEdge } from '@/types/core';

// ============== TYPES ==============

export interface CycleInfo {
  id: string;
  nodes: string[]; // Entity IDs in the cycle (e.g., [A, B, C] for A→B→C→A)
  edges: string[]; // Edge IDs forming the cycle
  minWeight: number; // Minimum edge weight in cycle
  cycleType: 'direct' | 'indirect'; // Direct A→B→A or indirect A→B→C→A
}

export interface CycleExposure {
  cycleId: string;
  entryExposure: number; // USD entering the cycle
  totalExposure: number; // Total USD accounting for cycle (converged)
  convergenceRatio: number; // Product of weights around cycle (< 1)
  iterations: number; // Iterations to reach 99% convergence
}

// ============== CYCLE DETECTOR ==============

class CycleDetector {
  /**
   * Detect all cycles in the graph using DFS with recursion tracking
   */
  detectCycles(graph: DependencyGraph): CycleInfo[] {
    const cycles: CycleInfo[] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>(); // Recursion stack for cycle detection
    const pathStack: string[] = []; // Track current path
    const edgeStack: string[] = []; // Track edges in path

    // Build adjacency list
    const adjacency = new Map<
      string,
      Array<{ targetId: string; edgeId: string; weight: number }>
    >();

    for (const entityId of graph.entities.keys()) {
      adjacency.set(entityId, []);
    }

    for (const edge of graph.edges) {
      const neighbors = adjacency.get(edge.sourceId);
      if (neighbors) {
        neighbors.push({
          targetId: edge.targetId,
          edgeId: edge.id,
          weight: edge.weight,
        });
      }
    }

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recStack.add(nodeId);
      pathStack.push(nodeId);

      const neighbors = adjacency.get(nodeId) || [];

      for (const { targetId, edgeId, weight } of neighbors) {
        edgeStack.push(edgeId);

        if (!visited.has(targetId)) {
          dfs(targetId);
        } else if (recStack.has(targetId)) {
          // Found a cycle!
          const cycleStartIdx = pathStack.indexOf(targetId);
          const cycleNodes = pathStack.slice(cycleStartIdx);
          const cycleEdges = edgeStack.slice(cycleStartIdx);

          // Calculate minimum weight in cycle
          let minWeight = 1;
          for (const eId of cycleEdges) {
            const edge = graph.edges.find((e) => e.id === eId);
            if (edge && edge.weight < minWeight) {
              minWeight = edge.weight;
            }
          }

          // Generate unique cycle ID
          const cycleId = `cycle:${cycleNodes.join('->')}`;

          // Only add if not already detected (cycles can be found multiple times)
          if (!cycles.some((c) => c.id === cycleId)) {
            cycles.push({
              id: cycleId,
              nodes: cycleNodes,
              edges: cycleEdges,
              minWeight,
              cycleType: cycleNodes.length === 2 ? 'direct' : 'indirect',
            });
          }
        }

        edgeStack.pop();
      }

      pathStack.pop();
      recStack.delete(nodeId);
    };

    // Run DFS from root first
    if (graph.rootEntityId && !visited.has(graph.rootEntityId)) {
      dfs(graph.rootEntityId);
    }

    // Check for orphan cycles (disconnected from root)
    for (const entityId of graph.entities.keys()) {
      if (!visited.has(entityId)) {
        dfs(entityId);
      }
    }

    if (cycles.length > 0) {
      console.log(`[CycleDetector] Detected ${cycles.length} cycle(s):`);
      for (const cycle of cycles) {
        console.log(`  - ${cycle.nodes.join(' → ')} → ${cycle.nodes[0]} (type: ${cycle.cycleType})`);
      }
    }

    return cycles;
  }

  /**
   * Calculate cycle weight (product of edge weights around the cycle)
   */
  calculateCycleWeight(graph: DependencyGraph, cycle: CycleInfo): number {
    let weight = 1;

    for (const edgeId of cycle.edges) {
      const edge = graph.edges.find((e) => e.id === edgeId);
      if (edge) {
        weight *= edge.weight;
      }
    }

    return weight;
  }

  /**
   * Calculate exposure for nodes involved in cycles
   * Uses geometric series convergence: sum = a / (1 - r) where r < 1
   */
  calculateCycleExposures(
    graph: DependencyGraph,
    cycles: CycleInfo[],
    baseExposures: Map<string, number>
  ): CycleExposure[] {
    const cycleExposures: CycleExposure[] = [];

    for (const cycle of cycles) {
      // Get exposure entering the cycle (from the first node)
      const entryNodeId = cycle.nodes[0];
      const entryExposure = baseExposures.get(entryNodeId) || 0;

      // Calculate convergence ratio (product of weights around cycle)
      const convergenceRatio = this.calculateCycleWeight(graph, cycle);

      // If ratio >= 1, cycle would cause infinite exposure (invalid state)
      // Cap at 0.99 to prevent infinity
      const safeRatio = Math.min(convergenceRatio, 0.99);

      // Geometric series: total = entryExposure / (1 - ratio)
      const totalExposure =
        safeRatio < 1 ? entryExposure / (1 - safeRatio) : entryExposure;

      // Iterations needed to reach 99% of total
      const iterations =
        safeRatio > 0 && safeRatio < 1
          ? Math.ceil(Math.log(0.01) / Math.log(safeRatio))
          : 1;

      cycleExposures.push({
        cycleId: cycle.id,
        entryExposure,
        totalExposure,
        convergenceRatio: safeRatio,
        iterations,
      });

      if (convergenceRatio >= 1) {
        console.warn(
          `[CycleDetector] Cycle ${cycle.id} has non-convergent ratio: ${convergenceRatio}`
        );
      }
    }

    return cycleExposures;
  }

  /**
   * Adjust exposures for all nodes considering cycles
   * Returns adjusted exposure map
   */
  adjustExposuresForCycles(
    graph: DependencyGraph,
    baseExposures: Map<string, number>,
    cycles: CycleInfo[],
    totalTvl: number
  ): Map<string, number> {
    if (cycles.length === 0) {
      return baseExposures;
    }

    const adjustedExposures = new Map(baseExposures);

    // Build set of nodes involved in cycles
    const cycleNodes = new Set<string>();
    for (const cycle of cycles) {
      for (const nodeId of cycle.nodes) {
        cycleNodes.add(nodeId);
      }
    }

    // For each cycle, adjust exposures using geometric series convergence
    for (const cycle of cycles) {
      const cycleWeight = this.calculateCycleWeight(graph, cycle);

      // Skip if cycle would cause infinite growth
      if (cycleWeight >= 1) continue;

      // Calculate convergence factor
      const convergenceFactor = 1 / (1 - cycleWeight);

      // Adjust exposures for nodes in this cycle
      for (const nodeId of cycle.nodes) {
        const existing = adjustedExposures.get(nodeId);
        if (existing !== undefined) {
          // Multiply by convergence factor, but cap at total TVL
          const adjustedExposure = Math.min(
            existing * convergenceFactor,
            totalTvl
          );
          adjustedExposures.set(nodeId, adjustedExposure);
        }
      }
    }

    return adjustedExposures;
  }

  /**
   * Check if adding an edge would create a cycle
   */
  wouldCreateCycle(
    graph: DependencyGraph,
    sourceId: string,
    targetId: string
  ): boolean {
    // Use BFS to check if there's already a path from target to source
    const visited = new Set<string>();
    const queue = [targetId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === sourceId) {
        return true; // Adding this edge would create a cycle
      }

      if (visited.has(current)) continue;
      visited.add(current);

      // Get neighbors
      for (const edge of graph.edges) {
        if (edge.sourceId === current && !visited.has(edge.targetId)) {
          queue.push(edge.targetId);
        }
      }
    }

    return false;
  }

  /**
   * Get all nodes that are part of any cycle
   */
  getNodesInCycles(cycles: CycleInfo[]): Set<string> {
    const nodes = new Set<string>();
    for (const cycle of cycles) {
      for (const nodeId of cycle.nodes) {
        nodes.add(nodeId);
      }
    }
    return nodes;
  }

  /**
   * Summarize cycle information for display
   */
  summarizeCycles(
    cycles: CycleInfo[],
    cycleExposures: CycleExposure[]
  ): {
    count: number;
    directCount: number;
    indirectCount: number;
    totalAffectedNodes: number;
    maxExposureIncrease: number;
    summary: string;
  } {
    if (cycles.length === 0) {
      return {
        count: 0,
        directCount: 0,
        indirectCount: 0,
        totalAffectedNodes: 0,
        maxExposureIncrease: 0,
        summary: 'No circular dependencies detected',
      };
    }

    const directCount = cycles.filter((c) => c.cycleType === 'direct').length;
    const indirectCount = cycles.filter((c) => c.cycleType === 'indirect').length;
    const affectedNodes = this.getNodesInCycles(cycles);

    // Calculate max exposure increase from cycles
    let maxIncrease = 0;
    for (const ce of cycleExposures) {
      if (ce.entryExposure > 0) {
        const increase = (ce.totalExposure / ce.entryExposure - 1) * 100;
        if (increase > maxIncrease) {
          maxIncrease = increase;
        }
      }
    }

    return {
      count: cycles.length,
      directCount,
      indirectCount,
      totalAffectedNodes: affectedNodes.size,
      maxExposureIncrease: maxIncrease,
      summary: `${cycles.length} circular ${cycles.length === 1 ? 'dependency' : 'dependencies'} detected affecting ${affectedNodes.size} entities`,
    };
  }
}

// Export singleton
export const cycleDetector = new CycleDetector();
