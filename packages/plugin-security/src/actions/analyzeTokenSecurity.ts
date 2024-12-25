import { Connection, PublicKey } from '@solana/web3.js';
import { TokenInfoService } from '../services/token-info.service';
import { CreatorInfoService } from '../services/creator-info.service';
import { PriceLiquidityService } from '../services/price-liquidity.service';
import { LLMAnalysisService } from '../services/llm-analysis.service';
import { DataCleaningService } from '../services/data-cleaning.service';
import { DeepseekAPI } from '../utils/deepseek';
import { Action, IAgentRuntime, Memory, State, ActionExample, Content, UUID } from '@ai16z/eliza';
import { token } from '@metaplex-foundation/js';
import { Runtime } from 'inspector/promises';

interface RiskPattern {
    pattern: string;
    riskLevel: string;
    description: string;
}

export interface TokenSecurityContent extends Content {
    tokenAddress: string;
}

export interface TokenSecurityResponse {
    riskLevel: string;
    riskScore: number;
    riskFactors: string[];
    recommendation: string;
    tokenAnalysis: {
        basicInfo: {
            name: string;
            symbol: string;
            supply: string;
            decimals: number;
            isPumpFun: boolean;
            taxInfo?: {
                totalTax: number;
                marketingTax: number;
                liquidityTax: number;
            }
        };
        priceInfo: {
            price: number;
            marketCap: number;
        };
        holdingInfo: {
            totalHolders: number;
            dexPercentage: number;
            top5HoldersPercentage: number;
        };
    };
    creatorAnalysis: {
        trustLevel: string;
        successRate: number;
        riskPatterns: string[];
        trackRecord: string;
        moonProjectsAssessment?: string;
    };
    matchedPatterns?: Array<{
        pattern: string;
        severity: string;
        description: string;
    }>;
}

export function isTokenSecurityContent(
    content: any
): content is TokenSecurityContent {
    // 1. 检查是否有直接的tokenAddress
    if (content?.tokenAddress && typeof content.tokenAddress === 'string') {
        return true;
    }

    // 2. 检查text字段中是否包含地址
    if (content?.text && typeof content.text === 'string') {
        const addressMatch = content.text.match(/[A-Za-z0-9]{32,44}/);
        if (addressMatch) {
            // 动态添加tokenAddress字段
            content.tokenAddress = addressMatch[0];
            return true;
        }
    }

    return false;
}

async function isPumpToken(tokenAddress: string): Promise<boolean> {
    try {
        const response = await fetch(`https://pump.fun/coin/${tokenAddress}`);
        return response.status === 200;
    } catch (error) {
        console.error('Error checking pump token:', error);
        return false;
    }
}

const analyzeTokenSecurity: Action = {
    name: 'ANALYZE_TOKEN_SECURITY',
    similes: ['ANALYZE_TOKEN', 'CHECK_TOKEN_SECURITY', 'TOKEN_SECURITY_CHECK'],
    description: '对指定的代币地址进行全面的安全性分析，包括代币基本信息、价格和流动性、持仓分布、创建者历史多个维度',

    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        try {
            // 1. 基本消息格式验证
            if (!message?.content) {
                console.log('Invalid message format');
                return false;
            }

            // 2. 提取token地址
            const content = message.content;
            if (!isTokenSecurityContent(content)) {
                console.log('No valid token address found');
                return false;
            }

            // 3. 验证是否是pump代币
            const tokenAddress = content.tokenAddress;
            const isPump = await isPumpToken(tokenAddress);
            if (!isPump) {
                await runtime.messageManager.createMemory({
                    userId: message.userId,
                    roomId: message.roomId,
                    agentId: runtime.agentId,
                    content: {
                        text: "Sry i only can analyze pumpfun token on solana",
                        metadata: {
                            error: "NOT_PUMP_TOKEN",
                            tokenAddress: content.tokenAddress
                        }
                    }
                });
                console.log("抱歉，目前我只能分析Solana上的Pump代币。")
                return false;
            }

            // 4. 验证环境变量
            const hasRpcUrl = !!process.env.SOLANA_RPC_URL;
            const hasDeepseekKey = !!process.env.DEEPSEEK_API_KEY;

            if (!hasRpcUrl || !hasDeepseekKey) {
                await runtime.messageManager.createMemory({
                    userId: message.userId,
                    roomId: message.roomId,
                    agentId: runtime.agentId,
                    content: {
                        text: "系统配置不完整，请确保设置了必要的环境变量。",
                        metadata: {
                            error: "MISSING_ENV_VARS",
                            details: {
                                hasRpcUrl,
                                hasDeepseekKey
                            }
                        }
                    }
                });
                console.log("系统配置不完整，请确保设置了必要的环境变量。")
                return false;
            }
            console.log("环境检测通过")
            return true;
        } catch (error) {
            console.error('Validation error:', error);
            return false;
        }
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<void> => {
        console.log('\n========== 开始代币安全分析 ==========');

        const content = message.content as TokenSecurityContent;
        const tokenAddress = content.tokenAddress;
        console.log("要分析的代币地址是",tokenAddress);
        // 1. 初始化所需服务
        const rpcUrl = process.env.SOLANA_RPC_URL;
        if (!rpcUrl) {
            throw new Error('需要设置 SOLANA_RPC_URL 环境变量');
        }
        const connection = new Connection(rpcUrl);
        console.log('已创建 Solana 连接');

        const tokenInfoService = new TokenInfoService(connection);
        const priceLiquidityService = new PriceLiquidityService(connection);
        const creatorInfoService = new CreatorInfoService(connection, priceLiquidityService);
        const dataCleaningService = new DataCleaningService();

        const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
        if (!deepseekApiKey) {
            throw new Error('需要设置 DEEPSEEK_API_KEY 环境变量');
        }
        const deepseekApi = new DeepseekAPI(deepseekApiKey);
        const llmAnalysisService = new LLMAnalysisService(deepseekApi);

        try {
            // 2. 获取代币基础信息
            const tokenMint = new PublicKey(tokenAddress);
            const tokenInfo = await tokenInfoService.getTokenInfo(tokenMint);

            // 3. 获取价格和市值信息
            const priceInfo = await priceLiquidityService.getDetailedPriceInfo(tokenAddress);

            // 4. 获取持仓分布信息
            const holdingInfo = await priceLiquidityService.getHoldingInfo(tokenMint);

            // 5. 获取创建者信息
            const creatorInfo = await creatorInfoService.getCreatorInfo(tokenMint);

            // 6. 数据清洗
            const cleanedHoldingData = dataCleaningService.cleanHoldingData(holdingInfo);
            const cleanedCreatorData = await dataCleaningService.cleanCreatorData(creatorInfo, tokenAddress, {
                price: priceInfo?.price,
                marketCap: priceInfo?.marketCap
            });

            // 7. LLM 风险分析
            const analysisResult = await llmAnalysisService.analyzeTokenRisk({
                tokenAddress: tokenAddress,
                creatorInfo: {
                    ...creatorInfo,
                    qualityMetrics: {
                        failedProjects: cleanedCreatorData.projectsByQuality.micro,
                        lowQualityProjects: cleanedCreatorData.projectsByQuality.small,
                        mediumQualityProjects: cleanedCreatorData.projectsByQuality.medium,
                        highQualityProjects: cleanedCreatorData.projectsByQuality.large,
                        moonProjects: cleanedCreatorData.moonProjects.length,
                        moonRate: cleanedCreatorData.moonRate,
                        successRate: cleanedCreatorData.successRate
                    },
                    moonProjects: cleanedCreatorData.moonProjects
                },
                creatorHistory: creatorInfo.otherTokens,
                priceInfo: {
                    price: priceInfo?.price || 0,
                    marketCap: priceInfo?.marketCap || null,
                    marketCapTier: cleanedCreatorData.marketCapTier,
                    maturityStage: cleanedCreatorData.maturityStage
                },
                tokenInfo: {
                    ageInHours: cleanedCreatorData.ageInHours,
                    maturityStage: cleanedCreatorData.maturityStage
                },
                holdingDistribution: {
                    totalHolders: cleanedHoldingData.totalHolders,
                    nonDexHolders: cleanedHoldingData.nonDexHolders,
                    top5Percentage: cleanedHoldingData.nonDexDistribution.top5Percentage,
                    topHoldings: cleanedHoldingData.nonDexDistribution.details.map(d => ({
                        address: d.address,
                        percentage: d.percentage,
                        isDex: false,
                        amount: 0,
                        totalHolders: cleanedHoldingData.totalHolders
                    }))
                }
            });

            // 8. 构建 Twitter 线程
            const threadContent = {
                intro: `🔍 Security Analysis for ${tokenInfo.name} ($${tokenInfo.symbol})\n\nRequested by @${message.userId}\n#TokenSecurity #Solana`,
                basicInfo: `📊 Basic Information:\n- Name: ${tokenInfo.name}\n- Symbol: ${tokenInfo.symbol}\n- Supply: ${tokenInfo.contract.supply}\n- Holders: ${cleanedHoldingData.totalHolders}`,
                creatorHistory: `👨‍💻 Creator History:\n${creatorInfo.otherTokens.map((token, index) =>
                    `${index + 1}. ${token.name} ($${token.name})\n` +
                    `   address: ${token.address}\n` +
                    `   marketcap: $${token.marketCap?.toLocaleString() ?? 'Cant calc the market cap if the token not launch on raydium'}\n` +
                    `   create time: ${new Date(token.timestamp * 1000).toLocaleDateString()}`
                ).join('\n\n')}`,
                riskAnalysis: `⚠️ Risk Analysis:\n${analysisResult.riskFactors.join('\n')}`,
                recommendation: `💡 Recommendation:\n${analysisResult.recommendation}`,
                conclusion: `🏁 Conclusion:\nRisk Level: ${analysisResult.riskLevel}\nSecurity Score: ${analysisResult.riskLevel === 'HIGH' ? 25 : analysisResult.riskLevel === 'MEDIUM' ? 50 : 75}/100\n\n#Web3Security #PumpToken`
            };
            // 9. 发送分析结果
            await runtime.messageManager.createMemory({
                id: `${message.roomId}afteraction`,
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: `🔍 I've analyzed this token. Here's my detailed analysis:\n\n${Object.values(threadContent).join('\n\n')}`,
                    action: "ANALYZE_TOKEN_SECURITY",
                    metadata: {
                        threadContent: {
                            tweets: [
                                threadContent.intro,
                                threadContent.basicInfo,
                                threadContent.creatorHistory,
                                threadContent.riskAnalysis,
                                threadContent.recommendation,
                                threadContent.conclusion
                            ]
                        },
                        inReplyTo: message.userId,
                        analysisResult,
                        shouldThread:true
                    }
                }
            });

            console.log('\n========== 代币安全分析完成 ==========');
        } catch (error) {
            console.error('代币分析过程中发生错误:', error);
            // 发送错误消息
            await runtime.messageManager.createMemory({
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: "I encountered an issue while analyzing this token. Please try again later. 🔧",
                    metadata: { error: error.message }
                }
            });
            throw error;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "请分析这个代币的安全性：7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
                    tokenAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                }
            },
            {
                user: "CryptoSecurityExpert",
                content: {
                    text: "正在分析代币安全性...",
                    action: "ANALYZE_TOKEN_SECURITY",
                    tokenAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "这个代币安全吗：7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
                    tokenAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                }
            },
            {
                user: "CryptoSecurityExpert",
                content: {
                    text: "正在进行安全分析...",
                    action: "ANALYZE_TOKEN_SECURITY",
                    tokenAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                }
            }
        ]
    ] as ActionExample[][]
} as Action;

export default analyzeTokenSecurity;