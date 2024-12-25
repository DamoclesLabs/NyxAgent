// 基础类型定义
export type ProjectQuality = 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE';

// 代币创建者相关
export interface TokenCreator {
    address: string;
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

// 持仓相关
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

export interface CleanedHoldingData {
    totalHolders: number;
    nonDexHolders: number;
    dexHoldingPercentage: number;
    nonDexDistribution: {
        top5Percentage: number;
        top10Percentage: number;
        details: Array<{
            address: string;
            percentage: number;
            rank: number;
        }>;
    };
}

// 价格和市值相关
export interface PriceMetrics {
    usdPrice: number;
    solPrice: number;
    solUsdPrice: number;
    marketCapInSol: number;
    volume24hInSol: number;
    liquidityInSol: number;
}

// 市值分析相关
export interface MarketTierAnalysis {
    tier: ProjectQuality;
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
    tokenStage: 'LAUNCH' | 'STABILITY' | 'MATURITY';
    recommendations: {
        riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
        suggestions: string[];
        warningFlags: string[];
    };
}

// 清洗后的创建者数据
export interface CleanedCreatorData {
    address: string;
    totalProjects: number;
    projectsByQuality: {
        micro: number;      // 微市值项目数量
        small: number;      // 小市值项目数量
        medium: number;     // 中市值项目数量
        large: number;      // 大市值项目数量
    };
    qualityDistribution: {
        micro: number;      // 微市值项目占比
        small: number;      // 小市值项目占比
        medium: number;     // 中市值项目占比
        large: number;      // 大市值项目占比
    };
    moonProjects: Array<{    // 专门记录起飞项目
        name: string;
        marketCapSol: number;
        marketCapUsd: number;
        timestamp: number;
        roi?: number;        // 如果有历史数据，记录投资回报率
    }>;
    recentProjects: Array<{
        name: string;
        marketCapSol: number;
        marketCapUsd: number;
        quality: ProjectQuality;
        timestamp: number;
    }>;
    avgMarketCap: number;
    successRate: number;     // 非失败项目的比例
    moonRate: number;        // 起飞项目占比
    marketCapTier: ProjectQuality;  // 当前市值分层
    maturityStage: 'LAUNCH' | 'STABILITY' | 'MATURITY';     // 成熟度阶段
    ageInHours: number;      // 代���年龄
}

// 常量定义
export const MARKET_CAP_TIERS = {
    MICRO: 100,      // < 100 SOL ($20,000)
    SMALL: 500,      // 100-500 SOL ($20,000-$100,000)
    MEDIUM: 2500,    // 500-2500 SOL ($100,000-$500,000)
    LARGE: 10000     // > 10000 SOL (>$2,000,000)
} as const;

export const HEALTH_THRESHOLDS = {
    HOLDER_CONCENTRATION: {
        HEALTHY: { max: 0.2 },
        WARNING: { max: 0.4 }
    },
    LIQUIDITY_RATIO: {
        HEALTHY: { min: 5, max: 15 },
        WARNING: { min: 3, max: 20 }
    },
    VOLUME_RATIO: {
        HEALTHY: { min: 0.1, max: 0.5 },
        WARNING: { min: 0.05, max: 1.0 }
    }
} as const;