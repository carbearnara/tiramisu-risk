// Risk Calculator Service
// Calculates risk scores across all categories with inheritance through dependencies

import {
  Entity,
  EntityType,
  RiskCategory,
  RiskLevel,
  RiskAssessment,
  CategoryScore,
  RiskFactor,
  RiskEvidence,
  DirectRisk,
  AggregatedRisk,
  DependencyGraph,
  DependencyEdge,
  ProtocolEntity,
  TokenEntity,
  VaultEntity,
  AuditInfo,
  Incident,
  GovernanceInfo,
  GovernanceType,
  DEFAULT_RISK_WEIGHTS,
  scoreToRiskLevel,
  isProtocolEntity,
  isVaultEntity,
  isTokenEntity,
  isOracleEntity,
  isIssuerEntity,
} from '@/types/core';

// ============== TYPES ==============

export interface RiskWeights {
  [RiskCategory.SMART_CONTRACT]: number;
  [RiskCategory.COUNTERPARTY]: number;
  [RiskCategory.ORACLE]: number;
  [RiskCategory.GOVERNANCE]: number;
  [RiskCategory.LIQUIDITY]: number;
  [RiskCategory.CUSTODY]: number;
}

interface PathInfo {
  path: string[];
  edges: DependencyEdge[];
  dilutionFactor: number;
}

// ============== RISK CALCULATOR SERVICE ==============

export class RiskCalculatorService {
  private weights: RiskWeights;

  constructor(weights: RiskWeights = DEFAULT_RISK_WEIGHTS) {
    this.weights = weights;
  }

  // ============== MAIN CALCULATION ==============

  /**
   * Calculate complete risk assessment for an entity
   */
  async calculateRisk(
    entity: Entity,
    graph: DependencyGraph,
    existingAssessments?: Map<string, RiskAssessment>
  ): Promise<RiskAssessment> {
    // Calculate direct risks for this entity
    const directRisks = this.calculateDirectRisks(entity);

    // Calculate aggregated risks from dependencies
    const aggregatedRisks = this.calculateAggregatedRisks(
      entity.id,
      graph,
      existingAssessments ?? new Map()
    );

    // Combine into category scores
    const categoryScores = this.calculateCategoryScores(
      directRisks,
      aggregatedRisks
    );

    // Calculate overall score
    const overallScore = this.calculateOverallScore(categoryScores);

    return {
      entityId: entity.id,
      timestamp: new Date(),
      overallScore,
      overallLevel: scoreToRiskLevel(overallScore),
      categoryScores,
      aggregatedRisks,
      directRisks,
    };
  }

  /**
   * Calculate risk assessments for all entities in graph
   */
  async calculateGraphRisks(
    graph: DependencyGraph
  ): Promise<Map<string, RiskAssessment>> {
    const assessments = new Map<string, RiskAssessment>();

    // Process in topological order (leaves first)
    const sortedEntityIds = this.topologicalSort(graph);

    for (const entityId of sortedEntityIds) {
      const entity = graph.entities.get(entityId);
      if (!entity) continue;

      const assessment = await this.calculateRisk(entity, graph, assessments);
      assessments.set(entityId, assessment);
    }

    return assessments;
  }

  // ============== DIRECT RISKS ==============

  /**
   * Calculate direct risks based on entity type
   */
  private calculateDirectRisks(entity: Entity): DirectRisk[] {
    const risks: DirectRisk[] = [];

    if (isProtocolEntity(entity)) {
      risks.push(...this.calculateProtocolRisks(entity));
    } else if (isVaultEntity(entity)) {
      risks.push(...this.calculateVaultRisks(entity));
    } else if (isTokenEntity(entity)) {
      risks.push(...this.calculateTokenRisks(entity));
    } else if (isOracleEntity(entity)) {
      risks.push(...this.calculateOracleRisks(entity));
    } else if (isIssuerEntity(entity)) {
      risks.push(...this.calculateIssuerRisks(entity));
    }

    return risks;
  }

  /**
   * Calculate protocol-specific risks
   */
  private calculateProtocolRisks(protocol: ProtocolEntity): DirectRisk[] {
    const risks: DirectRisk[] = [];

    // Smart Contract Risk: Audit Status
    const auditScore = this.calculateAuditScore(protocol.audits);
    risks.push({
      category: RiskCategory.SMART_CONTRACT,
      factor: {
        id: 'audit_status',
        name: 'Audit Status',
        description: 'Quality and recency of security audits',
        score: auditScore,
        evidence: protocol.audits.map((a) => ({
          type: 'audit' as const,
          source: a.auditor,
          value: `${a.findings.critical}C/${a.findings.high}H/${a.findings.medium}M findings`,
          timestamp: a.date,
          url: a.reportUrl,
        })),
      },
    });

    // Smart Contract Risk: Incident History
    const incidentScore = this.calculateIncidentScore(protocol.incidentHistory);
    risks.push({
      category: RiskCategory.SMART_CONTRACT,
      factor: {
        id: 'incident_history',
        name: 'Incident History',
        description: 'Historical security incidents',
        score: incidentScore,
        evidence: protocol.incidentHistory.map((i) => ({
          type: 'incident' as const,
          source: i.type,
          value: i.description,
          timestamp: i.date,
          url: i.postMortemUrl,
        })),
      },
    });

    // Smart Contract Risk: Code Maturity (TVL as proxy)
    const maturityScore = this.calculateMaturityScore(protocol.tvl);
    risks.push({
      category: RiskCategory.SMART_CONTRACT,
      factor: {
        id: 'code_maturity',
        name: 'Code Maturity',
        description: 'Protocol TVL as maturity indicator',
        score: maturityScore,
        evidence: [
          {
            type: 'metric' as const,
            source: 'tvl',
            value: protocol.tvl,
          },
        ],
      },
    });

    // Smart Contract Risk: Upgradability
    const upgradeScore = protocol.isUpgradeable ? 60 : 85;
    risks.push({
      category: RiskCategory.SMART_CONTRACT,
      factor: {
        id: 'upgradability',
        name: 'Contract Upgradability',
        description: protocol.isUpgradeable
          ? 'Contracts are upgradeable'
          : 'Contracts are immutable',
        score: upgradeScore,
        evidence: [
          {
            type: 'config' as const,
            source: 'contract',
            value: protocol.isUpgradeable ? 'upgradeable' : 'immutable',
          },
        ],
      },
    });

    // Governance Risk
    const governanceScore = this.calculateGovernanceScore(protocol.governance);
    risks.push({
      category: RiskCategory.GOVERNANCE,
      factor: {
        id: 'governance_structure',
        name: 'Governance Structure',
        description: 'Decentralization and security of governance',
        score: governanceScore,
        evidence: [
          {
            type: 'config' as const,
            source: 'governance',
            value: JSON.stringify(protocol.governance),
          },
        ],
      },
    });

    // Governance Risk: Timelock
    if (protocol.hasTimeLock && protocol.governance.timelockDuration) {
      const timelockScore = this.calculateTimelockScore(
        protocol.governance.timelockDuration
      );
      risks.push({
        category: RiskCategory.GOVERNANCE,
        factor: {
          id: 'timelock',
          name: 'Timelock Duration',
          description: `${protocol.governance.timelockDuration / 3600}h timelock`,
          score: timelockScore,
          evidence: [
            {
              type: 'config' as const,
              source: 'timelock',
              value: protocol.governance.timelockDuration,
            },
          ],
        },
      });
    }

    return risks;
  }

  /**
   * Calculate vault-specific risks
   */
  private calculateVaultRisks(vault: VaultEntity): DirectRisk[] {
    const risks: DirectRisk[] = [];

    // Liquidity Risk: Strategy Concentration
    const concentrationScore = this.calculateStrategyConcentration(
      vault.strategies
    );
    risks.push({
      category: RiskCategory.LIQUIDITY,
      factor: {
        id: 'strategy_concentration',
        name: 'Strategy Concentration',
        description: 'Diversification across strategies',
        score: concentrationScore,
        evidence: vault.strategies.map((s) => ({
          type: 'config' as const,
          source: s.name,
          value: `${s.allocation}%`,
        })),
      },
    });

    // Liquidity Risk: Withdrawal Constraints
    const withdrawalScore = vault.withdrawalFee
      ? Math.max(50, 100 - vault.withdrawalFee * 1000)
      : 90;
    risks.push({
      category: RiskCategory.LIQUIDITY,
      factor: {
        id: 'withdrawal_fee',
        name: 'Withdrawal Fee',
        description: vault.withdrawalFee
          ? `${(vault.withdrawalFee * 100).toFixed(2)}% withdrawal fee`
          : 'No withdrawal fee',
        score: withdrawalScore,
        evidence: [
          {
            type: 'config' as const,
            source: 'vault',
            value: vault.withdrawalFee ?? 0,
          },
        ],
      },
    });

    // Smart Contract Risk: ERC-4626 Compliance
    const complianceScore = vault.isERC4626 ? 85 : 70;
    risks.push({
      category: RiskCategory.SMART_CONTRACT,
      factor: {
        id: 'erc4626_compliance',
        name: 'ERC-4626 Compliance',
        description: vault.isERC4626
          ? 'Follows ERC-4626 standard'
          : 'Non-standard vault interface',
        score: complianceScore,
        evidence: [
          {
            type: 'config' as const,
            source: 'standard',
            value: vault.isERC4626 ? 'ERC-4626' : 'custom',
          },
        ],
      },
    });

    return risks;
  }

  /**
   * Calculate token-specific risks
   */
  private calculateTokenRisks(token: TokenEntity): DirectRisk[] {
    const risks: DirectRisk[] = [];

    // Counterparty Risk: Token Type
    let tokenTypeScore = 80;
    switch (token.tokenType) {
      case 'native':
        tokenTypeScore = 95;
        break;
      case 'wrapped':
        tokenTypeScore = 75;
        break;
      case 'stablecoin':
        tokenTypeScore = token.issuerId ? 60 : 40;
        break;
      case 'lst':
      case 'lrt':
        tokenTypeScore = 65;
        break;
      default:
        tokenTypeScore = 70;
    }

    risks.push({
      category: RiskCategory.COUNTERPARTY,
      factor: {
        id: 'token_type',
        name: 'Token Type Risk',
        description: `${token.tokenType} token`,
        score: tokenTypeScore,
        evidence: [
          {
            type: 'config' as const,
            source: 'token',
            value: token.tokenType,
          },
        ],
      },
    });

    // Counterparty Risk: Collateral backing
    if (token.collateral && token.collateral.length > 0) {
      const collateralScore = Math.min(90, 50 + token.collateral.length * 10);
      risks.push({
        category: RiskCategory.COUNTERPARTY,
        factor: {
          id: 'collateral_backing',
          name: 'Collateral Backing',
          description: `Backed by ${token.collateral.length} asset(s)`,
          score: collateralScore,
          evidence: [
            {
              type: 'config' as const,
              source: 'collateral',
              value: token.collateral.join(', '),
            },
          ],
        },
      });
    }

    return risks;
  }

  /**
   * Calculate oracle-specific risks
   */
  private calculateOracleRisks(oracle: Entity): DirectRisk[] {
    const risks: DirectRisk[] = [];

    // Oracle Risk: Provider reputation
    const providerScore = 75; // Placeholder - would vary by provider
    risks.push({
      category: RiskCategory.ORACLE,
      factor: {
        id: 'oracle_provider',
        name: 'Oracle Provider',
        description: `${oracle.name} oracle`,
        score: providerScore,
        evidence: [
          {
            type: 'config' as const,
            source: 'oracle',
            value: oracle.name,
          },
        ],
      },
    });

    return risks;
  }

  /**
   * Calculate issuer-specific risks
   */
  private calculateIssuerRisks(issuer: Entity): DirectRisk[] {
    const risks: DirectRisk[] = [];

    // Counterparty Risk: Issuer type (placeholder)
    const issuerScore = 60;
    risks.push({
      category: RiskCategory.COUNTERPARTY,
      factor: {
        id: 'issuer_risk',
        name: 'Issuer Risk',
        description: `${issuer.name} issuer`,
        score: issuerScore,
        evidence: [
          {
            type: 'config' as const,
            source: 'issuer',
            value: issuer.name,
          },
        ],
      },
    });

    return risks;
  }

  // ============== SCORING FUNCTIONS ==============

  /**
   * Calculate audit score based on audit history
   */
  private calculateAuditScore(audits: AuditInfo[]): number {
    if (audits.length === 0) return 20; // No audits = high risk

    const now = new Date();
    let totalWeight = 0;
    let weightedScore = 0;

    for (const audit of audits) {
      // Recency weight: decay over 2 years
      const ageMonths =
        (now.getTime() - audit.date.getTime()) / (1000 * 60 * 60 * 24 * 30);
      const recencyWeight = Math.max(0.1, 1 - ageMonths / 24);

      // Findings score
      const findingsScore = Math.max(
        0,
        100 -
          audit.findings.critical * 30 -
          audit.findings.high * 15 -
          audit.findings.medium * 5 -
          audit.findings.low * 1
      );

      // Bonus for resolved findings
      const totalFindings =
        audit.findings.critical +
        audit.findings.high +
        audit.findings.medium +
        audit.findings.low;
      const resolutionBonus =
        totalFindings > 0 ? (audit.findings.resolved / totalFindings) * 15 : 0;

      // Auditor reputation bonus (simplified)
      const auditorBonus = this.getAuditorBonus(audit.auditor);

      weightedScore +=
        (findingsScore + resolutionBonus + auditorBonus) * recencyWeight;
      totalWeight += recencyWeight;
    }

    return Math.min(100, weightedScore / totalWeight);
  }

  /**
   * Get reputation bonus for known auditors
   */
  private getAuditorBonus(auditor: string): number {
    const reputations: Record<string, number> = {
      'trail of bits': 10,
      'openzeppelin': 10,
      'consensys diligence': 10,
      'spearbit': 8,
      'sigma prime': 8,
      'certora': 8,
      'code4rena': 5,
      'sherlock': 5,
      'chainsecurity': 8,
    };

    const normalizedAuditor = auditor.toLowerCase();
    for (const [name, bonus] of Object.entries(reputations)) {
      if (normalizedAuditor.includes(name)) return bonus;
    }
    return 0;
  }

  /**
   * Calculate incident score based on history
   */
  private calculateIncidentScore(incidents: Incident[]): number {
    if (incidents.length === 0) return 95; // No incidents = low risk

    const now = new Date();
    let penalty = 0;

    for (const incident of incidents) {
      // Recency weight: recent incidents are more concerning
      const ageMonths =
        (now.getTime() - incident.date.getTime()) / (1000 * 60 * 60 * 24 * 30);
      const recencyWeight = Math.max(0.2, 1 - ageMonths / 36); // 3 year decay

      // Severity penalty
      let severityPenalty = 0;
      switch (incident.severity) {
        case 'critical':
          severityPenalty = 40;
          break;
        case 'high':
          severityPenalty = 25;
          break;
        case 'medium':
          severityPenalty = 10;
          break;
        case 'low':
          severityPenalty = 5;
          break;
      }

      // Resolution bonus
      const resolutionBonus = incident.resolved ? severityPenalty * 0.3 : 0;

      penalty += (severityPenalty - resolutionBonus) * recencyWeight;
    }

    return Math.max(10, 95 - penalty);
  }

  /**
   * Calculate maturity score based on TVL
   */
  private calculateMaturityScore(tvl: number): number {
    // TVL tiers (in USD)
    if (tvl >= 1_000_000_000) return 90; // $1B+
    if (tvl >= 500_000_000) return 85; // $500M+
    if (tvl >= 100_000_000) return 80; // $100M+
    if (tvl >= 50_000_000) return 70; // $50M+
    if (tvl >= 10_000_000) return 60; // $10M+
    if (tvl >= 1_000_000) return 50; // $1M+
    return 40; // < $1M
  }

  /**
   * Calculate governance score
   */
  private calculateGovernanceScore(governance: GovernanceInfo): number {
    switch (governance.type) {
      case GovernanceType.IMMUTABLE:
        return 90; // No governance risk

      case GovernanceType.DAO:
        // DAO score depends on timelock
        const daoBase = 60;
        const timelockBonus = governance.timelockDuration
          ? Math.min(25, governance.timelockDuration / (24 * 3600) * 5) // 5 points per day
          : 0;
        return daoBase + timelockBonus;

      case GovernanceType.MULTISIG:
        if (governance.multisigThreshold) {
          const [required, total] = governance.multisigThreshold
            .split('/')
            .map(Number);
          if (total > 0) {
            const thresholdRatio = required / total;
            return 40 + thresholdRatio * 35; // 40-75 range
          }
        }
        return 50;

      case GovernanceType.TIMELOCK:
        return 70;

      case GovernanceType.EOA:
        return 15; // Single key = highest governance risk

      default:
        return 40;
    }
  }

  /**
   * Calculate timelock score
   */
  private calculateTimelockScore(durationSeconds: number): number {
    const hours = durationSeconds / 3600;
    if (hours >= 72) return 90; // 3+ days
    if (hours >= 48) return 80; // 2+ days
    if (hours >= 24) return 70; // 1+ day
    if (hours >= 12) return 60; // 12+ hours
    if (hours >= 6) return 50; // 6+ hours
    return 40; // < 6 hours
  }

  /**
   * Calculate strategy concentration score
   */
  private calculateStrategyConcentration(
    strategies: VaultEntity['strategies']
  ): number {
    if (strategies.length === 0) return 50;
    if (strategies.length === 1) return 40; // Single strategy = concentrated

    // Calculate Herfindahl-Hirschman Index (HHI)
    const activeStrategies = strategies.filter((s) => s.isActive);
    if (activeStrategies.length === 0) return 50;

    const hhi = activeStrategies.reduce(
      (sum, s) => sum + Math.pow(s.allocation / 100, 2),
      0
    );

    // HHI ranges from 1/n (perfect distribution) to 1 (single strategy)
    // Convert to score: lower HHI = better diversification = higher score
    const maxHHI = 1;
    const minHHI = 1 / activeStrategies.length;
    const normalizedHHI = (hhi - minHHI) / (maxHHI - minHHI);

    return Math.round(90 - normalizedHHI * 50); // 40-90 range
  }

  // ============== AGGREGATED RISKS ==============

  /**
   * Calculate aggregated risks from dependencies
   */
  private calculateAggregatedRisks(
    entityId: string,
    graph: DependencyGraph,
    existingAssessments: Map<string, RiskAssessment>
  ): AggregatedRisk[] {
    const aggregatedRisks: AggregatedRisk[] = [];

    // Find all paths to dependencies
    const paths = this.findAllDependencyPaths(entityId, graph);

    for (const pathInfo of paths) {
      const targetId = pathInfo.path[pathInfo.path.length - 1];
      const targetAssessment = existingAssessments.get(targetId);

      if (!targetAssessment) continue;

      // Propagate direct risks from target entity
      for (const directRisk of targetAssessment.directRisks) {
        aggregatedRisks.push({
          factor: {
            ...directRisk.factor,
            // Adjust score based on dilution
            score: this.dilutedScore(
              directRisk.factor.score,
              pathInfo.dilutionFactor
            ),
            sourceEntityId: targetId,
          },
          category: directRisk.category,
          sourceEntityId: targetId,
          sourcePath: pathInfo.path,
          dilutionFactor: pathInfo.dilutionFactor,
        });
      }
    }

    return aggregatedRisks;
  }

  /**
   * Find all dependency paths from an entity
   */
  private findAllDependencyPaths(
    entityId: string,
    graph: DependencyGraph
  ): PathInfo[] {
    const paths: PathInfo[] = [];
    const visited = new Set<string>();

    const dfs = (
      currentId: string,
      currentPath: string[],
      currentEdges: DependencyEdge[],
      dilution: number
    ) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const outgoingEdges = graph.edges.filter((e) => e.sourceId === currentId);

      for (const edge of outgoingEdges) {
        const newPath = [...currentPath, edge.targetId];
        const newEdges = [...currentEdges, edge];
        const newDilution = dilution * edge.weight;

        paths.push({
          path: newPath,
          edges: newEdges,
          dilutionFactor: newDilution,
        });

        dfs(edge.targetId, newPath, newEdges, newDilution);
      }

      visited.delete(currentId);
    };

    dfs(entityId, [entityId], [], 1);

    return paths;
  }

  /**
   * Calculate diluted score for inherited risks
   */
  private dilutedScore(originalScore: number, dilutionFactor: number): number {
    // Risk is diluted as it propagates
    // Low original score (high risk) becomes less severe through dilution
    // Formula: score + (100 - score) * (1 - dilutionFactor)
    return originalScore + (100 - originalScore) * (1 - dilutionFactor);
  }

  // ============== CATEGORY AGGREGATION ==============

  /**
   * Combine direct and aggregated risks into category scores
   */
  private calculateCategoryScores(
    directRisks: DirectRisk[],
    aggregatedRisks: AggregatedRisk[]
  ): CategoryScore[] {
    const categoryScores: CategoryScore[] = [];

    for (const category of Object.values(RiskCategory)) {
      const directFactors = directRisks
        .filter((r) => r.category === category)
        .map((r) => r.factor);

      const aggregatedFactors = aggregatedRisks
        .filter((r) => r.category === category)
        .map((r) => r.factor);

      const allFactors = [...directFactors, ...aggregatedFactors];

      if (allFactors.length === 0) {
        categoryScores.push({
          category,
          score: 50, // Neutral if no data
          level: RiskLevel.MEDIUM,
          weight: this.weights[category],
          factors: [],
        });
        continue;
      }

      // Calculate average score, weighting direct risks more heavily
      const directWeight = 0.7;
      const aggregatedWeight = 0.3;

      const directAvg =
        directFactors.length > 0
          ? directFactors.reduce((sum, f) => sum + f.score, 0) /
            directFactors.length
          : 50;

      const aggregatedAvg =
        aggregatedFactors.length > 0
          ? aggregatedFactors.reduce((sum, f) => sum + f.score, 0) /
            aggregatedFactors.length
          : 50;

      const avgScore =
        directFactors.length > 0 && aggregatedFactors.length > 0
          ? directAvg * directWeight + aggregatedAvg * aggregatedWeight
          : directFactors.length > 0
            ? directAvg
            : aggregatedAvg;

      categoryScores.push({
        category,
        score: avgScore,
        level: scoreToRiskLevel(avgScore),
        weight: this.weights[category],
        factors: allFactors,
      });
    }

    return categoryScores;
  }

  /**
   * Calculate overall score from category scores
   */
  private calculateOverallScore(categoryScores: CategoryScore[]): number {
    return categoryScores.reduce(
      (score, cs) => score + cs.score * cs.weight,
      0
    );
  }

  // ============== UTILITY ==============

  /**
   * Topological sort for processing dependencies in correct order
   */
  private topologicalSort(graph: DependencyGraph): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const entityId of graph.entities.keys()) {
      inDegree.set(entityId, 0);
      adjacency.set(entityId, []);
    }

    // Build adjacency and in-degree
    for (const edge of graph.edges) {
      if (graph.entities.has(edge.sourceId) && graph.entities.has(edge.targetId)) {
        adjacency.get(edge.sourceId)!.push(edge.targetId);
        inDegree.set(edge.targetId, (inDegree.get(edge.targetId) ?? 0) + 1);
      }
    }

    // Process nodes with no incoming edges first
    const queue: string[] = [];
    for (const [entityId, degree] of inDegree) {
      if (degree === 0) queue.push(entityId);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const entityId = queue.shift()!;
      sorted.push(entityId);

      for (const neighbor of adjacency.get(entityId) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    // Reverse to process leaves first
    return sorted.reverse();
  }

  /**
   * Update risk weights
   */
  setWeights(weights: Partial<RiskWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }
}

// Export singleton instance
export const riskCalculator = new RiskCalculatorService();
