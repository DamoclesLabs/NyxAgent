export interface TokenCreator {
    address: string;
    creationTime?: number;
    otherTokens: Array<{
        address: string;
        name: string;
        price?: number;
        marketCap?: number;
        timestamp?: number;
    }>;
    currentToken?: {
        creationTime: number;
        raydiumPool: any | null;
    };
}

export interface HolderData {
    address: string;
    balance: string;
}

export interface TokenHolding {
    /** 代币所有者的钱包地址（不是代币账户地址） */
    address: string;
    /** 持有的代币数量 */
    amount: number;
    /** 占总供应量的百分比 */
    percentage: number;
    /** 是否是 DEX 地址 */
    isDex: boolean;
    /** 总持有人数 */
    totalHolders: number;
}

export interface TokenHoldingInfo {
    holdings: TokenHolding[];
    top5NonDexPercentage: number;
}

export const SOLANA_DEX_ADDRESSES = {
    // DEX
    RAYDIUM: {
        POOL_ADDRESS: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1' as string,
        NAME: 'Raydium Pool'
    },
    ORCA: {
        POOL_ADDRESS: '3xgEGKwqqAVF3A3b2Xc95xJsGG8G5sCLxgAkLqoHzqXg' as string,
        NAME: 'Orca Pool'
    },
    JUPITER: {
        POOL_ADDRESS: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB' as string,
        NAME: 'Jupiter Pool'
    },
    METEORA: {
        POOL_ADDRESS: 'MEisE1HzehtrDpAAT8PnLHjpSSkRYakotTuJRPjTpo8' as string,
        NAME: 'Meteora Pool'
    },
    // CEX
    BITGET: {
        POOL_ADDRESS: 'A77HErqtfN1hLLpvZ9pCtu66FEtM8BveoaKbbMoZ4RiR' as string,
        NAME: 'Bitget Pool'
    },
    GATEIO: {
        POOL_ADDRESS: 'u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w' as string,
        NAME: 'Gate.io Pool'
    },
    BINANCE: {
        POOL_ADDRESS: '5tzFkiKscXHK5ZXCGbXZxZY3qhK9NwEHyQZtZdF4jYQN' as string,
        NAME: 'Binance Hot Wallet'
    },
    OKEX: {
        POOL_ADDRESS: '5VqYBPm3bu9Vw5r4YEVvFZFiGGJvpGGqTHgMbphpz3SE' as string,
        NAME: 'OKX Hot Wallet'
    },
    BYBIT: {
        POOL_ADDRESS: 'BxhrajyEevdKyZcP1eiBPcbvxpEkfRt7TaQKSf1UXi6d' as string,
        NAME: 'Bybit Hot Wallet'
    },
    KUCOIN: {
        POOL_ADDRESS: '2vxcmWoLy46yEMuJhcPt2nCPUvwrW8SWkFdNzuCRJfdr' as string,
        NAME: 'KuCoin Hot Wallet'
    },
    MEXC: {
        POOL_ADDRESS: '9BVcYqEQxyccuwznvxXqDkSJFavvTyheiTYk231T1A8S' as string,
        NAME: 'MEXC Hot Wallet'
    }
} as const;

export const ALL_DEX_ADDRESSES: string[] = [
    // DEX
    SOLANA_DEX_ADDRESSES.RAYDIUM.POOL_ADDRESS,
    SOLANA_DEX_ADDRESSES.ORCA.POOL_ADDRESS,
    SOLANA_DEX_ADDRESSES.JUPITER.POOL_ADDRESS,
    SOLANA_DEX_ADDRESSES.METEORA.POOL_ADDRESS,
    // CEX
    SOLANA_DEX_ADDRESSES.BITGET.POOL_ADDRESS,
    SOLANA_DEX_ADDRESSES.GATEIO.POOL_ADDRESS,
    SOLANA_DEX_ADDRESSES.BINANCE.POOL_ADDRESS,
    SOLANA_DEX_ADDRESSES.OKEX.POOL_ADDRESS,
    SOLANA_DEX_ADDRESSES.BYBIT.POOL_ADDRESS,
    SOLANA_DEX_ADDRESSES.KUCOIN.POOL_ADDRESS,
    SOLANA_DEX_ADDRESSES.MEXC.POOL_ADDRESS
];

export interface PriceMetrics {
    usdPrice: number;
    solPrice: number;
    solUsdPrice: number;
    marketCapInSol: number;
    volume24hInSol: number;
    liquidityInSol: number;
}

export interface MarketTierAnalysis {
    tier: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE';
    solMetrics: PriceMetrics;
    healthMetrics: {
        holderMetrics: {
            count: number;
            distribution: number;
            isHealthy: boolean;
        };
        liquidityMetrics: {
            ratio: number;
            depth: number;
            isHealthy: boolean;
        };
        volumeMetrics: {
            daily: number;
            volatility: number;
            isHealthy: boolean;
        };
    };
    timeAdjustment: {
        phase: 'LAUNCH' | 'STABILITY' | 'MATURITY';
        adjustedThresholds: {
            expectedGrowth: number;
            volatilityTolerance: number;
        };
    };
    recommendations: {
        riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
        suggestions: string[];
        warningFlags: string[];
    };
}

// 市值分层的定义
export const MARKET_CAP_TIERS = {
    MICRO: 100,      // < 100 SOL ($20,000)
    SMALL: 500,      // 100-500 SOL ($20,000-$100,000)
    MEDIUM: 2500,    // 500-2500 SOL ($100,000-$500,000)
    LARGE: 10000     // > 10000 SOL (>$2,000,000)
} as const;