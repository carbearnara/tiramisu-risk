// Registry of tracked vault products and their dependencies
// Based on popular DeFi yield vaults and risk curators

import { Chain, EntityType, ProtocolCategory, GovernanceType, OracleType } from '@/types/core';

export interface StrategyAllocation {
  protocol: string; // Protocol slug
  allocation: number; // Percentage 0-100
}

export interface TrackedVault {
  id: string;
  name: string;
  protocol: string;
  protocolSlug: string; // DeFiLlama slug
  chain: Chain;
  address?: string;
  underlying: string;
  underlyingAddress?: string;
  strategies?: string[]; // Protocol slugs this vault deploys to (legacy, equal split)
  strategyAllocations?: StrategyAllocation[]; // Detailed allocations with percentages
  curator?: string;
  defiLlamaPoolId?: string;
}

export interface TrackedProtocol {
  id: string;
  name: string;
  slug: string; // DeFiLlama slug
  category: ProtocolCategory;
  chains: Chain[];
  governance: {
    type: GovernanceType;
    multisigThreshold?: string;
    timelockHours?: number;
  };
  oracle?: {
    type: OracleType;
    provider: string;
  };
  auditors: string[];
  isUpgradeable: boolean;
  forkedFrom?: string;
}

export interface TrackedToken {
  id: string;
  symbol: string;
  name: string;
  chain: Chain;
  address: string;
  decimals: number;
  type: 'stablecoin' | 'lst' | 'lrt' | 'native' | 'wrapped' | 'governance' | 'other';
  issuer?: string;
  peggedTo?: string;
}

export interface TrackedIssuer {
  id: string;
  name: string;
  type: 'centralized' | 'decentralized' | 'algorithmic';
  tokens: string[];
}

// ============== TRACKED VAULTS ==============

export const TRACKED_VAULTS: TrackedVault[] = [
  // Yearn Vaults
  {
    id: 'yearn:yvUSDC:ethereum',
    name: 'Yearn yvUSDC',
    protocol: 'Yearn',
    protocolSlug: 'yearn-finance',
    chain: Chain.ETHEREUM,
    address: '0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE',
    underlying: 'USDC',
    underlyingAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 45 },    // Primary lending
      { protocol: 'compound-v3', allocation: 35 }, // Secondary lending
      { protocol: 'morpho', allocation: 20 },      // Optimized lending
    ],
  },
  {
    id: 'yearn:yvDAI:ethereum',
    name: 'Yearn yvDAI',
    protocol: 'Yearn',
    protocolSlug: 'yearn-finance',
    chain: Chain.ETHEREUM,
    address: '0xdA816459F1AB5631232FE5e97a05BBBb94970c95',
    underlying: 'DAI',
    underlyingAddress: '0x6B175474E89094C44Da98b954EescdeCB5c6fBa7',
    strategies: ['aave-v3', 'compound-v3', 'morpho'],
  },
  {
    id: 'yearn:yvWETH:ethereum',
    name: 'Yearn yvWETH',
    protocol: 'Yearn',
    protocolSlug: 'yearn-finance',
    chain: Chain.ETHEREUM,
    address: '0xa258C4606Ca8206D8aA700cE2143D7db854D168c',
    underlying: 'WETH',
    underlyingAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    strategies: ['aave-v3', 'compound-v3', 'lido'],
  },

  // Morpho Vaults (Curated)
  {
    id: 'morpho:steakhouse-usdc:ethereum',
    name: 'Morpho Steakhouse USDC',
    protocol: 'Morpho',
    protocolSlug: 'morpho',
    chain: Chain.ETHEREUM,
    address: '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB',
    underlying: 'USDC',
    curator: 'Steakhouse Financial',
    strategies: ['morpho-blue'],
  },
  {
    id: 'morpho:gauntlet-usdc:ethereum',
    name: 'Morpho Gauntlet USDC',
    protocol: 'Morpho',
    protocolSlug: 'morpho',
    chain: Chain.ETHEREUM,
    address: '0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458',
    underlying: 'USDC',
    curator: 'Gauntlet',
    strategies: ['morpho-blue'],
  },
  {
    id: 'morpho:yearn-usdc:base',
    name: 'Morpho Yearn OG USDC',
    protocol: 'Morpho',
    protocolSlug: 'morpho',
    chain: Chain.BASE,
    address: '0xef417a2512C5a41f69AE4e021648b69a7CdE5D03',
    underlying: 'USDC',
    curator: 'Yearn',
    strategies: ['morpho-blue'],
  },
  {
    id: 'morpho:re7-weth:ethereum',
    name: 'Morpho Re7 WETH',
    protocol: 'Morpho',
    protocolSlug: 'morpho',
    chain: Chain.ETHEREUM,
    address: '0x78Fc2c2eD1A4cDb5402365934aE5648aDAd094d0',
    underlying: 'WETH',
    curator: 'Re7 Labs',
    strategies: ['morpho-blue'],
  },

  // Euler V2 Vaults
  {
    id: 'euler:usdc:ethereum',
    name: 'Euler V2 USDC',
    protocol: 'Euler',
    protocolSlug: 'euler',
    chain: Chain.ETHEREUM,
    underlying: 'USDC',
    strategies: ['euler-v2'],
  },

  // Sommelier Vaults
  {
    id: 'sommelier:turbo-steth:ethereum',
    name: 'Sommelier Turbo stETH',
    protocol: 'Sommelier',
    protocolSlug: 'sommelier',
    chain: Chain.ETHEREUM,
    address: '0xfd6db5011b171B05E1Ea3b92f9EAcaEEb055e971',
    underlying: 'stETH',
    strategies: ['aave-v3', 'morpho', 'uniswap-v3'],
  },
  {
    id: 'sommelier:real-yield-usd:ethereum',
    name: 'Sommelier Real Yield USD',
    protocol: 'Sommelier',
    protocolSlug: 'sommelier',
    chain: Chain.ETHEREUM,
    address: '0x97e6E0a40a3D02F12d1cEC30ebfbAE04e37C119E',
    underlying: 'USDC',
    strategies: ['aave-v3', 'compound-v3', 'frax'],
  },

  // Aave (Direct lending, not vault but included for comparison)
  {
    id: 'aave:usdc:ethereum',
    name: 'Aave V3 USDC',
    protocol: 'Aave',
    protocolSlug: 'aave-v3',
    chain: Chain.ETHEREUM,
    address: '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c',
    underlying: 'USDC',
  },
  {
    id: 'aave:weth:ethereum',
    name: 'Aave V3 WETH',
    protocol: 'Aave',
    protocolSlug: 'aave-v3',
    chain: Chain.ETHEREUM,
    underlying: 'WETH',
  },

  // Compound V3
  {
    id: 'compound:usdc:ethereum',
    name: 'Compound V3 USDC',
    protocol: 'Compound',
    protocolSlug: 'compound-v3',
    chain: Chain.ETHEREUM,
    address: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
    underlying: 'USDC',
  },

  // ============== TRACKED PORTFOLIO BUNDLES ==============
  // From: https://x.com/phtevenstrong/status/2011532436698431890

  // infiniFi - Fractional reserve banking protocol
  // Source: https://stats.infinifi.xyz/ (scraped Jan 30, 2026)
  // TVL: $178.72M | Liquid: $35.44M (19.8%) | Illiquid: $143.28M (80.2%)
  // Major farms: Cap/stcUSD 41.5%, Maple 12.6%, Ethena 10.2%, Fluid 8.9%, Multi 7.7%
  {
    id: 'infinifi:siusd:ethereum',
    name: 'infiniFi Staked iUSD (siUSD)',
    protocol: 'infiniFi',
    protocolSlug: 'infinifi',
    chain: Chain.ETHEREUM,
    address: '0xDBDC1Ef57537E34680B898E1FEBD3D68c7389bCB', // ERC-4626
    underlying: 'USDC',
    underlyingAddress: '0x48f9e38f3070AD8945DFEae3FA70987722E3D89c', // iUSD
    strategyAllocations: [
      { protocol: 'cap', allocation: 42 },       // Cap Farm stcUSD: $74.10M
      { protocol: 'maple', allocation: 13 },     // Maple syrupUSDC + Institutional: $22.50M
      { protocol: 'ethena', allocation: 10 },    // Ethena sUSDe: $18.28M
      { protocol: 'fluid', allocation: 9 },      // Fluid USDC: $15.88M
      { protocol: 'aave-v3', allocation: 7 },    // Aave v3 (RLUSD + Horizon + base): $11.70M
      { protocol: 'euler', allocation: 5 },      // Euler Sentora: $8.98M
      { protocol: 'morpho', allocation: 3 },     // Morpho Steakhouse infiniFi: $5.00M
      { protocol: 'spark', allocation: 2 },      // Spark sUSDC: $3.71M
      { protocol: 'reservoir', allocation: 1 },  // Reservoir wsrUSD: $1.97M
      { protocol: 'other', allocation: 8 },      // Multi Farm + sGHO + Gauntlet: ~$16.62M
    ],
  },
  {
    id: 'infinifi:liusd:ethereum',
    name: 'infiniFi Locked iUSD (liUSD)',
    protocol: 'infiniFi',
    protocolSlug: 'infinifi',
    chain: Chain.ETHEREUM,
    address: '0xf68b95b7e851170c0e5123a3249dD1Ca46215085',
    underlying: 'USDC',
    underlyingAddress: '0x48f9e38f3070AD8945DFEae3FA70987722E3D89c', // iUSD
    strategyAllocations: [
      { protocol: 'cap', allocation: 52 },       // Higher illiquid allocation (Cap is illiquid)
      { protocol: 'maple', allocation: 16 },     // Maple farms are illiquid
      { protocol: 'ethena', allocation: 13 },    // Ethena sUSDe is illiquid
      { protocol: 'morpho', allocation: 4 },     // Morpho Steakhouse
      { protocol: 'aave-v3', allocation: 3 },    // Some Aave positions
      { protocol: 'other', allocation: 12 },     // Multi Farm + other illiquid
    ],
  },

  // Re.xyz - Insurance-backed stablecoin
  // Source: https://app.re.xyz/transparency (scraped Jan 30, 2026)
  // TVL: $396.2M | OnChain: $116.3M | OffChain (T-bills): $64.7M | Premium Receivable: $215.1M
  // OnChain breakdown: sUSDe ~$60.7M (52%), USDC/stables ~$8.1M (7%), other ~$47.5M
  {
    id: 'rexyz:reusd:ethereum',
    name: 'Re.xyz reUSD (Basis-Plus)',
    protocol: 'Re.xyz',
    protocolSlug: 'rexyz',
    chain: Chain.ETHEREUM,
    address: '0x5086bf358635b81d8c47c66d1c8b9e567db70c72',
    underlying: 'USDC',
    strategyAllocations: [
      { protocol: 'ethena', allocation: 52 },    // sUSDe: $60.7M of $116.3M onchain
      { protocol: 'tbills', allocation: 36 },    // OffChain T-bills: $64.7M of $181M total capital
      { protocol: 'curve', allocation: 7 },      // Stables + LP for liquidity
      { protocol: 'reinsurance', allocation: 5 }, // Insurance backing reserves
    ],
  },
  {
    id: 'rexyz:reusde:ethereum',
    name: 'Re.xyz reUSDe (Insurance Alpha)',
    protocol: 'Re.xyz',
    protocolSlug: 'rexyz',
    chain: Chain.ETHEREUM,
    address: '0xdDC0f880ff6e4e22E4B74632fBb43Ce4DF6cCC5a',
    underlying: 'USDe',
    strategyAllocations: [
      { protocol: 'ethena', allocation: 55 },    // Idle funds in sUSDe
      { protocol: 'reinsurance', allocation: 45 }, // Active reinsurance risk pools (15-23% APY)
    ],
  },

  // Reservoir - Next-gen stablecoin protocol
  // Source: https://app.reservoir.xyz/reserves
  // Diversified collateral: DeFi yield + RWA
  {
    id: 'reservoir:rusd:ethereum',
    name: 'Reservoir rUSD',
    protocol: 'Reservoir',
    protocolSlug: 'reservoir',
    chain: Chain.ETHEREUM,
    address: '0x09d4214c03d01f49544c0448dbe3a27f768f2b34',
    underlying: 'USDC',
    strategyAllocations: [
      { protocol: 'ethena', allocation: 40 },    // DeFi yield (sUSDe)
      { protocol: 'aave-v3', allocation: 25 },   // Money market
      { protocol: 'tbills', allocation: 25 },    // RWA exposure
      { protocol: 'morpho', allocation: 10 },    // Lending optimization
    ],
  },
  {
    id: 'reservoir:srusd:ethereum',
    name: 'Reservoir srUSD (Floating Yield)',
    protocol: 'Reservoir',
    protocolSlug: 'reservoir',
    chain: Chain.ETHEREUM,
    address: '0x738d1115B90efa71AE468F1287fc864775e23a31',
    underlying: 'USDC',
    strategyAllocations: [
      { protocol: 'ethena', allocation: 45 },    // Higher yield allocation
      { protocol: 'aave-v3', allocation: 25 },   // Money market
      { protocol: 'tbills', allocation: 20 },    // RWA backing
      { protocol: 'morpho', allocation: 10 },    // Lending
    ],
  },

  // Resolv Labs - Delta-neutral stablecoin
  // USR is a USD stablecoin backed by delta-neutral ETH positions
  {
    id: 'resolv:usr:ethereum',
    name: 'Resolv USR',
    protocol: 'Resolv',
    protocolSlug: 'resolv',
    chain: Chain.ETHEREUM,
    address: '0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110',
    underlying: 'USDC', // USR is a USD stablecoin, not ETH
    strategyAllocations: [
      { protocol: 'ethena', allocation: 100 }, // Delta-neutral ETH perps
    ],
  },
  {
    id: 'resolv:rlp:ethereum',
    name: 'Resolv RLP (Risk Layer)',
    protocol: 'Resolv',
    protocolSlug: 'resolv',
    chain: Chain.ETHEREUM,
    address: '0x4956b52aE2fF65D74CA2d61207523288e4528f96',
    underlying: 'USDC', // RLP is also USD-denominated
    strategyAllocations: [
      { protocol: 'ethena', allocation: 100 }, // Risk layer for USR
    ],
  },

  // Yuzu Money (OuroborosCap8) - Overcollateralized stablecoin
  {
    id: 'yuzu:yzusd:ethereum',
    name: 'Yuzu yzUSD',
    protocol: 'Yuzu Money',
    protocolSlug: 'yuzu-money',
    chain: Chain.ETHEREUM,
    underlying: 'USDC',
    curator: 'Ouroboros Capital',
    strategies: ['euler', 'pendle'],
  },
  {
    id: 'yuzu:syzusd:ethereum',
    name: 'Yuzu Staked yzUSD (syzUSD)',
    protocol: 'Yuzu Money',
    protocolSlug: 'yuzu-money',
    chain: Chain.ETHEREUM,
    underlying: 'USDC',
    curator: 'Ouroboros Capital',
    strategies: ['euler', 'pendle'],
  },

  // Avant Protocol - Avalanche yield protocol
  // Source: https://docs.avantprotocol.com/security/contract-addresses
  {
    id: 'avant:savusd:avalanche',
    name: 'Avant Staked avUSD (savUSD)',
    protocol: 'Avant',
    protocolSlug: 'avant-protocol',
    chain: Chain.AVALANCHE,
    address: '0x06d47F3fb376649c3A9Dafe069B3D6E35572219E',
    underlying: 'USDC',
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 100 }, // 0xPartners delta-neutral strategies
    ],
  },
  {
    id: 'avant:savbtc:avalanche',
    name: 'Avant Staked avBTC (savBTC)',
    protocol: 'Avant',
    protocolSlug: 'avant-protocol',
    chain: Chain.AVALANCHE,
    address: '0x649342c6bff544d82DF1B2bA3C93e0C22cDeBa84',
    underlying: 'BTC',
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 100 },
    ],
  },
  {
    id: 'avant:saveth:avalanche',
    name: 'Avant Staked avETH (savETH)',
    protocol: 'Avant',
    protocolSlug: 'avant-protocol',
    chain: Chain.AVALANCHE,
    address: '0x260c0c715A279F239cF44e2F73E964AB550738f3',
    underlying: 'ETH',
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 100 },
    ],
  },

  // Noon - Smart yield stablecoin (delta-neutral + T-bills)
  {
    id: 'noon:susn:ethereum',
    name: 'Noon Staked USN (sUSN)',
    protocol: 'Noon',
    protocolSlug: 'noon',
    chain: Chain.ETHEREUM,
    address: '0xE24a3DC889621612422A64E6388927901608B91D',
    underlying: 'USDC',
    underlyingAddress: '0xdA67B4284609d2d48e5d10cfAc411572727dc1eD', // USN
    strategyAllocations: [
      { protocol: 'ethena', allocation: 70 },    // Primary delta-neutral strategy
      { protocol: 'aave-v3', allocation: 30 },   // Lending/liquidity
    ],
  },
  {
    id: 'noon:usn:zksync',
    name: 'Noon USN (zkSync)',
    protocol: 'Noon',
    protocolSlug: 'noon',
    chain: Chain.ETHEREUM, // Note: Actually zkSync Era
    underlying: 'USDC',
    strategies: ['ethena'],
  },

  // YieldNest - Liquid restaking
  // Source: https://docs.yieldnest.finance/security/deployment-addresses
  {
    id: 'yieldnest:yneth:ethereum',
    name: 'YieldNest ynETH',
    protocol: 'YieldNest',
    protocolSlug: 'yieldnest',
    chain: Chain.ETHEREUM,
    address: '0x09db87A538BD693E9d08544577d5cCfAA6373A48',
    underlying: 'ETH',
    strategyAllocations: [
      { protocol: 'eigenlayer', allocation: 60 },
      { protocol: 'lido', allocation: 40 },
    ],
  },
  {
    id: 'yieldnest:ynethx:ethereum',
    name: 'YieldNest ynETH MAX (ynETHx)',
    protocol: 'YieldNest',
    protocolSlug: 'yieldnest',
    chain: Chain.ETHEREUM,
    address: '0x657d9ABA1DBb59e53f9F3eCAA878447dCfC96dCb',
    underlying: 'ETH',
    strategyAllocations: [
      { protocol: 'eigenlayer', allocation: 50 },
      { protocol: 'aave-v3', allocation: 30 },
      { protocol: 'pendle', allocation: 20 },
    ],
  },
  {
    id: 'yieldnest:ynusdx:ethereum',
    name: 'YieldNest ynUSD MAX (ynUSDx)',
    protocol: 'YieldNest',
    protocolSlug: 'yieldnest',
    chain: Chain.ETHEREUM,
    address: '0x3DB228FE836D99Ccb25Ec4dfdC80ED6d2CDdCB4b',
    underlying: 'USDC',
    strategies: ['eigenlayer', 'aave-v3', 'pendle'],
  },

  // Ethena - Synthetic dollar (delta-neutral)
  {
    id: 'ethena:susde:ethereum',
    name: 'Ethena Staked USDe (sUSDe)',
    protocol: 'Ethena',
    protocolSlug: 'ethena',
    chain: Chain.ETHEREUM,
    address: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497', // ERC-4626
    underlying: 'USDe',
    underlyingAddress: '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3',
    strategyAllocations: [
      { protocol: 'lido', allocation: 60 },      // stETH collateral
      { protocol: 'aave-v3', allocation: 25 },   // Additional lending
      { protocol: 'morpho', allocation: 15 },    // Morpho markets
    ],
  },
];

// ============== TRACKED PROTOCOLS ==============

export const TRACKED_PROTOCOLS: TrackedProtocol[] = [
  {
    id: 'protocol:yearn-finance',
    name: 'Yearn Finance',
    slug: 'yearn-finance',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.ETHEREUM, Chain.ARBITRUM, Chain.OPTIMISM, Chain.POLYGON, Chain.BASE],
    governance: {
      type: GovernanceType.MULTISIG,
      multisigThreshold: '6/9',
      timelockHours: 24,
    },
    auditors: ['Trail of Bits', 'ChainSecurity', 'Statemind'],
    isUpgradeable: true,
  },
  {
    id: 'protocol:morpho',
    name: 'Morpho',
    slug: 'morpho',
    category: ProtocolCategory.LENDING,
    chains: [Chain.ETHEREUM, Chain.BASE],
    governance: {
      type: GovernanceType.MULTISIG,
      multisigThreshold: '3/5',
    },
    oracle: {
      type: OracleType.CHAINLINK,
      provider: 'Chainlink',
    },
    auditors: ['Spearbit', 'Cantina'],
    isUpgradeable: false, // Morpho Blue is immutable
  },
  {
    id: 'protocol:aave-v3',
    name: 'Aave V3',
    slug: 'aave-v3',
    category: ProtocolCategory.LENDING,
    chains: [Chain.ETHEREUM, Chain.ARBITRUM, Chain.OPTIMISM, Chain.POLYGON, Chain.BASE, Chain.AVALANCHE],
    governance: {
      type: GovernanceType.DAO,
      timelockHours: 24,
    },
    oracle: {
      type: OracleType.CHAINLINK,
      provider: 'Chainlink',
    },
    auditors: ['OpenZeppelin', 'SigmaPrime', 'Trail of Bits'],
    isUpgradeable: true,
  },
  {
    id: 'protocol:compound-v3',
    name: 'Compound V3',
    slug: 'compound-v3',
    category: ProtocolCategory.LENDING,
    chains: [Chain.ETHEREUM, Chain.ARBITRUM, Chain.POLYGON, Chain.BASE],
    governance: {
      type: GovernanceType.DAO,
      timelockHours: 48,
    },
    oracle: {
      type: OracleType.CHAINLINK,
      provider: 'Chainlink',
    },
    auditors: ['OpenZeppelin', 'ChainSecurity'],
    isUpgradeable: true,
  },
  {
    id: 'protocol:euler',
    name: 'Euler V2',
    slug: 'euler',
    category: ProtocolCategory.LENDING,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.DAO,
      timelockHours: 24,
    },
    oracle: {
      type: OracleType.CHAINLINK,
      provider: 'Chainlink',
    },
    auditors: ['Spearbit', 'Omniscia'],
    isUpgradeable: true,
  },
  {
    id: 'protocol:sommelier',
    name: 'Sommelier',
    slug: 'sommelier',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
      multisigThreshold: '4/7',
    },
    auditors: ['Macro', 'Zellic'],
    isUpgradeable: false,
  },
  {
    id: 'protocol:lido',
    name: 'Lido',
    slug: 'lido',
    category: ProtocolCategory.LIQUID_STAKING,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.DAO,
      timelockHours: 72,
    },
    auditors: ['MixBytes', 'Statemind', 'Ackee Blockchain'],
    isUpgradeable: true,
  },
  {
    id: 'protocol:chainlink',
    name: 'Chainlink',
    slug: 'chainlink',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM, Chain.ARBITRUM, Chain.OPTIMISM, Chain.POLYGON, Chain.BASE, Chain.AVALANCHE],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: ['Trail of Bits', 'Sigma Prime'],
    isUpgradeable: true,
  },

  // ============== TRACKED PORTFOLIO PROTOCOL ADDITIONS ==============

  // infiniFi - Fractional reserve banking
  {
    id: 'protocol:infinifi',
    name: 'infiniFi',
    slug: 'infinifi',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [], // New protocol - audit status pending
    isUpgradeable: true,
  },

  // Resolv Labs - Delta-neutral stablecoin
  {
    id: 'protocol:resolv',
    name: 'Resolv',
    slug: 'resolv',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM, Chain.BASE],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    oracle: {
      type: OracleType.CHAINLINK,
      provider: 'Chainlink',
    },
    auditors: [], // Seed-stage protocol
    isUpgradeable: true,
  },

  // Yuzu Money - Overcollateralized yield stablecoin
  {
    id: 'protocol:yuzu-money',
    name: 'Yuzu Money',
    slug: 'yuzu-money',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [], // Incubated by Ouroboros Capital
    isUpgradeable: true,
  },

  // Avant Protocol - Avalanche yield
  {
    id: 'protocol:avant-protocol',
    name: 'Avant Protocol',
    slug: 'avant-protocol',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.AVALANCHE],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [], // Has "independent audits" per docs
    isUpgradeable: true,
  },

  // Noon - Smart yield stablecoin
  {
    id: 'protocol:noon',
    name: 'Noon',
    slug: 'noon',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [], // New protocol - 2025 launch
    isUpgradeable: true,
  },

  // YieldNest - Liquid restaking
  {
    id: 'protocol:yieldnest',
    name: 'YieldNest',
    slug: 'yieldnest',
    category: ProtocolCategory.LIQUID_STAKING,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.DAO, // Uses Aragon
    },
    auditors: ['Zokyo', 'Composable Security'],
    isUpgradeable: true,
  },

  // Ethena - Synthetic dollar
  {
    id: 'protocol:ethena',
    name: 'Ethena',
    slug: 'ethena',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    oracle: {
      type: OracleType.CHAINLINK,
      provider: 'Chainlink',
    },
    auditors: ['Quantstamp', 'Pashov'],
    isUpgradeable: true,
  },

  // Pendle - Yield trading
  {
    id: 'protocol:pendle',
    name: 'Pendle',
    slug: 'pendle',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.ETHEREUM, Chain.ARBITRUM, Chain.BASE],
    governance: {
      type: GovernanceType.DAO,
      timelockHours: 24,
    },
    auditors: ['Dedaub', 'Ackee Blockchain'],
    isUpgradeable: true,
  },

  // Fluid - Lending protocol
  {
    id: 'protocol:fluid',
    name: 'Fluid',
    slug: 'fluid',
    category: ProtocolCategory.LENDING,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    oracle: {
      type: OracleType.CHAINLINK,
      provider: 'Chainlink',
    },
    auditors: [], // By Instadapp team
    isUpgradeable: true,
  },

  // EigenLayer - Restaking
  {
    id: 'protocol:eigenlayer',
    name: 'EigenLayer',
    slug: 'eigenlayer',
    category: ProtocolCategory.LIQUID_STAKING,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: ['Sigma Prime', 'Consensys Diligence'],
    isUpgradeable: true,
  },

  // Re.xyz - Insurance-backed stablecoin
  {
    id: 'protocol:rexyz',
    name: 'Re.xyz',
    slug: 'rexyz',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM, Chain.AVALANCHE],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: ['Hacken', 'Certora', 'The Network Firm'],
    isUpgradeable: true,
  },

  // Reinsurance - Traditional insurance risk pools
  {
    id: 'protocol:reinsurance',
    name: 'Reinsurance Risk Pools',
    slug: 'reinsurance',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG, // Managed by vetted Cell Managers
    },
    auditors: ['Grant Thornton'],
    isUpgradeable: false, // Off-chain traditional reinsurance
  },

  // Reservoir - Next-gen stablecoin protocol
  {
    id: 'protocol:reservoir',
    name: 'Reservoir',
    slug: 'reservoir',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.DAO,
    },
    auditors: [],
    isUpgradeable: true,
  },

  // T-Bills - Real World Assets (RWA)
  {
    id: 'protocol:tbills',
    name: 'US Treasury Bills',
    slug: 'tbills',
    category: ProtocolCategory.STABLECOIN, // RWA category
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.IMMUTABLE, // US Government - not upgradeable
    },
    auditors: [],
    isUpgradeable: false,
  },

  // Curve - DEX
  {
    id: 'protocol:curve',
    name: 'Curve Finance',
    slug: 'curve',
    category: ProtocolCategory.DEX,
    chains: [Chain.ETHEREUM, Chain.ARBITRUM, Chain.OPTIMISM, Chain.POLYGON, Chain.BASE, Chain.AVALANCHE],
    governance: {
      type: GovernanceType.DAO,
      timelockHours: 24,
    },
    auditors: ['Trail of Bits', 'Quantstamp', 'MixBytes'],
    isUpgradeable: true,
  },

  // Cap - Structured product protocol (stcUSD)
  {
    id: 'protocol:cap',
    name: 'Cap',
    slug: 'cap',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [],
    isUpgradeable: true,
  },

  // Maple Finance - Institutional lending
  {
    id: 'protocol:maple',
    name: 'Maple Finance',
    slug: 'maple',
    category: ProtocolCategory.LENDING,
    chains: [Chain.ETHEREUM, Chain.BASE],
    governance: {
      type: GovernanceType.DAO,
    },
    auditors: ['Trail of Bits', 'Peckshield'],
    isUpgradeable: true,
  },

  // Spark Protocol - MakerDAO lending
  {
    id: 'protocol:spark',
    name: 'Spark Protocol',
    slug: 'spark',
    category: ProtocolCategory.LENDING,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.DAO, // MakerDAO governance
      timelockHours: 48,
    },
    auditors: ['ChainSecurity', 'Cantina'],
    isUpgradeable: true,
  },

  // Other/Multi-strategy
  {
    id: 'protocol:other',
    name: 'Other Strategies',
    slug: 'other',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [],
    isUpgradeable: true,
  },
];

// ============== TRACKED TOKENS ==============

export const TRACKED_TOKENS: TrackedToken[] = [
  {
    id: 'token:USDC:ethereum',
    symbol: 'USDC',
    name: 'USD Coin',
    chain: Chain.ETHEREUM,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    type: 'stablecoin',
    issuer: 'issuer:circle',
    peggedTo: 'USD',
  },
  {
    id: 'token:USDT:ethereum',
    symbol: 'USDT',
    name: 'Tether USD',
    chain: Chain.ETHEREUM,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    type: 'stablecoin',
    issuer: 'issuer:tether',
    peggedTo: 'USD',
  },
  {
    id: 'token:DAI:ethereum',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    chain: Chain.ETHEREUM,
    address: '0x6B175474E89094C44Da98b954EedscdeCB5c6fBa7',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'issuer:maker',
    peggedTo: 'USD',
  },
  {
    id: 'token:WETH:ethereum',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    chain: Chain.ETHEREUM,
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    type: 'wrapped',
  },
  {
    id: 'token:stETH:ethereum',
    symbol: 'stETH',
    name: 'Lido Staked ETH',
    chain: Chain.ETHEREUM,
    address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    decimals: 18,
    type: 'lst',
    issuer: 'protocol:lido',
  },
  {
    id: 'token:wstETH:ethereum',
    symbol: 'wstETH',
    name: 'Wrapped stETH',
    chain: Chain.ETHEREUM,
    address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
    decimals: 18,
    type: 'lst',
    issuer: 'protocol:lido',
  },
];

// ============== TRACKED ISSUERS ==============

export const TRACKED_ISSUERS: TrackedIssuer[] = [
  {
    id: 'issuer:circle',
    name: 'Circle',
    type: 'centralized',
    tokens: ['token:USDC:ethereum'],
  },
  {
    id: 'issuer:tether',
    name: 'Tether',
    type: 'centralized',
    tokens: ['token:USDT:ethereum'],
  },
  {
    id: 'issuer:maker',
    name: 'MakerDAO',
    type: 'decentralized',
    tokens: ['token:DAI:ethereum'],
  },
];

// ============== HELPER FUNCTIONS ==============

export function getVaultById(id: string): TrackedVault | undefined {
  return TRACKED_VAULTS.find(v => v.id === id);
}

export function getVaultsByProtocol(protocolSlug: string): TrackedVault[] {
  return TRACKED_VAULTS.filter(v => v.protocolSlug === protocolSlug);
}

export function getVaultsByChain(chain: Chain): TrackedVault[] {
  return TRACKED_VAULTS.filter(v => v.chain === chain);
}

export function getProtocolById(id: string): TrackedProtocol | undefined {
  return TRACKED_PROTOCOLS.find(p => p.id === id);
}

export function getProtocolBySlug(slug: string): TrackedProtocol | undefined {
  return TRACKED_PROTOCOLS.find(p => p.slug === slug);
}

export function getTokenById(id: string): TrackedToken | undefined {
  return TRACKED_TOKENS.find(t => t.id === id);
}

export function getIssuerById(id: string): TrackedIssuer | undefined {
  return TRACKED_ISSUERS.find(i => i.id === id);
}
