import { Connection, PublicKey } from '@solana/web3.js';
import { TokenInfoService } from '../../src/services/token-info.service';
import { CreatorInfoService } from '../../src/services/creator-info.service';
import { PriceLiquidityService } from '../../src/services/price-liquidity.service';
import { LLMAnalysisService } from '../../src/services/llm-analysis.service';
import { DataCleaningService } from '../../src/services/data-cleaning.service';
import { DeepseekAPI } from '../../src/utils/deepseek';
import { AnalysisResult } from '../../src/services/llm-analysis.service';
import { TokenHolding } from '../../src/types/types';
import { timeStamp } from 'console';

jest.setTimeout(30000000);

describe('代币分析集成测试', () => {
    let connection: Connection;
    let tokenInfoService: TokenInfoService;
    let creatorInfoService: CreatorInfoService;
    let priceLiquidityService: PriceLiquidityService;
    let llmAnalysisService: LLMAnalysisService;
    let dataCleaningService: DataCleaningService;

    beforeAll(() => {
        console.log('\n========== 初始化测试环境 ==========');

        // 初始化 Solana 连接
        const rpcUrl = process.env.SOLANA_RPC_URL;
        if (!rpcUrl) {
            throw new Error('需要设置 SOLANA_RPC_URL 环境变量');
        }
        connection = new Connection(rpcUrl);
        console.log('已创建 Solana 连接');

        // 初始化各个服务
        tokenInfoService = new TokenInfoService(connection);
        priceLiquidityService = new PriceLiquidityService(connection);
        creatorInfoService = new CreatorInfoService(connection, priceLiquidityService);
        dataCleaningService = new DataCleaningService();

        // 初始化 LLM 服务
        const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
        if (!deepseekApiKey) {
            throw new Error('需要设置 DEEPSEEK_API_KEY 环境变量');
        }
        const deepseekApi = new DeepseekAPI(deepseekApiKey);
        llmAnalysisService = new LLMAnalysisService(deepseekApi);

        console.log('所有服务初始化完成');
        console.log('========== 初始化完成 ==========\n');
    });

    describe('完整代币分析流程', () => {
        // 使用测试代币
        const TEST_TOKEN_MINT = new PublicKey('DpeqGVGT4SuKsmf3dFN6XKrrJk8jaUZBdhPsqA6rpuma');

        it('应该完成完整的代币分析流程', async () => {
            console.log('\n========== 开始代币分析流程 ==========');

            // 1. 获取代币基础信息
            console.log('\n1. 获取代币基础信息...');
            const tokenInfo = await tokenInfoService.getTokenInfo(TEST_TOKEN_MINT);
            console.log('代币基础信息:', {
                symbol: tokenInfo.symbol,
                name: tokenInfo.name,
                contract: tokenInfo.contract
            });

            // 2. 获取价格和市值信息
            console.log('\n2. 获取价格和市值信息...');
            const priceInfo = await priceLiquidityService.getDetailedPriceInfo(TEST_TOKEN_MINT.toString());
            console.log('价格和市值信息:', {
                price: priceInfo?.price,
                marketCap: priceInfo?.marketCap
            });

            // 3. 获取持仓分布信息
            console.log('\n3. ��取持仓分布信息...');
            const holdingInfo = await priceLiquidityService.getHoldingInfo(TEST_TOKEN_MINT);
            console.log('持仓数据获取完成');

            // 4. 获取创建者信息
            console.log('\n4. 获取创建者信息...');
            const creatorInfo = await creatorInfoService.getCreatorInfo(TEST_TOKEN_MINT);
            console.log('创建者信息:', {
                address: creatorInfo.address,
                otherTokensCount: creatorInfo.otherTokens.length,
                timeStamp: (Date.now() - (creatorInfo.currentToken?.creationTime || Date.now())) / (1000 * 60 * 60),
            });

            // 5. 数据清洗
            console.log('\n5. 执行数据清洗...');
            const cleanedHoldingData = dataCleaningService.cleanHoldingData(holdingInfo);
            const cleanedCreatorData = await dataCleaningService.cleanCreatorData(creatorInfo, {
                price: priceInfo?.price,
                marketCap: priceInfo?.marketCap
            });
            console.log('数据清洗完成');

            // 6. LLM 风险分析
            console.log('\n6. 进行 LLM 风险分析...');
            const analysisResult = await llmAnalysisService.analyzeTokenRisk({
                tokenAddress: TEST_TOKEN_MINT.toString(),
                creatorInfo: {
                    ...creatorInfo,
                    qualityMetrics: {
                        failedProjects: cleanedCreatorData.projectsByQuality.micro,
                        lowQualityProjects: cleanedCreatorData.projectsByQuality.small,
                        mediumQualityProjects: cleanedCreatorData.projectsByQuality.medium,
                        highQualityProjects: cleanedCreatorData.projectsByQuality.large,
                        moonProjects: cleanedCreatorData.projectsByQuality.large,
                        moonRate: cleanedCreatorData.moonRate,
                        successRate: cleanedCreatorData.successRate
                    },
                    moonProjects: cleanedCreatorData.moonProjects
                } as any, // 临时使用 any 类型来避类型错误
                creatorHistory: creatorInfo.otherTokens,
                priceInfo: {
                    price: priceInfo?.price || 0,
                    marketCap: priceInfo?.marketCap || null,
                    marketCapTier: cleanedCreatorData.marketCapTier,
                    maturityStage: cleanedCreatorData.maturityStage
                },
                tokenInfo: {
                    ageInHours: (Date.now() - (creatorInfo.currentToken?.creationTime || Date.now())) / (1000 * 60 * 60),
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

            console.log('\n7. 分析结果:');
            console.log('风险等级:', analysisResult.riskLevel);
            console.log('风险因素:', analysisResult.riskFactors);
            console.log('投资建议:', analysisResult.recommendation);

            console.log('\n代币分析:');
            console.log('- 风险等级:', analysisResult.tokenAnalysis.riskLevel);
            console.log('- 风险因素:', analysisResult.tokenAnalysis.riskFactors);
            console.log('- 积极因素:', analysisResult.tokenAnalysis.positiveFactors);
            console.log('- 流动性评估:', analysisResult.tokenAnalysis.liquidityAssessment);
            console.log('- 持仓评估:', analysisResult.tokenAnalysis.holdingAssessment);

            console.log('\n创建者分析:');
            console.log('- 信用等级:', analysisResult.creatorAnalysis.trustLevel);
            console.log('- 项目成功率:', analysisResult.creatorAnalysis.successRate);
            console.log('- 风险行为:', analysisResult.creatorAnalysis.riskPatterns);
            console.log('- 历史表现:', analysisResult.creatorAnalysis.trackRecord);
            if (analysisResult.creatorAnalysis.moonProjectsAssessment) {
                console.log('- 起飞项目评估:', analysisResult.creatorAnalysis.moonProjectsAssessment);
            }

            if (analysisResult.matchedPatterns && analysisResult.matchedPatterns.length > 0) {
                console.log('\n匹配到的风险模式:');
                analysisResult.matchedPatterns.forEach((pattern, index) => {
                    console.log(`${index + 1}. ${pattern.pattern}`);
                    console.log(`   严重程度: ${pattern.riskLevel}`);
                    console.log(`   描述: ${pattern.description}`);
                });
            }

            // 验证分析结果
            expect(analysisResult).toBeDefined();
            expect(analysisResult.riskLevel).toBeDefined();
            expect(analysisResult.riskFactors).toBeInstanceOf(Array);
            expect(analysisResult.recommendation).toBeDefined();

            if (analysisResult.matchedPatterns) {
                console.log('\n匹配到的风险模式:',
                    analysisResult.matchedPatterns.map(p => p.pattern)
                );
            }

            console.log('========== 分析流程完成 ==========\n');
        });

        it('应该处理无效代币地址的情况', async () => {
            try {
                const invalidMint = new PublicKey('InvalidAddress123');
                await tokenInfoService.getTokenInfo(invalidMint);
                fail('应该抛出错误');
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
    });
});