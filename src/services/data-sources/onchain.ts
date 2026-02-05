// On-chain data service using viem for multi-chain support

import {
  createPublicClient,
  http,
  type PublicClient,
  type Address,
  parseAbi,
  formatUnits,
} from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';
import { Chain } from '@/types/core';

// ============== ABIS ==============

// Standard ERC-20 ABI
const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
]);

// ERC-4626 Vault ABI
const erc4626Abi = parseAbi([
  'function asset() view returns (address)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function convertToShares(uint256 assets) view returns (uint256)',
  'function maxDeposit(address receiver) view returns (uint256)',
  'function maxWithdraw(address owner) view returns (uint256)',
  'function previewDeposit(uint256 assets) view returns (uint256)',
  'function previewRedeem(uint256 shares) view returns (uint256)',
]);

// Yearn V3 Vault ABI extensions
const yearnV3Abi = parseAbi([
  'function strategies(address strategy) view returns (uint256 activation, uint256 lastReport, uint256 currentDebt, uint256 maxDebt)',
  'function get_default_queue() view returns (address[])',
  'function default_queue(uint256 index) view returns (address)',
  'function totalDebt() view returns (uint256)',
  'function totalIdle() view returns (uint256)',
  'function pricePerShare() view returns (uint256)',
  'function deposit_limit() view returns (uint256)',
  'function management() view returns (address)',
  'function governance() view returns (address)',
  'function accountant() view returns (address)',
]);

// Chainlink Price Feed ABI
const chainlinkAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
  'function description() view returns (string)',
  'function version() view returns (uint256)',
]);

// Aave V3 Pool ABI - simplified for basic queries
const aaveV3PoolAbi = parseAbi([
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
]);

// Gnosis Safe ABI
const gnosisSafeAbi = parseAbi([
  'function getThreshold() view returns (uint256)',
  'function getOwners() view returns (address[])',
  'function nonce() view returns (uint256)',
]);

// ============== TYPES ==============

export interface TokenData {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
}

export interface VaultOnChainData {
  address: Address;
  asset: Address;
  totalAssets: bigint;
  totalSupply: bigint;
  pricePerShare: bigint;
  maxDeposit?: bigint;
}

export interface StrategyAllocation {
  address: Address;
  currentDebt: bigint;
  maxDebt: bigint;
  allocation: number; // Percentage 0-100
  lastReport?: Date;
  isActive: boolean;
}

export interface OraclePriceData {
  pair: string;
  price: number;
  decimals: number;
  updatedAt: Date;
  roundId: bigint;
  isStale: boolean;
}

export interface MultisigData {
  address: Address;
  threshold: number;
  owners: Address[];
  nonce: bigint;
}

// ============== CHAIN CONFIG ==============

const chainConfigs = {
  [Chain.ETHEREUM]: {
    chain: mainnet,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
  },
  [Chain.ARBITRUM]: {
    chain: arbitrum,
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arbitrum.llamarpc.com',
  },
  [Chain.OPTIMISM]: {
    chain: optimism,
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://optimism.llamarpc.com',
  },
  [Chain.POLYGON]: {
    chain: polygon,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com',
  },
  [Chain.BASE]: {
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL || 'https://base.llamarpc.com',
  },
  [Chain.AVALANCHE]: {
    chain: avalanche,
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://avalanche.drpc.org',
  },
};

// ============== SERVICE ==============

export class OnChainDataService {
  private clients: Map<Chain, PublicClient>;

  constructor() {
    this.clients = new Map();
    this.initializeClients();
  }

  private initializeClients() {
    // Initialize each chain client separately to handle viem's strict chain typing
    this.clients.set(
      Chain.ETHEREUM,
      createPublicClient({
        chain: mainnet,
        transport: http(chainConfigs[Chain.ETHEREUM].rpcUrl),
        batch: { multicall: true },
      }) as unknown as PublicClient
    );

    this.clients.set(
      Chain.ARBITRUM,
      createPublicClient({
        chain: arbitrum,
        transport: http(chainConfigs[Chain.ARBITRUM].rpcUrl),
        batch: { multicall: true },
      }) as unknown as PublicClient
    );

    this.clients.set(
      Chain.OPTIMISM,
      createPublicClient({
        chain: optimism,
        transport: http(chainConfigs[Chain.OPTIMISM].rpcUrl),
        batch: { multicall: true },
      }) as unknown as PublicClient
    );

    this.clients.set(
      Chain.POLYGON,
      createPublicClient({
        chain: polygon,
        transport: http(chainConfigs[Chain.POLYGON].rpcUrl),
        batch: { multicall: true },
      }) as unknown as PublicClient
    );

    this.clients.set(
      Chain.BASE,
      createPublicClient({
        chain: base,
        transport: http(chainConfigs[Chain.BASE].rpcUrl),
        batch: { multicall: true },
      }) as unknown as PublicClient
    );

    this.clients.set(
      Chain.AVALANCHE,
      createPublicClient({
        chain: avalanche,
        transport: http(chainConfigs[Chain.AVALANCHE].rpcUrl),
        batch: { multicall: true },
      }) as unknown as PublicClient
    );
  }

  private getClient(chain: Chain): PublicClient {
    const client = this.clients.get(chain);
    if (!client) {
      throw new Error(`No client configured for chain: ${chain}`);
    }
    return client;
  }

  // ============== TOKEN DATA ==============

  async getTokenData(chain: Chain, address: Address): Promise<TokenData> {
    const client = this.getClient(chain);

    const [name, symbol, decimals, totalSupply] = await Promise.all([
      client.readContract({
        address,
        abi: erc20Abi,
        functionName: 'name',
      }),
      client.readContract({
        address,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
      client.readContract({
        address,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
      client.readContract({
        address,
        abi: erc20Abi,
        functionName: 'totalSupply',
      }),
    ]);

    return {
      address,
      name: name as string,
      symbol: symbol as string,
      decimals: decimals as number,
      totalSupply: totalSupply as bigint,
    };
  }

  async getTokenBalance(
    chain: Chain,
    tokenAddress: Address,
    ownerAddress: Address
  ): Promise<bigint> {
    const client = this.getClient(chain);

    const balance = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [ownerAddress],
    });

    return balance as bigint;
  }

  // ============== ERC-4626 VAULT DATA ==============

  async getERC4626VaultData(
    chain: Chain,
    vaultAddress: Address
  ): Promise<VaultOnChainData> {
    const client = this.getClient(chain);

    const [asset, totalAssets, totalSupply] = await Promise.all([
      client.readContract({
        address: vaultAddress,
        abi: erc4626Abi,
        functionName: 'asset',
      }),
      client.readContract({
        address: vaultAddress,
        abi: erc4626Abi,
        functionName: 'totalAssets',
      }),
      client.readContract({
        address: vaultAddress,
        abi: erc4626Abi,
        functionName: 'totalSupply',
      }),
    ]);

    const pricePerShare =
      (totalSupply as bigint) > 0n
        ? ((totalAssets as bigint) * BigInt(1e18)) / (totalSupply as bigint)
        : BigInt(1e18);

    // Try to get maxDeposit (may fail on some vaults)
    let maxDeposit: bigint | undefined;
    try {
      maxDeposit = (await client.readContract({
        address: vaultAddress,
        abi: erc4626Abi,
        functionName: 'maxDeposit',
        args: ['0x0000000000000000000000000000000000000000' as Address],
      })) as bigint;
    } catch {
      // maxDeposit not available
    }

    return {
      address: vaultAddress,
      asset: asset as Address,
      totalAssets: totalAssets as bigint,
      totalSupply: totalSupply as bigint,
      pricePerShare,
      maxDeposit,
    };
  }

  // ============== YEARN V3 VAULT DATA ==============

  async getYearnV3VaultStrategies(
    chain: Chain,
    vaultAddress: Address
  ): Promise<StrategyAllocation[]> {
    const client = this.getClient(chain);

    // Get the strategy queue
    let queue: Address[] = [];
    try {
      queue = (await client.readContract({
        address: vaultAddress,
        abi: yearnV3Abi,
        functionName: 'get_default_queue',
      })) as Address[];
    } catch {
      // Fallback: try to read individual indices
      for (let i = 0; i < 20; i++) {
        try {
          const strategy = (await client.readContract({
            address: vaultAddress,
            abi: yearnV3Abi,
            functionName: 'default_queue',
            args: [BigInt(i)],
          })) as Address;
          if (strategy === '0x0000000000000000000000000000000000000000') break;
          queue.push(strategy);
        } catch {
          break;
        }
      }
    }

    if (queue.length === 0) {
      return [];
    }

    // Get total debt for percentage calculation
    let totalDebt: bigint;
    try {
      totalDebt = (await client.readContract({
        address: vaultAddress,
        abi: yearnV3Abi,
        functionName: 'totalDebt',
      })) as bigint;
    } catch {
      // Fallback to totalAssets
      totalDebt = (await client.readContract({
        address: vaultAddress,
        abi: erc4626Abi,
        functionName: 'totalAssets',
      })) as bigint;
    }

    // Get each strategy's data
    const strategies: StrategyAllocation[] = await Promise.all(
      queue.map(async (strategyAddr) => {
        try {
          const strategyData = (await client.readContract({
            address: vaultAddress,
            abi: yearnV3Abi,
            functionName: 'strategies',
            args: [strategyAddr],
          })) as [bigint, bigint, bigint, bigint];

          const [activation, lastReport, currentDebt, maxDebt] = strategyData;

          return {
            address: strategyAddr,
            currentDebt,
            maxDebt,
            allocation:
              totalDebt > 0n
                ? Number((currentDebt * 10000n) / totalDebt) / 100
                : 0,
            lastReport: lastReport > 0n ? new Date(Number(lastReport) * 1000) : undefined,
            isActive: activation > 0n && currentDebt > 0n,
          };
        } catch {
          return {
            address: strategyAddr,
            currentDebt: 0n,
            maxDebt: 0n,
            allocation: 0,
            isActive: false,
          };
        }
      })
    );

    return strategies.filter((s) => s.isActive || s.maxDebt > 0n);
  }

  async getYearnV3VaultGovernance(
    chain: Chain,
    vaultAddress: Address
  ): Promise<{ management: Address; governance: Address }> {
    const client = this.getClient(chain);

    const [management, governance] = await Promise.all([
      client.readContract({
        address: vaultAddress,
        abi: yearnV3Abi,
        functionName: 'management',
      }),
      client.readContract({
        address: vaultAddress,
        abi: yearnV3Abi,
        functionName: 'governance',
      }),
    ]);

    return {
      management: management as Address,
      governance: governance as Address,
    };
  }

  // ============== ORACLE DATA ==============

  async getChainlinkPrice(
    chain: Chain,
    feedAddress: Address,
    staleThresholdSeconds: number = 3600
  ): Promise<OraclePriceData> {
    const client = this.getClient(chain);

    const [roundData, decimals, description] = await Promise.all([
      client.readContract({
        address: feedAddress,
        abi: chainlinkAbi,
        functionName: 'latestRoundData',
      }),
      client.readContract({
        address: feedAddress,
        abi: chainlinkAbi,
        functionName: 'decimals',
      }),
      client.readContract({
        address: feedAddress,
        abi: chainlinkAbi,
        functionName: 'description',
      }),
    ]);

    const [roundId, answer, , updatedAt] = roundData as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint
    ];

    const updatedAtDate = new Date(Number(updatedAt) * 1000);
    const isStale =
      Date.now() / 1000 - Number(updatedAt) > staleThresholdSeconds;

    return {
      pair: description as string,
      price: Number(answer) / Math.pow(10, decimals as number),
      decimals: decimals as number,
      updatedAt: updatedAtDate,
      roundId,
      isStale,
    };
  }

  // ============== MULTISIG DATA ==============

  async getGnosisSafeData(
    chain: Chain,
    safeAddress: Address
  ): Promise<MultisigData> {
    const client = this.getClient(chain);

    const [threshold, owners, nonce] = await Promise.all([
      client.readContract({
        address: safeAddress,
        abi: gnosisSafeAbi,
        functionName: 'getThreshold',
      }),
      client.readContract({
        address: safeAddress,
        abi: gnosisSafeAbi,
        functionName: 'getOwners',
      }),
      client.readContract({
        address: safeAddress,
        abi: gnosisSafeAbi,
        functionName: 'nonce',
      }),
    ]);

    return {
      address: safeAddress,
      threshold: Number(threshold),
      owners: owners as Address[],
      nonce: nonce as bigint,
    };
  }

  // ============== UTILITY ==============

  async isContract(chain: Chain, address: Address): Promise<boolean> {
    const client = this.getClient(chain);
    const code = await client.getCode({ address });
    return code !== undefined && code !== '0x';
  }

  async getBlockTimestamp(chain: Chain): Promise<Date> {
    const client = this.getClient(chain);
    const block = await client.getBlock();
    return new Date(Number(block.timestamp) * 1000);
  }

  formatTokenAmount(amount: bigint, decimals: number): string {
    return formatUnits(amount, decimals);
  }
}

// Export singleton instance
export const onChainService = new OnChainDataService();
