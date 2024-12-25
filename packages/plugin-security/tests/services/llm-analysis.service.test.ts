import { LLMAnalysisService } from '../../src/services/llm-analysis.service';
import { DeepseekAPI } from '../../src/utils/deepseek';
import { TokenCreator, TokenHolding } from '../../src/types/token';

describe('LLMAnalysisService', () => {
    let llmAnalysisService: LLMAnalysisService;
    let deepseekAPI: DeepseekAPI;

    beforeEach(() => {
        console.log('\n========== 开始测试初始化 ==========');

        // 确保环境变量存在
        if (!process.env.DEEPSEEK_API_KEY) {
            throw new Error('需要设置 DEEPSEEK_API_KEY 环境变量');
        }
        console.log('使用环境变量中的 DEEPSEEK_API_KEY');

        // 创建真实的 DeepseekAPI 实例
        deepseekAPI = new DeepseekAPI(process.env.DEEPSEEK_API_KEY);
        console.log('已创建 DeepseekAPI 实例');

        // 创建 LLMAnalysisService 实例
        llmAnalysisService = new LLMAnalysisService(deepseekAPI);
        console.log('已创建 LLMAnalysisService 实例');
        console.log('========== 初始化完成 ==========\n');
    });

    describe('analyzeTokenRisk', () => {
        it('should analyze token risk with real Deepseek API', async () => {
            console.log('\n========== 测试 Deepseek API 调用 ==========');
            // 准备测试数据
            const mockInput = {
                tokenAddress: 'token123',
                creatorInfo: {
                    address: 'creator123',
                    otherTokens: []
                } as TokenCreator,
                creatorHistory: [
                    {
                        address: 'token1',
                        name: 'Token 1',
                        price: 1.0,
                        marketCap: 1000000
                    }
                ],
                priceInfo: {
                    price: 1.5,
                    marketCap: 2000000
                },
                holdingDistribution: {
                    totalHolders: 1000,
                    nonDexHolders: 800,
                    top5Percentage: 60,
                    topHoldings: [
                        {
                            address: 'holder1',
                            amount: 1000,
                            percentage: 30,
                            isDex: false,
                            totalHolders: 1000
                        }
                    ] as TokenHolding[]
                }
            };
            console.log('测试数据准备完成');

            // 执行测试
            console.log('\n开始调用 Deepseek API...');
            const result = await llmAnalysisService.analyzeTokenRisk(mockInput);
            console.log('API 调用结果:', JSON.stringify(result, null, 2));
            console.log('========== 测试完成 ==========\n');
        });
    });
});