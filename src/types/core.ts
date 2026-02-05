// Core types for DeFi Risk Dependency Chart System
// Based on Dialectic's Nebula graph model

// ============== ENUMS ==============

export enum EntityType {
  VAULT = 'vault',
  PROTOCOL = 'protocol',
  TOKEN = 'token',
  ORACLE = 'oracle',
  ISSUER = 'issuer',
  BRIDGE = 'bridge',
  GOVERNANCE = 'governance',
  CUSTODIAN = 'custodian',
}

export enum Chain {
  ETHEREUM = 'ethereum',
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism',
  POLYGON = 'polygon',
  BASE = 'base',
  AVALANCHE = 'avalanche',
}

export enum RiskCategory {
  SMART_CONTRACT = 'smart_contract',
  COUNTERPARTY = 'counterparty',
  ORACLE = 'oracle',
  GOVERNANCE = 'governance',
  LIQUIDITY = 'liquidity',
  CUSTODY = 'custody',
}

export enum RiskLevel {
  CRITICAL = 'critical',   // 0-20
  HIGH = 'high',           // 21-40
  MEDIUM = 'medium',       // 41-60
  LOW = 'low',             // 61-80
  MINIMAL = 'minimal',     // 81-100
}

export enum DependencyType {
  STRATEGY_ALLOCATION = 'strategy_allocation',
  UNDERLYING_ASSET = 'underlying_asset',
  TOKEN_ISSUER = 'token_issuer',
  COLLATERALIZED_BY = 'collateralized_by',
  ORACLE_DEPENDENCY = 'oracle_dependency',
  GOVERNANCE_CONTROL = 'governance_control',
  NESTED_VAULT = 'nested_vault',
  LIVES_ON = 'lives_on',
  FORK_OF = 'fork_of',
  BRIDGE_DEPENDENCY = 'bridge_dependency',
}

export enum ProtocolCategory {
  LENDING = 'lending',
  DEX = 'dex',
  YIELD_AGGREGATOR = 'yield_aggregator',
  DERIVATIVES = 'derivatives',
  BRIDGE = 'bridge',
  STAKING = 'staking',
  LIQUID_STAKING = 'liquid_staking',
  LIQUID_RESTAKING = 'liquid_restaking',
  CDP = 'cdp',
  STABLECOIN = 'stablecoin',
  OTHER = 'other',
}

export enum GovernanceType {
  MULTISIG = 'multisig',
  DAO = 'dao',
  EOA = 'eoa',
  IMMUTABLE = 'immutable',
  TIMELOCK = 'timelock',
}

export enum OracleType {
  CHAINLINK = 'chainlink',
  PYTH = 'pyth',
  TWAP = 'twap',
  REDSTONE = 'redstone',
  CUSTOM = 'custom',
}

// ============== CORE ENTITIES ==============

export interface EntityMetadata {
  logo?: string;
  website?: string;
  twitter?: string;
  documentation?: string;
  description?: string;
  [key: string]: unknown;
}

export interface Entity {
  id: string;                    // Unique identifier (e.g., "yearn:yvUSDC:ethereum")
  name: string;                  // Human-readable name
  type: EntityType;
  chain?: Chain;
  address?: string;              // Contract address (if applicable)
  metadata: EntityMetadata;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============== TOKEN ==============

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chain: Chain;
  issuerId?: string;             // Entity ID of issuer (e.g., Circle for USDC)
  logoUrl?: string;
}

export interface TokenEntity extends Entity {
  type: EntityType.TOKEN;
  symbol: string;
  decimals: number;
  issuerId?: string;
  tokenType: 'stablecoin' | 'governance' | 'lst' | 'lrt' | 'native' | 'wrapped' | 'other';
  peggedTo?: string;             // For stablecoins (e.g., "USD")
  collateral?: string[];         // Entity IDs of collateral assets
}

// ============== VAULT ==============

export interface Strategy {
  id: string;
  name: string;
  address?: string;
  allocation: number;            // Percentage of TVL (0-100)
  targetProtocolId: string;      // Entity ID of target protocol
  targetVaultId?: string;        // Entity ID if strategy involves another vault
  isActive: boolean;
  debtRatio?: number;
  lastReport?: Date;
}

export interface VaultEntity extends Entity {
  type: EntityType.VAULT;
  underlying: TokenInfo;         // The base asset (e.g., USDC)
  tvl: number;                   // Total Value Locked in USD
  apy?: number;                  // Current APY
  operatorId: string;            // Entity ID of the protocol operating this vault
  strategies: Strategy[];
  isERC4626: boolean;
  shareToken?: TokenInfo;        // The vault's share token
  depositLimit?: bigint;
  withdrawalFee?: number;
}

// ============== PROTOCOL ==============

export interface AuditInfo {
  id: string;
  auditor: string;
  date: Date;
  reportUrl?: string;
  scope: string;
  version?: string;
  findings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
    resolved: number;
  };
}

export interface Incident {
  id: string;
  date: Date;
  type: 'exploit' | 'bug' | 'oracle_failure' | 'governance_attack' | 'rug_pull' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  lossUsd?: number;
  description: string;
  postMortemUrl?: string;
  resolved: boolean;
  txHash?: string;
}

export interface GovernanceInfo {
  type: GovernanceType;
  timelockDuration?: number;     // In seconds
  multisigThreshold?: string;    // e.g., "3/5"
  multisigAddress?: string;
  governanceToken?: string;
  proposalUrl?: string;
  owners?: string[];             // EOA addresses for multisig
}

export interface OracleConfig {
  providerId: string;            // Entity ID of oracle provider
  type: OracleType;
  priceFeeds: PriceFeed[];
  updateFrequency?: number;      // In seconds
  deviationThreshold?: number;   // Percentage
}

export interface PriceFeed {
  pair: string;                  // e.g., "ETH/USD"
  address: string;
  heartbeat: number;             // In seconds
  decimals: number;
}

export interface ProtocolEntity extends Entity {
  type: EntityType.PROTOCOL;
  category: ProtocolCategory;
  tvl: number;
  audits: AuditInfo[];
  governance: GovernanceInfo;
  oracle?: OracleConfig;
  incidentHistory: Incident[];
  forkedFrom?: string;           // Entity ID if this is a fork
  deployedChains: Chain[];
  isUpgradeable: boolean;
  hasTimeLock: boolean;
}

// ============== ORACLE ==============

export interface OracleEntity extends Entity {
  type: EntityType.ORACLE;
  oracleType: OracleType;
  supportedFeeds: PriceFeed[];
  tvlSecured?: number;           // Total TVL relying on this oracle
  incidents: Incident[];
}

// ============== ISSUER ==============

export interface IssuerEntity extends Entity {
  type: EntityType.ISSUER;
  issuerType: 'centralized' | 'decentralized' | 'algorithmic';
  jurisdiction?: string;
  regulatoryStatus?: string;
  reserveAttestation?: {
    url: string;
    lastUpdate: Date;
    auditor?: string;
  };
  issuedTokens: string[];        // Entity IDs of tokens issued
}

// ============== GOVERNANCE ==============

export interface GovernanceEntity extends Entity {
  type: EntityType.GOVERNANCE;
  governanceInfo: GovernanceInfo;
  controlledEntities: string[];  // Entity IDs controlled by this governance
}

// ============== BRIDGE ==============

export interface BridgeEntity extends Entity {
  type: EntityType.BRIDGE;
  bridgeType: 'canonical' | 'third_party' | 'native';
  supportedChains: Chain[];
  tvl: number;
  securityModel: 'multisig' | 'optimistic' | 'zk' | 'trusted';
  incidents: Incident[];
}

// ============== DEPENDENCY GRAPH ==============

export interface EdgeMetadata {
  allocationPercentage?: number;
  strategyName?: string;
  description?: string;
  [key: string]: unknown;
}

export interface DependencyEdge {
  id: string;
  sourceId: string;              // Entity ID
  targetId: string;              // Entity ID
  type: DependencyType;
  weight: number;                // Exposure weight (0-1)
  metadata: EdgeMetadata;
}

export interface DependencyGraph {
  entities: Map<string, Entity>;
  edges: DependencyEdge[];
  rootEntityId: string;
}

// ============== RISK ASSESSMENT ==============

export interface RiskEvidence {
  type: 'audit' | 'incident' | 'metric' | 'config' | 'manual';
  source: string;
  value: string | number;
  timestamp?: Date;
  url?: string;
}

export interface RiskFactor {
  id: string;
  name: string;
  description: string;
  score: number;                 // 0-100 (higher = safer)
  evidence: RiskEvidence[];
  sourceEntityId?: string;       // If inherited from dependency
}

export interface CategoryScore {
  category: RiskCategory;
  score: number;                 // 0-100
  level: RiskLevel;
  weight: number;                // Weight in overall calculation
  factors: RiskFactor[];
}

export interface DirectRisk {
  factor: RiskFactor;
  category: RiskCategory;
}

export interface AggregatedRisk {
  factor: RiskFactor;
  category: RiskCategory;
  sourceEntityId: string;
  sourcePath: string[];          // Full path from this entity to source
  dilutionFactor: number;        // How much risk is diluted through the chain
}

export interface RiskAssessment {
  entityId: string;
  timestamp: Date;
  overallScore: number;          // 0-100 (higher = safer)
  overallLevel: RiskLevel;
  categoryScores: CategoryScore[];
  aggregatedRisks: AggregatedRisk[];
  directRisks: DirectRisk[];
  usdExposure?: number;          // Capital propagation value
}

// ============== N-ORDER EXPOSURE ==============

export interface ExposurePath {
  nodeIds: string[];             // Path of entity IDs
  edges: DependencyEdge[];       // Edges along the path
  targetId: string;              // Final entity in path
  cumulativeWeight: number;      // Product of edge weights
  depth: number;                 // Number of hops
}

export interface NOrderExposure {
  entityId: string;
  exposureType: 'asset' | 'protocol' | 'oracle' | 'governance' | 'issuer';
  usdExposure: number;
  percentage: number;            // Of total portfolio
  paths: ExposurePath[];         // All paths leading to this exposure
  riskLevel: RiskLevel;
}

// ============== API TYPES ==============

export interface VaultSearchResult {
  id: string;
  name: string;
  underlying: string;
  tvl: number;
  apy?: number;
  chain: Chain;
  protocol: string;
  riskLevel?: RiskLevel;
}

export interface GraphResponse {
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  rootEntityId: string;
  riskAssessments: Record<string, RiskAssessment>;
}

// ============== UI/GRAPH RENDERING ==============

export interface GraphNode {
  id: string;
  type: EntityType;
  data: {
    entity: Entity;
    riskAssessment?: RiskAssessment;
    exposure: number; // USD exposure from root vault
    exposurePercent?: number; // Percentage exposure (for consolidated view)
    isConsolidated?: boolean; // Whether in consolidated view mode
    expanded: boolean;
    isRoot: boolean;
  };
  position: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: DependencyType;
  data: {
    edge?: DependencyEdge;
    riskContribution?: number;
    exposurePercent?: number; // For consolidated view
  };
  animated?: boolean;
  label?: string;
  style?: Record<string, string>;
}

// ============== CYCLE DETECTION ==============

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

// ============== UTILITY TYPES ==============

export type AnyEntity =
  | VaultEntity
  | ProtocolEntity
  | TokenEntity
  | OracleEntity
  | IssuerEntity
  | GovernanceEntity
  | BridgeEntity;

export function isVaultEntity(entity: Entity): entity is VaultEntity {
  return entity.type === EntityType.VAULT;
}

export function isProtocolEntity(entity: Entity): entity is ProtocolEntity {
  return entity.type === EntityType.PROTOCOL;
}

export function isTokenEntity(entity: Entity): entity is TokenEntity {
  return entity.type === EntityType.TOKEN;
}

export function isOracleEntity(entity: Entity): entity is OracleEntity {
  return entity.type === EntityType.ORACLE;
}

export function isIssuerEntity(entity: Entity): entity is IssuerEntity {
  return entity.type === EntityType.ISSUER;
}

// ============== CONSTANTS ==============

export const DEFAULT_RISK_WEIGHTS: Record<RiskCategory, number> = {
  [RiskCategory.SMART_CONTRACT]: 0.25,
  [RiskCategory.COUNTERPARTY]: 0.20,
  [RiskCategory.ORACLE]: 0.15,
  [RiskCategory.GOVERNANCE]: 0.15,
  [RiskCategory.LIQUIDITY]: 0.15,
  [RiskCategory.CUSTODY]: 0.10,
};

export const RISK_LEVEL_THRESHOLDS = {
  [RiskLevel.CRITICAL]: { min: 0, max: 20 },
  [RiskLevel.HIGH]: { min: 21, max: 40 },
  [RiskLevel.MEDIUM]: { min: 41, max: 60 },
  [RiskLevel.LOW]: { min: 61, max: 80 },
  [RiskLevel.MINIMAL]: { min: 81, max: 100 },
};

export const MAX_TRAVERSAL_DEPTH = 7;

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score <= 20) return RiskLevel.CRITICAL;
  if (score <= 40) return RiskLevel.HIGH;
  if (score <= 60) return RiskLevel.MEDIUM;
  if (score <= 80) return RiskLevel.LOW;
  return RiskLevel.MINIMAL;
}

export function riskLevelToColor(level: RiskLevel): string {
  switch (level) {
    case RiskLevel.CRITICAL: return '#DC2626';
    case RiskLevel.HIGH: return '#F97316';
    case RiskLevel.MEDIUM: return '#EAB308';
    case RiskLevel.LOW: return '#22C55E';
    case RiskLevel.MINIMAL: return '#10B981';
  }
}
