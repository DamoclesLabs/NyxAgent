import { DeepseekAPI } from '../utils/deepseek';
import { TokenCreator, TokenHolding } from '../types/types';
import { KnowledgeBaseService } from './knowledge-base.service';
import { RiskPattern } from '../knowledge/token-risk-patterns';

interface TokenRiskAnalysisParams {
    tokenAddress: string;
    creatorInfo: any;
    creatorHistory: any[];
    priceInfo: {
        price: number;
        marketCap: number | null;
        marketCapTier?: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE';
        maturityStage?: 'LAUNCH' | 'STABILITY' | 'MATURITY';
    };
    holdingDistribution: any;
}

export interface AnalysisInput {
    tokenAddress: string;
    creatorInfo: TokenCreator & {
        qualityMetrics: {
            failedProjects: number;
            lowQualityProjects: number;
            mediumQualityProjects: number;
            highQualityProjects: number;
            moonProjects: number;
            moonRate: number;
            successRate: number;
        };
        moonProjects: Array<{
            name: string;
            marketCapSol: number;
            marketCapUsd: number;
            timestamp: number;
        }>;
    };
    creatorHistory: Array<{
        address: string;
        name: string;
        price?: number;
        marketCap?: number;
    }>;
    priceInfo: {
        price: number;
        marketCap: number | null;
        marketCapTier?: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE';
        maturityStage?: 'LAUNCH' | 'STABILITY' | 'MATURITY';
    };
    tokenInfo?: {
        ageInHours: number;
        maturityStage: 'LAUNCH' | 'STABILITY' | 'MATURITY';
    };
    holdingDistribution: {
        totalHolders: number;
        nonDexHolders: number;
        top5Percentage: number;
        topHoldings: TokenHolding[];
    };
}

export interface AnalysisResult {
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    riskFactors: string[];
    recommendation: string;
    matchedPatterns: RiskPattern[];
    tokenAnalysis: {
        riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
        riskFactors: string[];
        positiveFactors: string[];
        liquidityAssessment: string;
        holdingAssessment: string;
        maturityAssessment: string;
        marketCapTierAssessment: string;
    };
    creatorAnalysis: {
        trustLevel: 'HIGH' | 'MEDIUM' | 'LOW';
        successRate: string;
        riskPatterns: string[];
        trackRecord: string;
        moonProjectsAssessment?: string;
    };
}

export class LLMAnalysisService {
    private knowledgeBase: KnowledgeBaseService;

    constructor(
        private llm: DeepseekAPI
    ) {
        this.knowledgeBase = new KnowledgeBaseService();
    }

    async analyzeTokenRisk(input: AnalysisInput): Promise<AnalysisResult> {
        try {
            // 1. 首先使用知识库匹配已知的风险模式
            const matchedPatterns = await this.matchRiskPatterns(input);

            // 2. 构建包含匹配模式的提示
            const prompt = this.buildAnalysisPrompt(input, matchedPatterns);

            // 3. 使用LLM进行分析
            const response = await this.llm.analyze(prompt);
            const result = await this.parseAnalysisResponse(response);

            console.log(result);
            // 4. 合并结果
            return {
                ...result,
                matchedPatterns
            };
        } catch (error) {
            console.error('LLM分析出错:', error);
            throw error;
        }
    }

    private async matchRiskPatterns(input: AnalysisInput): Promise<RiskPattern[]> {
        const matchedPatterns = new Set<RiskPattern>();

        // 匹配创建者相关的风险模式
        const creatorPatterns = await this.knowledgeBase.matchCreatorPatterns(
            input.creatorInfo,
            input.creatorHistory
        );
        creatorPatterns.forEach(p => matchedPatterns.add(p));

        // 匹配持仓相关的风险模式
        const holdingPatterns = await this.knowledgeBase.matchHoldingPatterns(
            input.holdingDistribution
        );
        holdingPatterns.forEach(p => matchedPatterns.add(p));

        // 匹配价格相关的风险模式
        const pricePatterns = await this.knowledgeBase.matchPricePatterns({
            currentPrice: input.priceInfo.price,
        });
        pricePatterns.forEach(p => matchedPatterns.add(p));

        return Array.from(matchedPatterns);
    }

    private buildAnalysisPrompt(input: AnalysisInput, matchedPatterns: RiskPattern[]): string {
        const patternDescriptions = matchedPatterns.map(p =>
            `- ${p.pattern}: ${p.description}\n  Risk Indicators: ${p.indicators.join(', ')}`
        ).join('\n');

        // Calculate creator history token statistics
        const { qualityMetrics, moonProjects } = input.creatorInfo;

        return `Please perform a comprehensive risk analysis for the following token, evaluating both the token itself and its creator:

1. Current Token Basic Information:
- Contract Address: ${input.tokenAddress}
- Current Price: $${input.priceInfo.price}
- Market Cap: $${input.priceInfo.marketCap || 'Unknown'}
- Market Cap Tier: ${input.priceInfo.marketCapTier || 'Unknown'} (MICRO: <100 SOL, SMALL: 100-500 SOL, MEDIUM: 500-2500 SOL, LARGE: >2500 SOL)
- Token Age: ${input.tokenInfo.ageInHours.toFixed(2)} hours
- Maturity Stage: ${input.tokenInfo.maturityStage} (LAUNCH: ≤24h, STABILITY: 24-72h, MATURITY: >72h)

2. Current Token Holding Distribution:
- Total Holders: ${input.holdingDistribution.totalHolders}
- Non-DEX Holders: ${input.holdingDistribution.nonDexHolders}
- Top 5 Holdings Percentage: ${input.holdingDistribution.top5Percentage}%
${input.holdingDistribution.topHoldings.map((h, i) => `- Top ${i + 1} Holder: ${h.percentage.toFixed(2)}%`).join('\n')}

3. Creator History Analysis:
- Creator Wallet Address: ${input.creatorInfo.address}
- Total Historical Tokens: ${input.creatorHistory.length}
- Project Quality Distribution:
  - Failed Projects: ${qualityMetrics.failedProjects}
  - Low Quality Projects: ${qualityMetrics.lowQualityProjects}
  - Medium Quality Projects: ${qualityMetrics.mediumQualityProjects}
  - High Quality Projects: ${qualityMetrics.highQualityProjects}
  - Moon Projects: ${qualityMetrics.moonProjects}
- Success Rate: ${(qualityMetrics.successRate * 100).toFixed(2)}%
- Moon Rate: ${(qualityMetrics.moonRate * 100).toFixed(2)}%

${moonProjects.length > 0 ? `Moon Projects List:
${moonProjects.map(p => `- ${p.name}: Market Cap ${p.marketCapSol.toFixed(2)} SOL ($${p.marketCapUsd.toFixed(2)})`).join('\n')}` : 'No moon projects yet'}

4. Identified Risk Patterns:
${patternDescriptions}

Please analyze in detail from the following dimensions:

1. Token Security Analysis:
- Token Age and Maturity Assessment
  * New tokens (<24h) require special attention to initial price volatility and holding distribution changes
  * Stability period (24-72h) focus on market acceptance and holding distribution
  * Maturity period (>72h) evaluate long-term potential and market recognition
- Market Cap Tier Assessment
  * MICRO (<100 SOL): Extremely high risk, focus on liquidity and price manipulation risks
  * SMALL (100-500 SOL): High risk, monitor holding concentration and market depth
  * MEDIUM (500-2500 SOL): Medium risk, evaluate growth potential and market stability
  * LARGE (>2500 SOL): Relatively low risk, focus on long-term value and market impact
- Holding Distribution Concentration Analysis
- Liquidity Risk Assessment
- Potential Market Manipulation Risk Analysis
- Contract Security Assessment (if relevant risk patterns exist)

2. Creator Reputation Analysis:
- Historical Project Success Rate Assessment
- Token Issuance Frequency Analysis
- Historical Token Market Cap Performance Analysis
- Moon Project Ratio and Performance
- Overall Creator Credibility Assessment

Please return the analysis result in JSON format with the following fields:
{
    "tokenAnalysis": {
        "riskLevel": "HIGH/MEDIUM/LOW",
        "riskFactors": ["risk1", "risk2"],
        "positiveFactors": ["advantage1", "advantage2"],
        "liquidityAssessment": "liquidity status description",
        "holdingAssessment": "holding distribution status description",
        "maturityAssessment": "assessment based on token age",
        "marketCapTierAssessment": "assessment based on market cap tier"
    },
    "creatorAnalysis": {
        "trustLevel": "HIGH/MEDIUM/LOW",
        "successRate": "success rate assessment description",
        "riskPatterns": ["risk behavior1", "risk behavior2"],
        "trackRecord": "historical record assessment description",
        "moonProjectsAssessment": "moon projects performance description"
    },
    "riskLevel": "HIGH/MEDIUM/LOW",
    "recommendation": "specific investment recommendation"
}`;
    }

    private async parseAnalysisResponse(response: string): Promise<AnalysisResult> {
        try {
            const jsonStr = response.replace(/```json\n|\n```/g, '').trim();
            const result = JSON.parse(jsonStr);

            return {
                riskLevel: result.riskLevel,
                riskFactors: [
                    ...(result.tokenAnalysis?.riskFactors || []),
                    ...(result.creatorAnalysis?.riskPatterns || [])
                ],
                recommendation: result.recommendation,
                tokenAnalysis: {
                    riskLevel: result.tokenAnalysis?.riskLevel,
                    riskFactors: result.tokenAnalysis?.riskFactors || [],
                    positiveFactors: result.tokenAnalysis?.positiveFactors || [],
                    liquidityAssessment: result.tokenAnalysis?.liquidityAssessment,
                    holdingAssessment: result.tokenAnalysis?.holdingAssessment,
                    maturityAssessment: result.tokenAnalysis?.maturityAssessment,
                    marketCapTierAssessment: result.tokenAnalysis?.marketCapTierAssessment
                },
                creatorAnalysis: {
                    trustLevel: result.creatorAnalysis?.trustLevel,
                    successRate: result.creatorAnalysis?.successRate,
                    riskPatterns: result.creatorAnalysis?.riskPatterns || [],
                    trackRecord: result.creatorAnalysis?.trackRecord,
                    moonProjectsAssessment: result.creatorAnalysis?.moonProjectsAssessment
                },
                matchedPatterns: [] // This field will be filled in the outer layer
            };
        } catch (error) {
            console.error('Error parsing LLM response:', error);
            console.error('Original response:', response);
            // Return a default result instead of throwing an error
            return {
                riskLevel: 'HIGH',
                riskFactors: ['Error parsing response'],
                recommendation: 'Due to analysis error, please proceed with caution',
                matchedPatterns: [],
                tokenAnalysis: {
                    riskLevel: 'HIGH',
                    riskFactors: ['Parse error'],
                    positiveFactors: [],
                    liquidityAssessment: 'Unable to assess',
                    holdingAssessment: 'Unable to assess',
                    maturityAssessment: 'Unable to assess',
                    marketCapTierAssessment: 'Unable to assess'
                },
                creatorAnalysis: {
                    trustLevel: 'LOW',
                    successRate: 'Unable to assess',
                    riskPatterns: ['Data parsing failed'],
                    trackRecord: 'Unable to assess',
                    moonProjectsAssessment: 'Unable to assess'
                }
            };
        }
    }

    private mapRiskLevel(level: string): 'HIGH' | 'MEDIUM' | 'LOW' {
        const levelMap: { [key: string]: 'HIGH' | 'MEDIUM' | 'LOW' } = {
            '高': 'HIGH',
            '中': 'MEDIUM',
            '低': 'LOW'
        };
        return levelMap[level] || 'HIGH';
    }
}