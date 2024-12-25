import { RiskPattern, TOKEN_RISK_PATTERNS } from '../knowledge/token-risk-patterns';
import { TokenCreator, TokenHolding } from '../types';

export class KnowledgeBaseService {
    private patterns: RiskPattern[] = TOKEN_RISK_PATTERNS;

    // 根据创建者历史匹配风险模式
    async matchCreatorPatterns(creator: TokenCreator, history: Array<any>): Promise<RiskPattern[]> {
        const matches: RiskPattern[] = [];
        const creatorPatterns = this.patterns.filter(p => p.category === 'CREATOR');

        for (const pattern of creatorPatterns) {
            // 检查失败项目模式
            if (pattern.id === 'CREATOR-001') {
                const failedTokens = history.filter(token =>
                    token.price && token.price < (token.initialPrice || 0) * 0.1
                );
                if (failedTokens.length > 0) {
                    matches.push(pattern);
                }
            }
        }

        return matches;
    }

    // 根据持仓分布匹配风险模式
    async matchHoldingPatterns(distribution: {
        totalHolders: number;
        nonDexHolders: number;
        top5Percentage: number;
        topHoldings: TokenHolding[];
    }): Promise<RiskPattern[]> {
        const matches: RiskPattern[] = [];
        const holdingPatterns = this.patterns.filter(p => p.category === 'HOLDING');

        for (const pattern of holdingPatterns) {
            // 检查高度集中模式
            if (pattern.id === 'HOLDING-001') {
                if (distribution.top5Percentage > 50) {
                    matches.push(pattern);
                }
            }
        }

        return matches;
    }

    // 根据价格行为匹配风险模式
    async matchPricePatterns(priceData: {
        currentPrice: number;
        priceHistory?: Array<{price: number, timestamp: number}>;
        volume?: number;
    }): Promise<RiskPattern[]> {
        const matches: RiskPattern[] = [];
        const pricePatterns = this.patterns.filter(p => p.category === 'PRICE');

        // 如果有价格历史数据，进行更详细的分析
        if (priceData.priceHistory && priceData.priceHistory.length > 0) {
            for (const pattern of pricePatterns) {
                if (pattern.id === 'PRICE-001') {
                    // 检查突然的价格变化
                    const priceChanges = this.analyzePriceChanges(priceData.priceHistory);
                    if (priceChanges.hasSuddenSpikes) {
                        matches.push(pattern);
                    }
                }
            }
        }

        return matches;
    }

    private analyzePriceChanges(priceHistory: Array<{price: number, timestamp: number}>) {
        let hasSuddenSpikes = false;
        const SPIKE_THRESHOLD = 0.3; // 30%的价格变化被认为是突然变化

        for (let i = 1; i < priceHistory.length; i++) {
            const priceChange = Math.abs(
                (priceHistory[i].price - priceHistory[i-1].price) / priceHistory[i-1].price
            );
            if (priceChange > SPIKE_THRESHOLD) {
                hasSuddenSpikes = true;
                break;
            }
        }

        return {
            hasSuddenSpikes
        };
    }

    // 获取特定类别的所有风险模式
    getPatternsByCategory(category: string): RiskPattern[] {
        return this.patterns.filter(p => p.category === category);
    }

    // 根据风险等级获取模式
    getPatternsByRiskLevel(level: 'HIGH' | 'MEDIUM' | 'LOW'): RiskPattern[] {
        return this.patterns.filter(p => p.riskLevel === level);
    }
}