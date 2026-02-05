// Registry of tracked vault products and their dependencies
// Based on popular DeFi yield vaults and risk curators

import { Chain, EntityType, ProtocolCategory, GovernanceType, OracleType } from '@/types/core';

export interface StrategyAllocation {
  protocol: string; // Protocol slug
  allocation: number; // Percentage 0-100
  asset?: string; // Underlying stablecoin/asset (e.g., 'USDC', 'USDe', 'stcUSD')
  market?: string; // Market identifier (e.g., 'wstETH/USDC')
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
  // For yield-bearing protocols (like Cap, Ethena) that have their own underlying exposures
  strategyAllocations?: StrategyAllocation[];
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
      { protocol: 'aave-v3', allocation: 45, asset: 'USDC' },    // Primary lending
      { protocol: 'compound-v3', allocation: 35, asset: 'USDC' }, // Secondary lending
      { protocol: 'morpho', allocation: 20, asset: 'USDC' },      // Optimized lending
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
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 40, asset: 'DAI' },
      { protocol: 'compound-v3', allocation: 35, asset: 'DAI' },
      { protocol: 'morpho', allocation: 25, asset: 'DAI' },
    ],
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
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 40, asset: 'WETH' },
      { protocol: 'compound-v3', allocation: 30, asset: 'WETH' },
      { protocol: 'lido', allocation: 30, asset: 'stETH' },
    ],
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
    strategyAllocations: [
      { protocol: 'morpho-blue', allocation: 100, asset: 'USDC', market: 'wstETH/USDC' },
    ],
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
    strategyAllocations: [
      { protocol: 'morpho-blue', allocation: 100, asset: 'USDC', market: 'wstETH/USDC' },
    ],
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
    strategyAllocations: [
      { protocol: 'morpho-blue', allocation: 100, asset: 'USDC', market: 'cbETH/USDC' },
    ],
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
    strategyAllocations: [
      { protocol: 'morpho-blue', allocation: 100, asset: 'WETH', market: 'wstETH/WETH' },
    ],
  },

  // Euler V2 Vaults
  {
    id: 'euler:usdc:ethereum',
    name: 'Euler V2 USDC',
    protocol: 'Euler',
    protocolSlug: 'euler',
    chain: Chain.ETHEREUM,
    underlying: 'USDC',
    strategyAllocations: [
      { protocol: 'euler-v2', allocation: 100, asset: 'USDC' },
    ],
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
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 40, asset: 'stETH' },
      { protocol: 'morpho', allocation: 35, asset: 'stETH' },
      { protocol: 'uniswap-v3', allocation: 25, asset: 'stETH' },
    ],
  },
  {
    id: 'sommelier:real-yield-usd:ethereum',
    name: 'Sommelier Real Yield USD',
    protocol: 'Sommelier',
    protocolSlug: 'sommelier',
    chain: Chain.ETHEREUM,
    address: '0x97e6E0a40a3D02F12d1cEC30ebfbAE04e37C119E',
    underlying: 'USDC',
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 40, asset: 'USDC' },
      { protocol: 'compound-v3', allocation: 35, asset: 'USDC' },
      { protocol: 'frax', allocation: 25, asset: 'FRAX' },
    ],
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
  // Source: On-chain wallet analysis via DeBank bundle (verified Feb 2026)
  // Bundle: https://debank.com/bundles/220816/accounts
  // TVL: ~$143M across 21 wallets
  {
    id: 'infinifi:siusd:ethereum',
    name: 'infiniFi Staked iUSD (siUSD)',
    protocol: 'infiniFi',
    protocolSlug: 'infinifi',
    chain: Chain.ETHEREUM,
    address: '0xDBDC1Ef57537E34680B898E1FEBD3D68c7389bCB', // ERC-4626
    underlying: 'USDC',
    underlyingAddress: '0x48f9e38f3070AD8945DFEae3FA70987722E3D89c', // iUSD
    // Verified allocations from on-chain wallets:
    // 0xe945...1ea4: $63.5M Cap stcUSD
    // 0x3881...a0ba: $18.3M Ethena sUSDe
    // 0x1484...657a: $19.4M Fluid USDC
    // 0xeb32...6fd7: $13.7M Ethena sUSDe
    // 0x6fbc...07a5: $6.9M Euler USDC
    // 0x76d2...5b78: $5.0M Morpho Steakhouse USDC
    // 0x817d...e032: $5.0M Aave V3 USDC
    // 0xbe2b...2ae8: $4.8M Aave V3 RLUSD
    // 0xbfd5...3580: $1.8M Aave V3 USDC
    // 0xd880...e563: $1.8M Spark USDC
    // 0x6f53...86de: $1.5M Reservoir wsrUSD
    strategyAllocations: [
      { protocol: 'cap', allocation: 44, asset: 'stcUSD' },           // Verified: $63.5M Cap stcUSD
      { protocol: 'ethena', allocation: 22, asset: 'sUSDe' },         // Verified: $32M Ethena sUSDe
      { protocol: 'fluid', allocation: 14, asset: 'USDC' },           // Verified: $19.4M Fluid USDC
      { protocol: 'aave-v3', allocation: 5, asset: 'USDC' },          // Verified: $6.8M Aave V3 USDC
      { protocol: 'euler', allocation: 5, asset: 'USDC' },            // Verified: $6.9M Euler USDC
      { protocol: 'aave-v3', allocation: 3, asset: 'RLUSD' },         // Verified: $4.8M Aave V3 RLUSD
      { protocol: 'morpho', allocation: 4, asset: 'USDC' },           // Verified: $5.0M Morpho Steakhouse
      { protocol: 'spark', allocation: 1, asset: 'USDC' },            // Verified: $1.8M Spark USDC
      { protocol: 'reservoir', allocation: 1, asset: 'wsrUSD' },      // Verified: $1.5M Reservoir wsrUSD
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
    // liUSD uses same underlying pools as siUSD but with longer lock periods
    // Allocations mirror siUSD since funds are deployed to same wallets
    strategyAllocations: [
      { protocol: 'cap', allocation: 44, asset: 'stcUSD' },           // Cap stcUSD (illiquid)
      { protocol: 'ethena', allocation: 22, asset: 'sUSDe' },         // Ethena sUSDe (illiquid)
      { protocol: 'fluid', allocation: 14, asset: 'USDC' },           // Fluid USDC
      { protocol: 'aave-v3', allocation: 5, asset: 'USDC' },          // Aave V3 USDC
      { protocol: 'euler', allocation: 5, asset: 'USDC' },            // Euler USDC
      { protocol: 'aave-v3', allocation: 3, asset: 'RLUSD' },         // Aave V3 RLUSD
      { protocol: 'morpho', allocation: 4, asset: 'USDC' },           // Morpho Steakhouse
      { protocol: 'spark', allocation: 1, asset: 'USDC' },            // Spark USDC
      { protocol: 'reservoir', allocation: 1, asset: 'wsrUSD' },      // Reservoir wsrUSD
    ],
  },

  // Re.xyz - Insurance-backed stablecoin
  // Source: DeBank bundle https://debank.com/bundles/220455/portfolio (verified Feb 2026)
  // TVL: $117.4M across 14 addresses
  // Actual holdings: Ethena sUSDe $99.8M (85%), Wallet stables $16.2M (14%), Curve LP $1.4M (1%)
  {
    id: 'rexyz:reusd:ethereum',
    name: 'Re.xyz reUSD (Basis-Plus)',
    protocol: 'Re.xyz',
    protocolSlug: 'rexyz',
    chain: Chain.ETHEREUM,
    address: '0x5086bf358635b81d8c47c66d1c8b9e567db70c72',
    underlying: 'USDC',
    strategyAllocations: [
      { protocol: 'ethena', allocation: 85, asset: 'sUSDe' },         // Verified: $99.8M Ethena sUSDe staked
      { protocol: 'usdc-reserve', allocation: 7, asset: 'USDC' },     // Verified: $7.8M USDC in wallet
      { protocol: 'ethena', allocation: 3, asset: 'sUSDe' },          // Verified: $3.3M sUSDe in wallet
      { protocol: 'ethena', allocation: 2, asset: 'USDe' },           // Verified: $2.6M USDe in wallet
      { protocol: 'usdt-reserve', allocation: 1, asset: 'USDT' },     // Verified: $1.5M USDT
      { protocol: 'curve', allocation: 1, asset: 'reUSD+USDe' },      // Verified: $1.4M Curve LP
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
    // reUSDe uses same underlying pools, heavily Ethena-focused
    strategyAllocations: [
      { protocol: 'ethena', allocation: 85, asset: 'sUSDe' },         // Same pool as reUSD
      { protocol: 'usdc-reserve', allocation: 10, asset: 'USDC' },
      { protocol: 'curve', allocation: 5, asset: 'reUSD+USDe' },
    ],
  },

  // Reservoir - Next-gen stablecoin protocol
  // Source: DeBank bundle https://debank.com/bundles/220818/portfolio (verified Feb 2026)
  // TVL: $86.6M across 21 addresses
  // Key insight: Heavy PYUSD and RLUSD exposure via Euler/Morpho, plus infiniFi siUSD
  {
    id: 'reservoir:rusd:ethereum',
    name: 'Reservoir rUSD',
    protocol: 'Reservoir',
    protocolSlug: 'reservoir',
    chain: Chain.ETHEREUM,
    address: '0x09d4214c03d01f49544c0448dbe3a27f768f2b34',
    underlying: 'USDC',
    strategyAllocations: [
      { protocol: 'euler', allocation: 31, asset: 'PYUSD' },          // Verified: $26.5M Euler PYUSD
      { protocol: 'morpho', allocation: 28, asset: 'PYUSD' },         // Verified: $24M Morpho Sentora PYUSD
      { protocol: 'euler', allocation: 18, asset: 'RLUSD' },          // Verified: $15.2M Euler RLUSD
      { protocol: 'aave-v3', allocation: 8, asset: 'USDG+RLUSD' },    // Verified: $7.3M Aave USDG+RLUSD
      { protocol: 'dolomite', allocation: 5, asset: 'USD1' },         // Verified: $4.5M Dolomite USD1
      { protocol: 'infinifi', allocation: 4, asset: 'siUSD' },        // Verified: $3.2M infiniFi siUSD
      { protocol: 'fluid', allocation: 3, asset: 'USDC' },            // Verified: $2.4M Fluid USDC
      { protocol: 'morpho', allocation: 1, asset: 'USDC' },           // Verified: $1.7M Morpho USDC vaults
      { protocol: 'uniswap-v3', allocation: 1, asset: 'USDC+USDT' },  // Verified: $1.1M Uniswap V4 LP
      { protocol: 'pendle', allocation: 1, asset: 'PT-iUSD' },        // Verified: $178K Pendle positions
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
    // srUSD shares same underlying pools as rUSD
    strategyAllocations: [
      { protocol: 'euler', allocation: 31, asset: 'PYUSD' },
      { protocol: 'morpho', allocation: 28, asset: 'PYUSD' },
      { protocol: 'euler', allocation: 18, asset: 'RLUSD' },
      { protocol: 'aave-v3', allocation: 8, asset: 'USDG+RLUSD' },
      { protocol: 'dolomite', allocation: 5, asset: 'USD1' },
      { protocol: 'infinifi', allocation: 4, asset: 'siUSD' },
      { protocol: 'fluid', allocation: 3, asset: 'USDC' },
      { protocol: 'other', allocation: 3, asset: 'USDC' },
    ],
  },

  // Resolv Labs - Delta-neutral stablecoin
  // Source: DeBank bundle https://debank.com/bundles/220554/portfolio (verified Feb 2026)
  // TVL: $292.4M across 11 addresses
  // Key insight: Heavy leveraged Aave ETH/stETH/LBTC positions + Fluid/Morpho stables
  {
    id: 'resolv:usr:ethereum',
    name: 'Resolv USR',
    protocol: 'Resolv',
    protocolSlug: 'resolv',
    chain: Chain.ETHEREUM,
    address: '0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110',
    underlying: 'USDC',
    // Verified allocations from on-chain:
    // Aave V3: $147.5M leveraged ETH/stETH/LBTC (collateral) borrowing WETH/WBTC/USDC
    // Fluid: $80.1M USDT0 + $26.9M GHO/USDC
    // Morpho: $26.4M leveraged LBTC borrowing WBTC
    // Aave V3: $8.6M USDT0
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 50, asset: 'ETH+stETH+LBTC' }, // Verified: $147.5M leveraged collateral
      { protocol: 'fluid', allocation: 27, asset: 'USDT0' },           // Verified: $80.1M Fluid USDT0
      { protocol: 'morpho', allocation: 9, asset: 'LBTC' },            // Verified: $26.4M Morpho leveraged LBTC
      { protocol: 'fluid', allocation: 9, asset: 'GHO+USDC' },         // Verified: $26.9M Fluid GHO+USDC
      { protocol: 'aave-v3', allocation: 3, asset: 'USDT0' },          // Verified: $8.6M Aave USDT0
      { protocol: 'lido', allocation: 1, asset: 'stETH' },             // Verified: $42K stETH
      { protocol: 'other', allocation: 1, asset: 'ETH' },              // Wallet ETH + other
    ],
  },
  {
    id: 'resolv:rlp:ethereum',
    name: 'Resolv RLP (Risk Layer)',
    protocol: 'Resolv',
    protocolSlug: 'resolv',
    chain: Chain.ETHEREUM,
    address: '0x4956b52aE2fF65D74CA2d61207523288e4528f96',
    underlying: 'USDC',
    // RLP shares same underlying pools - absorbs funding rate risk
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 50, asset: 'ETH+stETH+LBTC' },
      { protocol: 'fluid', allocation: 27, asset: 'USDT0' },
      { protocol: 'morpho', allocation: 9, asset: 'LBTC' },
      { protocol: 'fluid', allocation: 9, asset: 'GHO+USDC' },
      { protocol: 'aave-v3', allocation: 3, asset: 'USDT0' },
      { protocol: 'other', allocation: 2, asset: 'ETH' },
    ],
  },

  // Yuzu Money (OuroborosCap8) - Overcollateralized stablecoin
  // Yuzu Money - Overcollateralized stablecoin
  // Source: https://yuzu.accountable.capital/ (on-chain wallet analysis)
  // Wallets: 0x815f5BB257e88b67216a344C7C83a3eA4EE74748 (Main 1), 0x502D222e8e4DaEF69032f55F0c1A999EFFd78fB3 (Main 4)
  // Strategy: Maple syrupUSDT + Aave leveraged sUSDe/USDe + Pendle cUSDO LP
  {
    id: 'yuzu:yzusd:ethereum',
    name: 'Yuzu yzUSD',
    protocol: 'Yuzu Money',
    protocolSlug: 'yuzu-money',
    chain: Chain.ETHEREUM,
    underlying: 'USDC',
    curator: 'Ouroboros Capital',
    strategyAllocations: [
      { protocol: 'maple', allocation: 45, asset: 'syrupUSDT' },        // Main Wallet 1: Maple Finance syrupUSDT
      { protocol: 'aave-v3', allocation: 40, asset: 'sUSDe' },          // Main Wallet 4: Leveraged sUSDe/USDe loop
      { protocol: 'pendle', allocation: 10, asset: 'cUSDO' },           // Main Wallet 2: Pendle LP cUSDO (OpenEden T-bills)
      { protocol: 'usdt-reserve', allocation: 5, asset: 'USDT' },       // Liquidity Buffer: USDT
    ],
  },
  {
    id: 'yuzu:syzusd:ethereum',
    name: 'Yuzu Staked yzUSD (syzUSD)',
    protocol: 'Yuzu Money',
    protocolSlug: 'yuzu-money',
    chain: Chain.ETHEREUM,
    underlying: 'USDC',
    curator: 'Ouroboros Capital',
    strategyAllocations: [
      { protocol: 'maple', allocation: 45, asset: 'syrupUSDT' },        // Maple Finance syrupUSDT
      { protocol: 'aave-v3', allocation: 40, asset: 'sUSDe' },          // Leveraged sUSDe/USDe on Aave
      { protocol: 'pendle', allocation: 10, asset: 'cUSDO' },           // Pendle LP cUSDO (OpenEden T-bills)
      { protocol: 'usdt-reserve', allocation: 5, asset: 'USDT' },       // USDT liquidity buffer
    ],
  },

  // Avant Protocol - Multi-chain yield protocol
  // Source: DeBank bundle https://debank.com/bundles/220645/portfolio (verified Feb 2026)
  // TVL: $116.4M across 20 addresses
  // Key insight: Heavily leveraged Aave positions with USDe/sUSDe + Maple syrup tokens
  {
    id: 'avant:savusd:avalanche',
    name: 'Avant Staked avUSD (savUSD)',
    protocol: 'Avant',
    protocolSlug: 'avant-protocol',
    chain: Chain.AVALANCHE,
    address: '0x06d47F3fb376649c3A9Dafe069B3D6E35572219E',
    underlying: 'USDC',
    // Verified allocations from on-chain:
    // Aave V3 ETH: $50.8M leveraged USDe borrowing USDT/USDC
    // Aave V3 Plasma: $30.3M leveraged sUSDe+USDe+syrupUSDT borrowing USDT0
    // Aave V3 Base: $25.3M leveraged syrupUSDC borrowing USDC
    // Morpho: $7.2M USDC positions
    // Upshift: $940K USDe
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 44, asset: 'USDe' },          // Verified: $50.8M leveraged USDe
      { protocol: 'aave-v3', allocation: 26, asset: 'sUSDe+syrupUSDT' }, // Verified: $30.3M Plasma positions
      { protocol: 'aave-v3', allocation: 22, asset: 'syrupUSDC' },     // Verified: $25.3M Base syrupUSDC
      { protocol: 'morpho', allocation: 6, asset: 'USDC' },            // Verified: $7.2M Morpho USDC
      { protocol: 'other', allocation: 2, asset: 'USDC' },             // Verified: Wallet + Upshift
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
    // BTC vault uses similar leveraged strategies
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 90, asset: 'BTC' },
      { protocol: 'morpho', allocation: 10, asset: 'BTC' },
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
    // ETH vault uses similar leveraged strategies
    strategyAllocations: [
      { protocol: 'aave-v3', allocation: 90, asset: 'ETH' },
      { protocol: 'morpho', allocation: 10, asset: 'ETH' },
    ],
  },

  // Noon - Smart yield stablecoin
  // Source: DeBank bundle https://debank.com/bundles/220819/portfolio (verified Feb 2026)
  // TVL: $20.5M across 4 addresses
  // Key insight: Primarily Dinari (T-bills) + Morpho/Pendle/Euler DeFi yields
  {
    id: 'noon:susn:ethereum',
    name: 'Noon Staked USN (sUSN)',
    protocol: 'Noon',
    protocolSlug: 'noon',
    chain: Chain.ETHEREUM,
    address: '0xE24a3DC889621612422A64E6388927901608B91D',
    underlying: 'USDC',
    underlyingAddress: '0xdA67B4284609d2d48e5d10cfAc411572727dc1eD', // USN
    // Verified allocations from on-chain:
    // Dinari: $12.7M (USD+ T-bills via USDC)
    // Morpho: $3.3M (Smokehouse USDC + PT-stcUSD)
    // Pendle V2: $2.0M (PT-sUSDE-7MAY2026)
    // Euler: $1.6M (USDC)
    // Wallet: $889K (USDC)
    strategyAllocations: [
      { protocol: 'dinari', allocation: 62, asset: 'USD+' },          // Verified: $12.7M Dinari T-bills
      { protocol: 'morpho', allocation: 16, asset: 'USDC' },          // Verified: $3.3M Morpho Smokehouse
      { protocol: 'pt-susde', allocation: 10, asset: 'PT-sUSDe' },    // Verified: $2.0M Pendle PT-sUSDe
      { protocol: 'euler', allocation: 8, asset: 'USDC' },            // Verified: $1.6M Euler USDC
      { protocol: 'usdc-reserve', allocation: 4, asset: 'USDC' },     // Verified: $889K wallet USDC
    ],
  },
  {
    id: 'noon:usn:zksync',
    name: 'Noon USN (zkSync)',
    protocol: 'Noon',
    protocolSlug: 'noon',
    chain: Chain.ETHEREUM, // Note: Actually zkSync Era
    underlying: 'USDC',
    // zkSync deployment - same strategy
    strategyAllocations: [
      { protocol: 'dinari', allocation: 62, asset: 'USD+' },
      { protocol: 'morpho', allocation: 16, asset: 'USDC' },
      { protocol: 'pt-susde', allocation: 10, asset: 'PT-sUSDe' },
      { protocol: 'euler', allocation: 8, asset: 'USDC' },
      { protocol: 'usdc-reserve', allocation: 4, asset: 'USDC' },
    ],
  },

  // YieldNest - Liquid restaking & yield strategies
  // Source: DeBank profile https://debank.com/profile/0x0000000f2eB9f69274678c76222B35eEc7588a65 (verified Feb 2026)
  // TVL: $31.7M
  // Key insight: Diversified across AUTO, Morpho, Aave, infiniFi, Avantis + RLP in wallet
  {
    id: 'yieldnest:yneth:ethereum',
    name: 'YieldNest ynETH',
    protocol: 'YieldNest',
    protocolSlug: 'yieldnest',
    chain: Chain.ETHEREUM,
    address: '0x09db87A538BD693E9d08544577d5cCfAA6373A48',
    underlying: 'ETH',
    strategyAllocations: [
      { protocol: 'eigenlayer', allocation: 60, asset: 'ETH' },
      { protocol: 'lido', allocation: 40, asset: 'stETH' },
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
      { protocol: 'eigenlayer', allocation: 50, asset: 'ETH' },
      { protocol: 'aave-v3', allocation: 30, asset: 'WETH' },
      { protocol: 'pt-eeth', allocation: 20, asset: 'PT-eETH' },
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
    // Verified allocations from on-chain:
    // AUTO Finance: $7.5M (USDC farming)
    // Morpho: $7.8M (USDC, PYUSD, Re Ecosystem, Extrafi, Gauntlet)
    // Aave V3: $5.3M (USDG, RLUSD, staked GHO)
    // Wallet: $4.6M (RLP $2.8M, USDC $1.8M)
    // infiniFi: $2.8M (locked iUSD)
    // Avantis: $2.3M (USDC Junior Tranche)
    // Fluid: $1.0M (GHO)
    // Revert: $418K (USDC)
    strategyAllocations: [
      { protocol: 'morpho', allocation: 25, asset: 'USDC+PYUSD' },    // Verified: $7.8M Morpho various
      { protocol: 'auto-finance', allocation: 24, asset: 'USDC' },   // Verified: $7.5M AUTO Finance
      { protocol: 'aave-v3', allocation: 17, asset: 'USDG+RLUSD+GHO' }, // Verified: $5.3M Aave positions
      { protocol: 'resolv', allocation: 9, asset: 'RLP' },           // Verified: $2.8M RLP in wallet
      { protocol: 'infinifi', allocation: 9, asset: 'iUSD' },        // Verified: $2.8M infiniFi locked
      { protocol: 'avantis', allocation: 7, asset: 'USDC' },         // Verified: $2.3M Avantis junior
      { protocol: 'usdc-reserve', allocation: 6, asset: 'USDC' },    // Verified: $1.8M USDC in wallet
      { protocol: 'fluid', allocation: 3, asset: 'GHO' },            // Verified: $1.0M Fluid GHO
    ],
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
      { protocol: 'delta-neutral', allocation: 60, asset: 'stETH' },  // stETH collateral + perps
      { protocol: 'delta-neutral', allocation: 25, asset: 'BTC' },    // BTC collateral + perps
      { protocol: 'delta-neutral', allocation: 15, asset: 'ETH' },    // ETH collateral + perps
    ],
  },

  // Cap Money - Yield-bearing stablecoin
  // stcUSD is an ERC-4626 vault on top of cUSD
  // cUSD is 1:1 redeemable backed by PYUSD, BUIDL, BENJI (max 40% single asset)
  // Source: https://blockworks.co/news/cap-labs-eigenlayer
  // Source: https://oakresearch.io/en/reports/protocols/cap-money-layer-verifiable-yield-stablecoins-mega-eth
  {
    id: 'cap:stcusd:ethereum',
    name: 'Cap stcUSD',
    protocol: 'Cap',
    protocolSlug: 'cap',
    chain: Chain.ETHEREUM,
    address: '0x4e0b5f4f0f7b6700d5b8c4b7b7b7b7b7b7b7b7b7', // Placeholder - needs verification
    underlying: 'cUSD',
    strategyAllocations: [
      { protocol: 'blackrock-buidl', allocation: 35, asset: 'BUIDL' },  // BlackRock T-bills (capped 40%)
      { protocol: 'paypal-pyusd', allocation: 35, asset: 'PYUSD' },     // PayPal USD
      { protocol: 'franklin-benji', allocation: 30, asset: 'BENJI' },   // Franklin Templeton
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

  // Ethena - Synthetic dollar (USDe/sUSDe)
  // USDe is backed by delta-neutral positions: long spot crypto + short perps
  // Source: https://app.ethena.fi/dashboards/transparency
  // Source: https://docs.ethena.fi/how-usde-works
  // Source: https://coinmetrics.substack.com/p/state-of-the-network-issue-335
  // Custody: Copper, CEFFU, Anchorage Digital, Kraken
  // ~14% ETH LSTs, ~50% BTC, ~29% ETH/SOL, ~7% stablecoins (USDC, USDT, USDtb)
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
    strategyAllocations: [
      { protocol: 'delta-neutral', allocation: 50, asset: 'BTC' },    // BTC + short BTC perps (largest allocation)
      { protocol: 'delta-neutral', allocation: 14, asset: 'stETH' },  // ETH LSTs + short ETH perps
      { protocol: 'delta-neutral', allocation: 14, asset: 'ETH' },    // Native ETH + short perps
      { protocol: 'delta-neutral', allocation: 15, asset: 'SOL' },    // SOL + short SOL perps (added Oct 2024)
      { protocol: 'usdt-reserve', allocation: 3, asset: 'USDT' },     // Tether reserve
      { protocol: 'usdc-reserve', allocation: 2, asset: 'USDC' },     // Circle reserve
      { protocol: 'tbills', allocation: 2, asset: 'USDtb' },          // USDtb (Ethena's T-bill token)
    ],
  },

  // Pendle - Yield trading (PT tokens)
  // ~70-75% of TVL is USDe/sUSDe derivatives
  // Source: https://defillama.com/protocol/pendle
  // Source: https://incrypted.com/en/how-pendle-ethena-and-aave-are-redefining-yield-farming/
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
    // Default PT allocation (protocols should specify which PT they use)
    strategyAllocations: [
      { protocol: 'pt-susde', allocation: 45, asset: 'PT-sUSDe' },   // PT-sUSDe (Ethena staked)
      { protocol: 'pt-usde', allocation: 25, asset: 'PT-USDe' },     // PT-USDe (Ethena base)
      { protocol: 'pt-eeth', allocation: 15, asset: 'PT-eETH' },     // PT-eETH (EtherFi)
      { protocol: 'pt-other', allocation: 15, asset: 'PT-other' },   // Other PT tokens
    ],
  },

  // Pendle PT tokens (underlying exposure)
  {
    id: 'protocol:pt-susde',
    name: 'Pendle PT-sUSDe',
    slug: 'pt-susde',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.ETHEREUM],
    governance: { type: GovernanceType.IMMUTABLE },
    auditors: [],
    isUpgradeable: false,
    strategyAllocations: [
      { protocol: 'ethena', allocation: 100, asset: 'sUSDe' }, // Underlying is sUSDe
    ],
  },
  {
    id: 'protocol:pt-usde',
    name: 'Pendle PT-USDe',
    slug: 'pt-usde',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.ETHEREUM],
    governance: { type: GovernanceType.IMMUTABLE },
    auditors: [],
    isUpgradeable: false,
    strategyAllocations: [
      { protocol: 'ethena', allocation: 100, asset: 'USDe' }, // Underlying is USDe
    ],
  },
  {
    id: 'protocol:pt-eeth',
    name: 'Pendle PT-eETH',
    slug: 'pt-eeth',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.ETHEREUM],
    governance: { type: GovernanceType.IMMUTABLE },
    auditors: [],
    isUpgradeable: false,
    strategyAllocations: [
      { protocol: 'etherfi', allocation: 100, asset: 'eETH' }, // Underlying is eETH
    ],
  },
  {
    id: 'protocol:pt-other',
    name: 'Pendle PT-Other',
    slug: 'pt-other',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.ETHEREUM],
    governance: { type: GovernanceType.IMMUTABLE },
    auditors: [],
    isUpgradeable: false,
  },

  // EtherFi - Liquid restaking
  {
    id: 'protocol:etherfi',
    name: 'EtherFi',
    slug: 'etherfi',
    category: ProtocolCategory.LIQUID_STAKING,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.DAO,
    },
    auditors: ['Certora', 'Zellic'],
    isUpgradeable: true,
    strategyAllocations: [
      { protocol: 'eigenlayer', allocation: 100, asset: 'ETH' }, // Restaked on EigenLayer
    ],
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
  // Tokenized treasuries issued by various RWA providers
  {
    id: 'protocol:tbills',
    name: 'Tokenized Treasuries',
    slug: 'tbills',
    category: ProtocolCategory.STABLECOIN, // RWA category
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG, // Managed by RWA issuers
    },
    auditors: [],
    isUpgradeable: false,
    // Typical allocation across RWA providers
    strategyAllocations: [
      { protocol: 'blackrock-buidl', allocation: 40, asset: 'BUIDL' },   // BlackRock USD Institutional Digital Liquidity
      { protocol: 'ondo-usdy', allocation: 30, asset: 'USDY' },          // Ondo US Dollar Yield
      { protocol: 'mountain-usdm', allocation: 20, asset: 'USDM' },      // Mountain Protocol USDM
      { protocol: 'hashnote-usyc', allocation: 10, asset: 'USYC' },      // Hashnote US Yield Coin
    ],
  },

  // BlackRock BUIDL - Institutional tokenized treasury fund
  {
    id: 'protocol:blackrock-buidl',
    name: 'BlackRock BUIDL',
    slug: 'blackrock-buidl',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG, // BlackRock managed
    },
    auditors: ['PwC'],
    isUpgradeable: false,
  },

  // Ondo USDY - Tokenized treasury notes
  {
    id: 'protocol:ondo-usdy',
    name: 'Ondo Finance USDY',
    slug: 'ondo-usdy',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: ['Code4rena', 'Nethermind'],
    isUpgradeable: true,
  },

  // Mountain Protocol USDM
  {
    id: 'protocol:mountain-usdm',
    name: 'Mountain Protocol USDM',
    slug: 'mountain-usdm',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: ['OpenZeppelin'],
    isUpgradeable: true,
  },

  // Hashnote USYC
  {
    id: 'protocol:hashnote-usyc',
    name: 'Hashnote USYC',
    slug: 'hashnote-usyc',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [],
    isUpgradeable: true,
  },

  // PayPal PYUSD
  {
    id: 'protocol:paypal-pyusd',
    name: 'PayPal USD',
    slug: 'paypal-pyusd',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: ['Paxos'],
    isUpgradeable: false,
  },

  // Franklin Templeton BENJI
  {
    id: 'protocol:franklin-benji',
    name: 'Franklin Templeton BENJI',
    slug: 'franklin-benji',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
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

  // Cap - Structured product protocol (stcUSD/cUSD)
  // cUSD is 1:1 redeemable backed by PYUSD, BUIDL, BENJI (max 40% single asset)
  // stcUSD is ERC-4626 vault on cUSD with operator yield strategies
  // Source: https://blockworks.co/news/cap-labs-eigenlayer
  // Source: https://oakresearch.io/en/reports/protocols/cap-money-layer-verifiable-yield-stablecoins-mega-eth
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
    strategyAllocations: [
      { protocol: 'blackrock-buidl', allocation: 35, asset: 'BUIDL' },  // BlackRock T-bills (capped 40%)
      { protocol: 'paypal-pyusd', allocation: 35, asset: 'PYUSD' },     // PayPal USD
      { protocol: 'franklin-benji', allocation: 30, asset: 'BENJI' },   // Franklin Templeton
    ],
  },

  // Maple Finance - Institutional lending (syrupUSDC)
  // Uncollateralized lending to institutional borrowers
  // Source: https://maple.finance/
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
    strategyAllocations: [
      { protocol: 'institutional-credit', allocation: 100, asset: 'USDC' }, // Uncollateralized institutional loans
    ],
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

  // Frax Finance
  {
    id: 'protocol:frax',
    name: 'Frax Finance',
    slug: 'frax',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM, Chain.ARBITRUM, Chain.OPTIMISM],
    governance: {
      type: GovernanceType.DAO,
      timelockHours: 24,
    },
    auditors: ['Trail of Bits', 'Certora'],
    isUpgradeable: true,
  },

  // Gauntlet (Risk Management / Vaults)
  {
    id: 'protocol:gauntlet',
    name: 'Gauntlet',
    slug: 'gauntlet',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.ETHEREUM, Chain.BASE],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [],
    isUpgradeable: true,
  },

  // Uniswap V3
  {
    id: 'protocol:uniswap-v3',
    name: 'Uniswap V3',
    slug: 'uniswap-v3',
    category: ProtocolCategory.DEX,
    chains: [Chain.ETHEREUM, Chain.ARBITRUM, Chain.OPTIMISM, Chain.POLYGON, Chain.BASE],
    governance: {
      type: GovernanceType.DAO,
      timelockHours: 48,
    },
    auditors: ['Trail of Bits', 'ABDK'],
    isUpgradeable: false, // Core contracts are immutable
  },

  // Morpho Blue (Lending Markets - distinct from Morpho vault protocol)
  {
    id: 'protocol:morpho-blue',
    name: 'Morpho Blue',
    slug: 'morpho-blue',
    category: ProtocolCategory.LENDING,
    chains: [Chain.ETHEREUM, Chain.BASE],
    governance: {
      type: GovernanceType.IMMUTABLE, // Morpho Blue is immutable
    },
    auditors: ['Spearbit', 'Cantina'],
    isUpgradeable: false,
  },

  // Delta-Neutral Strategies (perps hedging)
  // Includes CEX counterparty risk for perpetual futures
  // Custody providers: Copper, CEFFU, Anchorage Digital, Kraken
  {
    id: 'protocol:delta-neutral',
    name: 'Delta-Neutral (Perps)',
    slug: 'delta-neutral',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM, Chain.ARBITRUM, Chain.AVALANCHE],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [],
    isUpgradeable: true,
    strategyAllocations: [
      { protocol: 'custody-copper', allocation: 35, asset: 'CUSTODY' },    // Copper custody
      { protocol: 'custody-ceffu', allocation: 30, asset: 'CUSTODY' },     // CEFFU (Binance custody)
      { protocol: 'cex-counterparty', allocation: 35, asset: 'PERP' },     // CEX perp exposure
    ],
  },

  // Custody Providers
  {
    id: 'protocol:custody-copper',
    name: 'Copper.co',
    slug: 'custody-copper',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM],
    governance: { type: GovernanceType.MULTISIG },
    auditors: ['SOC 2 Type II'],
    isUpgradeable: false,
  },
  {
    id: 'protocol:custody-ceffu',
    name: 'CEFFU (Binance Custody)',
    slug: 'custody-ceffu',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM],
    governance: { type: GovernanceType.MULTISIG },
    auditors: ['SOC 2 Type II'],
    isUpgradeable: false,
  },

  // MakerDAO / Sky - DAI/sDAI issuer
  {
    id: 'protocol:maker',
    name: 'MakerDAO',
    slug: 'maker',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.DAO,
      timelockHours: 48,
    },
    auditors: ['Trail of Bits', 'ABDK', 'Runtime Verification'],
    isUpgradeable: true,
    strategyAllocations: [
      { protocol: 'tbills', allocation: 40, asset: 'USD' },           // RWA / T-bills
      { protocol: 'aave-v3', allocation: 20, asset: 'USDC' },         // D3M to Aave
      { protocol: 'spark', allocation: 25, asset: 'USDC' },           // Spark lending
      { protocol: 'collateral', allocation: 15, asset: 'ETH' },       // ETH/stETH vaults
    ],
  },

  // Institutional Credit Risk (Maple, etc.)
  {
    id: 'protocol:institutional-credit',
    name: 'Institutional Credit',
    slug: 'institutional-credit',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [],
    isUpgradeable: false, // Off-chain credit agreements
  },

  // Collateral (generic for CDP-style systems)
  {
    id: 'protocol:collateral',
    name: 'Collateral Backing',
    slug: 'collateral',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.IMMUTABLE,
    },
    auditors: [],
    isUpgradeable: false,
  },

  // USDT Reserve (Tether holdings)
  {
    id: 'protocol:usdt-reserve',
    name: 'USDT Reserve',
    slug: 'usdt-reserve',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [],
    isUpgradeable: false,
  },

  // USDC Reserve (Circle holdings)
  {
    id: 'protocol:usdc-reserve',
    name: 'USDC Reserve',
    slug: 'usdc-reserve',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [],
    isUpgradeable: false,
  },

  // CEX Counterparty Risk (for delta-neutral strategies)
  {
    id: 'protocol:cex-counterparty',
    name: 'CEX Counterparty',
    slug: 'cex-counterparty',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [],
    isUpgradeable: false,
    strategyAllocations: [
      { protocol: 'binance', allocation: 40, asset: 'PERP' },
      { protocol: 'bybit', allocation: 25, asset: 'PERP' },
      { protocol: 'okx', allocation: 20, asset: 'PERP' },
      { protocol: 'deribit', allocation: 15, asset: 'PERP' },
    ],
  },

  // CEX protocols
  {
    id: 'protocol:binance',
    name: 'Binance',
    slug: 'binance',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM],
    governance: { type: GovernanceType.MULTISIG },
    auditors: [],
    isUpgradeable: false,
  },
  {
    id: 'protocol:bybit',
    name: 'Bybit',
    slug: 'bybit',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM],
    governance: { type: GovernanceType.MULTISIG },
    auditors: [],
    isUpgradeable: false,
  },
  {
    id: 'protocol:okx',
    name: 'OKX',
    slug: 'okx',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM],
    governance: { type: GovernanceType.MULTISIG },
    auditors: [],
    isUpgradeable: false,
  },
  {
    id: 'protocol:deribit',
    name: 'Deribit',
    slug: 'deribit',
    category: ProtocolCategory.OTHER,
    chains: [Chain.ETHEREUM],
    governance: { type: GovernanceType.MULTISIG },
    auditors: [],
    isUpgradeable: false,
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

  // OpenEden - Tokenized T-bills (cUSDO)
  // Source: https://www.coingecko.com/en/coins/compounding-open-dollar
  // cUSDO is backed by US Treasury bills and reverse repurchase agreements
  {
    id: 'protocol:openeden',
    name: 'OpenEden',
    slug: 'openeden',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM, Chain.BASE],
    governance: {
      type: GovernanceType.MULTISIG, // BMA licensed digital asset issuer
    },
    auditors: [],
    isUpgradeable: false,
    strategyAllocations: [
      { protocol: 'tbills', allocation: 100, asset: 'USD' }, // US Treasury bills backing
    ],
  },

  // Pendle cUSDO LP (OpenEden T-bill exposure via Pendle)
  {
    id: 'protocol:pendle-cusdo',
    name: 'Pendle cUSDO LP',
    slug: 'pendle-cusdo',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.ETHEREUM],
    governance: { type: GovernanceType.IMMUTABLE },
    auditors: [],
    isUpgradeable: false,
    strategyAllocations: [
      { protocol: 'openeden', allocation: 100, asset: 'cUSDO' }, // Underlying is cUSDO
    ],
  },

  // Dinari - Tokenized T-bills (USD+)
  // Source: DeBank bundle analysis - Noon uses 62% allocation
  // USD+ is backed by US Treasury bills
  {
    id: 'protocol:dinari',
    name: 'Dinari',
    slug: 'dinari',
    category: ProtocolCategory.STABLECOIN,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [],
    isUpgradeable: true,
    strategyAllocations: [
      { protocol: 'tbills', allocation: 100, asset: 'USD' }, // US Treasury bills backing
    ],
  },

  // AUTO Finance - Yield optimization protocol
  // Source: DeBank analysis - YieldNest uses 24% allocation
  {
    id: 'protocol:auto-finance',
    name: 'AUTO Finance',
    slug: 'auto-finance',
    category: ProtocolCategory.YIELD_AGGREGATOR,
    chains: [Chain.ETHEREUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    auditors: [],
    isUpgradeable: true,
  },

  // Dolomite - Lending protocol on Arbitrum
  // Source: DeBank analysis - Reservoir uses 5% allocation for USD1
  {
    id: 'protocol:dolomite',
    name: 'Dolomite',
    slug: 'dolomite',
    category: ProtocolCategory.LENDING,
    chains: [Chain.ETHEREUM, Chain.ARBITRUM],
    governance: {
      type: GovernanceType.MULTISIG,
    },
    oracle: {
      type: OracleType.CHAINLINK,
      provider: 'Chainlink',
    },
    auditors: [],
    isUpgradeable: true,
  },

  // Avantis - Perpetual trading protocol
  // Source: DeBank analysis - YieldNest uses 7% allocation (junior tranche)
  {
    id: 'protocol:avantis',
    name: 'Avantis',
    slug: 'avantis',
    category: ProtocolCategory.DEX,
    chains: [Chain.ETHEREUM, Chain.BASE],
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
  {
    id: 'token:SOL:ethereum',
    symbol: 'SOL',
    name: 'Wrapped Solana',
    chain: Chain.ETHEREUM,
    address: '0xD31a59c85aE9D8edEFeC411D448f90841571b89c', // Wormhole wrapped SOL
    decimals: 9,
    type: 'native',
  },
  {
    id: 'token:BTC:ethereum',
    symbol: 'BTC',
    name: 'Bitcoin',
    chain: Chain.ETHEREUM,
    address: '0x0000000000000000000000000000000000000000', // Native BTC (represented)
    decimals: 8,
    type: 'native',
  },
  {
    id: 'token:ETH:ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    chain: Chain.ETHEREUM,
    address: '0x0000000000000000000000000000000000000000', // Native ETH
    decimals: 18,
    type: 'native',
  },
  // Additional stablecoins tracked in strategy allocations
  {
    id: 'token:USDe:ethereum',
    symbol: 'USDe',
    name: 'Ethena USDe',
    chain: Chain.ETHEREUM,
    address: '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'issuer:ethena',
    peggedTo: 'USD',
  },
  {
    id: 'token:GHO:ethereum',
    symbol: 'GHO',
    name: 'GHO Stablecoin',
    chain: Chain.ETHEREUM,
    address: '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'protocol:aave-v3',
    peggedTo: 'USD',
  },
  {
    id: 'token:USDS:ethereum',
    symbol: 'USDS',
    name: 'Sky Dollar',
    chain: Chain.ETHEREUM,
    address: '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'issuer:maker',
    peggedTo: 'USD',
  },
  {
    id: 'token:cUSD:ethereum',
    symbol: 'cUSD',
    name: 'Cap cUSD',
    chain: Chain.ETHEREUM,
    address: '0x0000000000000000000000000000000000000000', // Placeholder - needs verification
    decimals: 18,
    type: 'stablecoin',
    issuer: 'protocol:cap',
    peggedTo: 'USD',
  },
  {
    id: 'token:stcUSD:ethereum',
    symbol: 'stcUSD',
    name: 'Cap stcUSD',
    chain: Chain.ETHEREUM,
    address: '0x4e0b5f4f0f7b6700d5b8c4b7b7b7b7b7b7b7b7b7', // Placeholder - needs verification
    decimals: 18,
    type: 'stablecoin',
    issuer: 'protocol:cap',
    peggedTo: 'USD',
  },
  {
    id: 'token:rUSD:ethereum',
    symbol: 'rUSD',
    name: 'Reservoir rUSD',
    chain: Chain.ETHEREUM,
    address: '0x09d4214c03d01f49544c0448dbe3a27f768f2b34',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'protocol:reservoir',
    peggedTo: 'USD',
  },
  {
    id: 'token:RLUSD:ethereum',
    symbol: 'RLUSD',
    name: 'Ripple USD',
    chain: Chain.ETHEREUM,
    address: '0x8292Bb45bf1Ee4d140127049757C2E0fE8Eb35d0',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'issuer:ripple',
    peggedTo: 'USD',
  },
  {
    id: 'token:FRAX:ethereum',
    symbol: 'FRAX',
    name: 'Frax',
    chain: Chain.ETHEREUM,
    address: '0x853d955aCEf822Db058eb8505911ED77F175b99e',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'protocol:frax',
    peggedTo: 'USD',
  },
  // ============== RWA / Tokenized Treasury Tokens ==============
  {
    id: 'token:USDtb:ethereum',
    symbol: 'USDtb',
    name: 'Ethena USDtb (T-Bill Backed)',
    chain: Chain.ETHEREUM,
    address: '0xC139190F447e929f090Edeb554D95AbB8b18aC1c',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'issuer:ethena',
    peggedTo: 'USD',
  },
  {
    id: 'token:BUIDL:ethereum',
    symbol: 'BUIDL',
    name: 'BlackRock USD Institutional Digital Liquidity',
    chain: Chain.ETHEREUM,
    address: '0x7712c34205737192402172409a8F7ccef8aA2AEc',
    decimals: 6,
    type: 'stablecoin',
    issuer: 'issuer:blackrock',
    peggedTo: 'USD',
  },
  {
    id: 'token:USDY:ethereum',
    symbol: 'USDY',
    name: 'Ondo US Dollar Yield',
    chain: Chain.ETHEREUM,
    address: '0x96F6eF951840721AdBF46Ac996b59E0235CB985C',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'issuer:ondo',
    peggedTo: 'USD',
  },
  {
    id: 'token:USDM:ethereum',
    symbol: 'USDM',
    name: 'Mountain Protocol USDM',
    chain: Chain.ETHEREUM,
    address: '0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'issuer:mountain',
    peggedTo: 'USD',
  },
  {
    id: 'token:USYC:ethereum',
    symbol: 'USYC',
    name: 'Hashnote US Yield Coin',
    chain: Chain.ETHEREUM,
    address: '0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b',
    decimals: 6,
    type: 'stablecoin',
    issuer: 'issuer:hashnote',
    peggedTo: 'USD',
  },
  {
    id: 'token:PYUSD:ethereum',
    symbol: 'PYUSD',
    name: 'PayPal USD',
    chain: Chain.ETHEREUM,
    address: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
    decimals: 6,
    type: 'stablecoin',
    issuer: 'issuer:paypal',
    peggedTo: 'USD',
  },
  {
    id: 'token:BENJI:ethereum',
    symbol: 'BENJI',
    name: 'Franklin Templeton BENJI',
    chain: Chain.ETHEREUM,
    address: '0x5B7fb5e7F1E57ac6E75fC4F5eB5C6B48C6DFd4F4', // Franklin OnChain US Gov Money Fund
    decimals: 6,
    type: 'stablecoin',
    issuer: 'issuer:franklin',
    peggedTo: 'USD',
  },
  {
    id: 'token:sUSDe:ethereum',
    symbol: 'sUSDe',
    name: 'Ethena Staked USDe',
    chain: Chain.ETHEREUM,
    address: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'issuer:ethena',
    peggedTo: 'USD',
  },
  {
    id: 'token:eETH:ethereum',
    symbol: 'eETH',
    name: 'EtherFi Staked ETH',
    chain: Chain.ETHEREUM,
    address: '0x35fA164735182de50811E8e2E824cFb9B6118ac2',
    decimals: 18,
    type: 'lst',
    issuer: 'protocol:etherfi',
  },
  {
    id: 'token:cUSDO:ethereum',
    symbol: 'cUSDO',
    name: 'Compounding Open Dollar',
    chain: Chain.ETHEREUM,
    address: '0xad55aebc9b8c03fc43cd9f62260391c13c23e7c0',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'issuer:openeden',
    peggedTo: 'USD',
  },
  {
    id: 'token:syrupUSDT:ethereum',
    symbol: 'syrupUSDT',
    name: 'Maple syrupUSDT',
    chain: Chain.ETHEREUM,
    address: '0x8AA7e01706b8a9DC1DE41b5b13F56166C1C31F51', // Maple syrupUSDT vault
    decimals: 6,
    type: 'stablecoin',
    issuer: 'protocol:maple',
    peggedTo: 'USD',
  },
  // ============== Additional Stablecoins from Verified Holdings ==============
  {
    id: 'token:USD+:ethereum',
    symbol: 'USD+',
    name: 'Dinari USD+',
    chain: Chain.ETHEREUM,
    address: '0x0000000000000000000000000000000000000000', // Placeholder - needs verification
    decimals: 18,
    type: 'stablecoin',
    issuer: 'protocol:dinari',
    peggedTo: 'USD',
  },
  {
    id: 'token:USD1:ethereum',
    symbol: 'USD1',
    name: 'USD1 Stablecoin',
    chain: Chain.ETHEREUM,
    address: '0x0000000000000000000000000000000000000000', // Placeholder - needs verification
    decimals: 18,
    type: 'stablecoin',
    peggedTo: 'USD',
  },
  {
    id: 'token:USDG:ethereum',
    symbol: 'USDG',
    name: 'USDG Stablecoin',
    chain: Chain.ETHEREUM,
    address: '0x0000000000000000000000000000000000000000', // Placeholder - needs verification
    decimals: 18,
    type: 'stablecoin',
    peggedTo: 'USD',
  },
  {
    id: 'token:USDT0:ethereum',
    symbol: 'USDT0',
    name: 'USDT0 (LayerZero)',
    chain: Chain.ETHEREUM,
    address: '0x0000000000000000000000000000000000000000', // Placeholder - needs verification
    decimals: 6,
    type: 'stablecoin',
    issuer: 'issuer:tether',
    peggedTo: 'USD',
  },
  {
    id: 'token:LBTC:ethereum',
    symbol: 'LBTC',
    name: 'Lombard Staked BTC',
    chain: Chain.ETHEREUM,
    address: '0x8236a87084f8B84306f72007F36F2618A5634494',
    decimals: 8,
    type: 'lst',
    peggedTo: 'BTC',
  },
  {
    id: 'token:RLP:ethereum',
    symbol: 'RLP',
    name: 'Resolv Risk Layer',
    chain: Chain.ETHEREUM,
    address: '0x4956b52aE2fF65D74CA2d61207523288e4528f96',
    decimals: 18,
    type: 'other',
    issuer: 'protocol:resolv',
  },
  {
    id: 'token:iUSD:ethereum',
    symbol: 'iUSD',
    name: 'infiniFi iUSD',
    chain: Chain.ETHEREUM,
    address: '0x48f9e38f3070AD8945DFEae3FA70987722E3D89c',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'protocol:infinifi',
    peggedTo: 'USD',
  },
  {
    id: 'token:siUSD:ethereum',
    symbol: 'siUSD',
    name: 'infiniFi Staked iUSD',
    chain: Chain.ETHEREUM,
    address: '0xDBDC1Ef57537E34680B898E1FEBD3D68c7389bCB',
    decimals: 18,
    type: 'stablecoin',
    issuer: 'protocol:infinifi',
    peggedTo: 'USD',
  },
  {
    id: 'token:wsrUSD:ethereum',
    symbol: 'wsrUSD',
    name: 'Reservoir Wrapped srUSD',
    chain: Chain.ETHEREUM,
    address: '0x0000000000000000000000000000000000000000', // Placeholder - needs verification
    decimals: 18,
    type: 'stablecoin',
    issuer: 'protocol:reservoir',
    peggedTo: 'USD',
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
    tokens: ['token:DAI:ethereum', 'token:USDS:ethereum'],
  },
  {
    id: 'issuer:ripple',
    name: 'Ripple',
    type: 'centralized',
    tokens: ['token:RLUSD:ethereum'],
  },
  // ============== RWA / Tokenized Treasury Issuers ==============
  {
    id: 'issuer:blackrock',
    name: 'BlackRock',
    type: 'centralized',
    tokens: ['token:BUIDL:ethereum'],
  },
  {
    id: 'issuer:ondo',
    name: 'Ondo Finance',
    type: 'centralized',
    tokens: ['token:USDY:ethereum'],
  },
  {
    id: 'issuer:mountain',
    name: 'Mountain Protocol',
    type: 'centralized',
    tokens: ['token:USDM:ethereum'],
  },
  {
    id: 'issuer:hashnote',
    name: 'Hashnote',
    type: 'centralized',
    tokens: ['token:USYC:ethereum'],
  },
  {
    id: 'issuer:ethena',
    name: 'Ethena Labs',
    type: 'decentralized',
    tokens: ['token:USDe:ethereum', 'token:sUSDe:ethereum', 'token:USDtb:ethereum'],
  },
  {
    id: 'issuer:paypal',
    name: 'PayPal / Paxos',
    type: 'centralized',
    tokens: ['token:PYUSD:ethereum'],
  },
  {
    id: 'issuer:franklin',
    name: 'Franklin Templeton',
    type: 'centralized',
    tokens: ['token:BENJI:ethereum'],
  },
  {
    id: 'issuer:openeden',
    name: 'OpenEden Digital',
    type: 'centralized', // BMA licensed digital asset issuer
    tokens: ['token:cUSDO:ethereum'],
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
