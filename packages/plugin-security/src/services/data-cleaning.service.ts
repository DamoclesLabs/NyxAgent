import {
    TokenHolding,
    TokenHoldingInfo,
    TokenCreator,
    PriceMetrics,
    MarketTierAnalysis,
    MARKET_CAP_TIERS,
    HEALTH_THRESHOLDS,
    CleanedHoldingData,
    CleanedCreatorData,
    ProjectQuality
} from '../types';
import axios from 'axios';

export class DataCleaningService {
    private getProjectQuality(marketCap: number): ProjectQuality {
        if (marketCap < MARKET_CAP_TIERS.MICRO) {
            return 'MICRO';
        } else if (marketCap < MARKET_CAP_TIERS.SMALL) {
            return 'SMALL';
        } else if (marketCap < MARKET_CAP_TIERS.MEDIUM) {
            return 'MEDIUM';
        } else {
            return 'LARGE';
        }
    }

    cleanHoldingData(holdingInfo: TokenHoldingInfo): CleanedHoldingData {
        const holdings = holdingInfo.holdings;
        const totalHolders = holdings[0]?.totalHolders || 0;

        // 1. 分离 DEX 和非 DEX 持仓
        const dexHoldings = holdings.filter(h => h.isDex);
        const nonDexHoldings = holdings.filter(h => !h.isDex);

        // 2. 计算 DEX 持仓总占比
        const dexHoldingPercentage = dexHoldings.reduce((sum, h) => sum + h.percentage, 0);

        // 3. 对非 DEX 持仓按百分比排序
        const sortedNonDexHoldings = nonDexHoldings
            .sort((a, b) => b.percentage - a.percentage);

        // 4. 计算前 5/10 大非 DEX 持仓总占比
        const top5NonDexHoldings = sortedNonDexHoldings.slice(0, 5);
        const top10NonDexHoldings = sortedNonDexHoldings.slice(0, 10);
        const top5Percentage = top5NonDexHoldings.reduce((sum, h) => sum + h.percentage, 0);
        const top10Percentage = top10NonDexHoldings.reduce((sum, h) => sum + h.percentage, 0);

        // 5. 准备详细的非 DEX 持仓信息
        const details = sortedNonDexHoldings
            .slice(0, 10) // 只取前10大非DEX持仓
            .map((h, index) => ({
                address: h.address,
                percentage: h.percentage,
                rank: index + 1
            }));

        const cleanedData = {
            totalHolders,
            nonDexHolders: nonDexHoldings.length,
            dexHoldingPercentage,
            nonDexDistribution: {
                top5Percentage,
                top10Percentage,
                details
            }
        };

        // 打印清洗后的数据，方便调试
        console.log('\n清洗后的持仓数据:');
        console.log(`总持仓人数: ${cleanedData.totalHolders}`);
        console.log(`非DEX持仓人数: ${cleanedData.nonDexHolders}`);
        console.log(`DEX持仓总占比: ${cleanedData.dexHoldingPercentage.toFixed(2)}%`);
        console.log(`前5大非DEX持仓总占比: ${cleanedData.nonDexDistribution.top5Percentage.toFixed(2)}%`);
        console.log(`前10大非DEX持仓总占比: ${cleanedData.nonDexDistribution.top10Percentage.toFixed(2)}%`);
        console.log('\n前10大非DEX持仓详情:');
        cleanedData.nonDexDistribution.details.forEach(h => {
            console.log(`${h.rank}. ${h.address}: ${h.percentage.toFixed(2)}%`);
        });

        return cleanedData;
    }

    async cleanCreatorData(creator: TokenCreator, tokenAddress: string, priceInfo?: {
        price?: number;
        marketCap?: number;
    }) {
        const solPrice = await this.getSolPrice();

        // 构建项目列表，并检查当前项目是否需要添加
        const projects = creator.otherTokens.map(token => ({
            name: token.name,
            address: token.address,
            marketCapSol: token.marketCap ? token.marketCap / solPrice : 0,
            marketCapUsd: token.marketCap || 0,
            quality: this.getProjectQuality(token.marketCap ? token.marketCap / solPrice : 0),
            timestamp: token.timestamp ? token.timestamp * 1000 : Date.now()
        }));

        // 如果当前项目有市值信息且不在列表中，添加到项目列表
        if (priceInfo?.marketCap && creator.currentToken) {
            const currentMarketCapSol = priceInfo.marketCap / solPrice;

            // 检查是否已存在（通过地址比较）
            const exists = projects.some(p => p.address === tokenAddress);

            if (!exists) {
                const currentProject = {
                    name: "Current Project",
                    address: tokenAddress,
                    marketCapSol: currentMarketCapSol,
                    marketCapUsd: priceInfo.marketCap,
                    quality: this.getProjectQuality(currentMarketCapSol),
                    timestamp: creator.currentToken.creationTime * 1000
                };
                projects.push(currentProject);
                console.log('Added current project to project list:', currentProject);
            } else {
                console.log('Current project already exists in the list, address:', tokenAddress);
            }
        }

        const currentMarketCap = priceInfo?.marketCap ?
            priceInfo.marketCap / solPrice : 0;

        // 统计各品质项目数量
        const projectsByQuality = {
            micro: projects.filter(p => p.quality === 'MICRO').length,
            small: projects.filter(p => p.quality === 'SMALL').length,
            medium: projects.filter(p => p.quality === 'MEDIUM').length,
            large: projects.filter(p => p.quality === 'LARGE').length
        };

        const totalProjects = projects.length;

        // 计算品质分布
        const qualityDistribution = {
            micro: totalProjects ? projectsByQuality.micro / totalProjects : 0,
            small: totalProjects ? projectsByQuality.small / totalProjects : 0,
            medium: totalProjects ? projectsByQuality.medium / totalProjects : 0,
            large: totalProjects ? projectsByQuality.large / totalProjects : 0
        };

        // 取起飞项目详情
        const moonProjects = projects
            .filter(p => p.quality === 'LARGE')
            .map(p => ({
                name: p.name,
                marketCapSol: p.marketCapSol,
                marketCapUsd: p.marketCapUsd,
                timestamp: p.timestamp
            }));

        // 计算平均市值、成功率和起飞率
        const avgMarketCap = totalProjects ?
            projects.reduce((sum, p) => sum + p.marketCapSol, 0) / totalProjects : 0;
        const successRate = totalProjects ?
            (totalProjects - projectsByQuality.micro) / totalProjects : 0;
        const moonRate = totalProjects ? projectsByQuality.large / totalProjects : 0;

        // 计算当前代币的市值分层
        const marketCapTier = this.getProjectQuality(currentMarketCap);

        // 计算代币年龄和阶段
        const creationTime = creator.currentToken?.creationTime || 0;
        const ageInHours = creationTime ?
            (Date.now() - creationTime * 1000) / (1000 * 60 * 60) : 0;

        // 根据 raydiumPool 和代币年龄判断阶段
        let maturityStage: 'LAUNCH' | 'STABILITY' | 'MATURITY';
        if (creator.currentToken?.raydiumPool === null) {
            maturityStage = 'LAUNCH';
        } else if (ageInHours <= 72) {
            maturityStage = 'STABILITY';
        } else {
            maturityStage = 'MATURITY';
        }

        const cleanedData = {
            address: creator.address,
            totalProjects,
            projectsByQuality,
            qualityDistribution,
            moonProjects: moonProjects.map(p => ({
                name: p.name,
                marketCapSol: p.marketCapSol,
                marketCapUsd: p.marketCapUsd,
                timestamp: p.timestamp
            })),
            recentProjects: projects
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 5),
            avgMarketCap,
            successRate,
            moonRate,
            marketCapTier,
            maturityStage,
            ageInHours  // 添加代币年龄字段
        };

        // 打印清洗后的数据
        console.log('\n清洗后的创建者数据:');
        console.log(`地址: ${cleanedData.address}`);
        console.log(`总项目数: ${cleanedData.totalProjects}`);
        console.log('\n项目质量分布:');
        console.log(`微市值项目: ${projectsByQuality.micro} (${(qualityDistribution.micro * 100).toFixed(2)}%)`);
        console.log(`小市值项目: ${projectsByQuality.small} (${(qualityDistribution.small * 100).toFixed(2)}%)`);
        console.log(`中市值项目: ${projectsByQuality.medium} (${(qualityDistribution.medium * 100).toFixed(2)}%)`);
        console.log(`大市值项目: ${projectsByQuality.large} (${(qualityDistribution.large * 100).toFixed(2)}%)`);
        console.log(`\n平均市值: $${avgMarketCap.toFixed(2)}`);
        console.log(`成功率: ${(successRate * 100).toFixed(2)}%`);
        console.log(`起飞率: ${(moonRate * 100).toFixed(2)}%`);
        console.log(`市值分层: ${marketCapTier}`);
        console.log(`成熟度阶段: ${maturityStage}`);
        console.log(`代币年龄: ${ageInHours.toFixed(2)}小时`);

        if (moonProjects.length > 0) {
            console.log('\n起飞项目列表:');
            moonProjects.forEach((p, i) => {
                console.log(`${i + 1}. ${p.name}`);
                console.log(`   - 市值(SOL): ${p.marketCapSol.toFixed(2)} SOL`);
                console.log(`   - 市值(USD): $${p.marketCapUsd.toFixed(2)}`);
                console.log(`   - 创建时间: ${new Date(p.timestamp).toLocaleString()}`);
            });
        }

        console.log('\n最近项目:');
        cleanedData.recentProjects.forEach((p, i) => {
            console.log(`${i + 1}. ${p.name} - 市值(SOL): ${p.marketCapSol.toFixed(2)} SOL - 市值(USD): $${p.marketCapUsd.toFixed(2)} - 质量: ${p.quality} - 创建时间: ${new Date(p.timestamp).toLocaleString()}`);
        });

        return cleanedData;
    }

    // 未来可以添加更多的数据清洗方法
    // cleanPriceData()
    // cleanTransactionData()
    // cleanLiquidityData()
    // etc...

    /**
     * 获取 SOL 当前价格
     * 使用多个数据源并取中位数
     */
    private async getSolPrice(): Promise<number> {
        try {
            // 使用 Jupiter API 获取 SOL 价格
            const jupiterResponse = await axios.get(
                'https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112'
            );

            // 从响应中正确提取价格
            const solPrice = Number(jupiterResponse.data.data.So11111111111111111111111111111111111111112.price);

            if (isNaN(solPrice) || solPrice <= 0) {
                throw new Error('获取到的 SOL 价格无效');
            }

            console.log('当前 SOL 价格:', solPrice);
            return solPrice;
        } catch (error) {
            console.error('获取 SOL 价格失败:', error);
            throw error;
        }
    }

    /**
     * 转换为 SOL 计价的指标
     */
    async convertToSolMetrics(data: {
        usdPrice: number;
        marketCapUsd: number;
        volume24hUsd: number;
        liquidityUsd: number;
    }): Promise<PriceMetrics> {
        const solUsdPrice = await this.getSolPrice();

        return {
            usdPrice: data.usdPrice,
            solPrice: data.usdPrice / solUsdPrice,
            solUsdPrice,
            marketCapInSol: data.marketCapUsd / solUsdPrice,
            volume24hInSol: data.volume24hUsd / solUsdPrice,
            liquidityInSol: data.liquidityUsd / solUsdPrice
        };
    }

    /**
     * 评估市值分层
     */
    private getMarketTier(marketCapInSol: number): MarketTierAnalysis['tier'] {
        if (marketCapInSol < MARKET_CAP_TIERS.MICRO) {
            return 'MICRO';
        } else if (marketCapInSol < MARKET_CAP_TIERS.SMALL) {
            return 'SMALL';
        } else if (marketCapInSol < MARKET_CAP_TIERS.MEDIUM) {
            return 'MEDIUM';
        } else {
            return 'LARGE';
        }
    }

    /**
     * 评估健康度指标
     */
    private evaluateHealthMetrics(
        solMetrics: PriceMetrics,
        holdingData: CleanedHoldingData
    ) {
        const liquidityRatio = solMetrics.marketCapInSol / solMetrics.liquidityInSol;
        const volumeRatio = solMetrics.volume24hInSol / solMetrics.liquidityInSol;

        return {
            holderMetrics: {
                count: holdingData.totalHolders,
                distribution: holdingData.nonDexDistribution.top5Percentage,
                isHealthy: holdingData.nonDexDistribution.top5Percentage <= HEALTH_THRESHOLDS.HOLDER_CONCENTRATION.HEALTHY.max
            },
            liquidityMetrics: {
                ratio: liquidityRatio,
                depth: solMetrics.liquidityInSol,
                isHealthy: liquidityRatio >= HEALTH_THRESHOLDS.LIQUIDITY_RATIO.HEALTHY.min &&
                          liquidityRatio <= HEALTH_THRESHOLDS.LIQUIDITY_RATIO.HEALTHY.max
            },
            volumeMetrics: {
                daily: solMetrics.volume24hInSol,
                volatility: volumeRatio,
                isHealthy: volumeRatio >= HEALTH_THRESHOLDS.VOLUME_RATIO.HEALTHY.min &&
                          volumeRatio <= HEALTH_THRESHOLDS.VOLUME_RATIO.HEALTHY.max
            }
        };
    }

    /**
     * 获基于时间的调整
     */
    private getTimeBasedAdjustment(creationTime?: number) {
        if (!creationTime) {
            return {
                phase: 'MATURITY' as const,
                adjustedThresholds: {
                    expectedGrowth: 0.01,
                    volatilityTolerance: 0.1
                }
            };
        }

        const now = Date.now() / 1000;
        const ageInHours = (now - creationTime) / 3600;
        console.log("!!!!!!!!!!!",ageInHours)
        if (ageInHours <= 24) {
            return {
                phase: 'LAUNCH' as const,
                adjustedThresholds: {
                    expectedGrowth: 0.1,
                    volatilityTolerance: 0.3
                }
            };
        } else if (ageInHours <= 72) {
            return {
                phase: 'STABILITY' as const,
                adjustedThresholds: {
                    expectedGrowth: 0.05,
                    volatilityTolerance: 0.2
                }
            };
        } else {
            return {
                phase: 'MATURITY' as const,
                adjustedThresholds: {
                    expectedGrowth: 0.01,
                    volatilityTolerance: 0.1
                }
            };
        }
    }

    /**
     * 生成市值分层建议
     */
    private generateTierRecommendations(
        tier: MarketTierAnalysis['tier'],
        healthMetrics: MarketTierAnalysis['healthMetrics'],
        solMetrics: PriceMetrics
    ) {
        const warnings: string[] = [];
        const suggestions: string[] = [];
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

        // 检查持仓集中度
        if (!healthMetrics.holderMetrics.isHealthy) {
            warnings.push('持仓过于集中');
            riskLevel = 'HIGH';
        }

        // 检查流动性
        if (!healthMetrics.liquidityMetrics.isHealthy) {
            warnings.push('流动性不足或市值/流动性比率异常');
            suggestions.push('建议关注流动性变化');
            riskLevel = 'HIGH';
        }

        // 检查交易量
        if (!healthMetrics.volumeMetrics.isHealthy) {
            warnings.push('交易量异常');
            suggestions.push('建议观察交易量变化趋势');
            riskLevel = riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM';
        }

        return {
            riskLevel,
            suggestions,
            warningFlags: warnings
        };
    }

    /**
     * 市值分层评估
     */
    async evaluateMarketTier(data: {
        priceInfo: {
            usdPrice: number;
            marketCapUsd: number;
            volume24hUsd: number;
            liquidityUsd: number;
        };
        holdingInfo: TokenHoldingInfo;
        creationTime?: number;
        raydiumPool?: any;
    }): Promise<MarketTierAnalysis> {
        // 1. 转换为 SOL 计价
        const solMetrics = await this.convertToSolMetrics({
            usdPrice: data.priceInfo.usdPrice,
            marketCapUsd: data.priceInfo.marketCapUsd,
            volume24hUsd: data.priceInfo.volume24hUsd,
            liquidityUsd: data.priceInfo.liquidityUsd
        });

        // 2. 清洗持仓数据
        const cleanedHoldingData = this.cleanHoldingData(data.holdingInfo);

        // 3. 确定市值分层
        const tier = this.getMarketTier(solMetrics.marketCapInSol);

        // 4. 评估健康度指标
        const healthMetrics = this.evaluateHealthMetrics(solMetrics, cleanedHoldingData);

        // 5. 获取时间维度调整
        const timeAdjustment = this.getTimeBasedAdjustment(data.creationTime);

        // 6. 根据 raydiumPool 判断代币阶段
        const tokenStage = data.raydiumPool === null ? 'LAUNCH' :
                         timeAdjustment.phase === 'LAUNCH' ? 'STABILITY' :
                         'MATURITY';

        // 7. 生成建议
        const recommendations = this.generateTierRecommendations(
            tier,
            healthMetrics,
            solMetrics
        );

        return {
            tier,
            solMetrics,
            healthMetrics,
            timeAdjustment,
            tokenStage,
            recommendations
        };
    }
}