import { Connection, PublicKey } from "@solana/web3.js";
import { PumpFunSDK } from "pumpdotfun-sdk";
import {
    Action,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
} from "@ai16z/eliza";
import { CONFIG, CREDIBILITY_THRESHOLDS, RiskLevel, SecurityPluginSettings } from '../types';

// 定义分析结果的接口
export interface TokenAnalysisResult {
    tokenAddress: string;
    tokenName?: string;
    tokenSymbol?: string;
    creatorAddress?: string;
    creationDate?: string;
    holderCount?: number;
    transactionCount: number;
    liquidityScore: number;
    creatorCredibility: number;
    overallScore: number;
    riskFactors: string[];
    recommendations: string[];
}

// 定义请求内容的接口
export interface AnalyzeTokenContent extends Content {
    tokenAddress: string;
}

// 验证请求内容
export function isAnalyzeTokenContent(
    content: any
): content is AnalyzeTokenContent {
    return (
        typeof content === "object" &&
        content !== null &&
        typeof content.tokenAddress === "string" &&
        content.tokenAddress.length > 0
    );
}

// 主要的分析函数
async function analyzeToken(
    tokenAddress: string,
    connection: Connection
): Promise<TokenAnalysisResult> {
    try {
        const mint = new PublicKey(tokenAddress);

        // 1. 获取基本信息
        const tokenInfo = await connection.getParsedAccountInfo(mint);
        const creator = (tokenInfo.value?.data as any)?.parsed?.info?.mintAuthority;

        // 2. 获取交易历史
        const signatures = await connection.getSignaturesForAddress(mint);

        // 3. 获取创建时间
        const creationTx = signatures[signatures.length - 1];
        const creationDate = new Date(creationTx?.blockTime ?? 0 * 1000).toISOString();

        // 4. 计算各项指标
        const liquidityScore = calculateLiquidityScore(signatures);
        const creatorCredibility = await analyzeCreatorCredibility(creator, connection);
        const overallScore = calculateOverallScore({
            liquidityScore,
            creatorCredibility,
            transactionCount: signatures.length
        });

        // 5. 识别风险因素
        const riskFactors = identifyRiskFactors({
            signatures,
            liquidityScore,
            creatorCredibility
        });

        // 6. 生成建议
        const recommendations = generateRecommendations(riskFactors);

        return {
            tokenAddress,
            creatorAddress: creator,
            creationDate,
            transactionCount: signatures.length,
            liquidityScore,
            creatorCredibility,
            overallScore,
            riskFactors,
            recommendations
        };
    } catch (error) {
        throw new Error(`Token analysis failed: ${error.message}`);
    }
}

// 计算流动性评分
function calculateLiquidityScore(signatures: any[]): number {
    if (signatures.length > 1000) return 100;
    if (signatures.length > 500) return 80;
    if (signatures.length > 100) return 60;
    if (signatures.length > CONFIG.MIN_TRANSACTIONS) return 40;
    return 20;
}

// 分析创建者可信度
async function analyzeCreatorCredibility(
    creatorAddress: string,
    connection: Connection
): Promise<number> {
    if (!creatorAddress) return 0;

    try {
        const creatorPubkey = new PublicKey(creatorAddress);
        const creatorTxs = await connection.getSignaturesForAddress(creatorPubkey);

        // 基于创建者的交易历史评估可信度
        if (creatorTxs.length > 1000) return 100;
        if (creatorTxs.length > 500) return 80;
        if (creatorTxs.length > 100) return 60;
        if (creatorTxs.length > 50) return 40;
        return 20;
    } catch {
        return 0;
    }
}

// 计算总体评分
function calculateOverallScore({
    liquidityScore,
    creatorCredibility,
    transactionCount
}: {
    liquidityScore: number;
    creatorCredibility: number;
    transactionCount: number;
}): number {
    // 权重分配
    const weights = {
        liquidity: 0.4,
        creator: 0.3,
        transactions: 0.3
    };

    const transactionScore = transactionCount > 100 ? 100 : (transactionCount / 100) * 100;

    return Math.round(
        liquidityScore * weights.liquidity +
        creatorCredibility * weights.creator +
        transactionScore * weights.transactions
    );
}

// 识别风险因素
function identifyRiskFactors({
    signatures,
    liquidityScore,
    creatorCredibility
}: {
    signatures: any[];
    liquidityScore: number;
    creatorCredibility: number;
}): string[] {
    const risks: string[] = [];

    if (signatures.length < 50) {
        risks.push("交易历史较少，可能存在流动性风险");
    }

    if (liquidityScore < 40) {
        risks.push("流动性评分较低，交易可能不够活跃");
    }

    if (creatorCredibility < 40) {
        risks.push("创建者可信度较低，建议进行更深入的调查");
    }

    if (signatures.length < 10) {
        risks.push("代币刚刚创建，缺乏足够的市场验证");
    }

    return risks;
}

// 生成建议
function generateRecommendations(risks: string[]): string[] {
    const recommendations: string[] = [];

    risks.forEach(risk => {
        switch (risk) {
            case "交易历史较少，可能存在流动性风险":
                recommendations.push("建议等待更多交易历史积累后再做决定");
                break;
            case "流动性评分较低，交易可能不够活跃":
                recommendations.push("建议观察市场活跃度变化趋势");
                break;
            case "创建者可信度较低，建议进行更深入的调查":
                recommendations.push("建议研究创建者的其他项目历史");
                break;
            case "代币刚刚创建，缺乏足够的市场验证":
                recommendations.push("建议等待市场充分验证后再参与");
                break;
        }
    });

    return recommendations;
}

// 导出Action配置
export const analyzePumpfunTokenAction: Action = {
    name: "ANALYZE_PUMPFUN_TOKEN",
    similes: [
        "ANALYZE_TOKEN",
        "CHECK_TOKEN_CREDIBILITY",
        "VERIFY_TOKEN",
        "TOKEN_ANALYSIS"
    ],
    description: "分析Pumpfun平台上发行的代币的可信度",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return isAnalyzeTokenContent(message.content);
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ) => {
        if (!isAnalyzeTokenContent(message.content)) {
            throw new Error("Invalid content for token analysis");
        }

        const tokenAddress = message.content.tokenAddress;
        const settings = runtime.character.settings as SecurityPluginSettings;
        const connection = new Connection(
            settings.solanaRpcUrl || CONFIG.DEFAULT_RPC_URL
        );

        try {
            const analysisResult = await analyzeToken(tokenAddress, connection);

            if (callback) {
                callback({
                    text: `代币分析完成\n\n` +
                          `总体可信度评分：${analysisResult.overallScore}/100\n\n` +
                          `风险因素：\n${analysisResult.riskFactors.join('\n')}\n\n` +
                          `建议：\n${analysisResult.recommendations.join('\n')}`,
                    metadata: analysisResult
                });
            }
        } catch (error) {
            console.error("Token analysis failed:", error);
            throw new Error(`代币分析失败: ${error.message}`);
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "分析这个代币的可信度 {{tokenAddress}}",
                    tokenAddress: "7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs"
                }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "我已完成对该代币的分析，总体可信度评分为75/100。主要风险因素包括：流动性相对较低。建议：关注代币的交易活跃度变化。",
                    action: "ANALYZE_PUMPFUN_TOKEN",
                    metadata: {
                        tokenAddress: "7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs",
                        overallScore: 75,
                        riskFactors: ["流动性相对较低"],
                        recommendations: ["关注代币的交易活跃度变化"]
                    }
                }
            }
        ]
    ]
};