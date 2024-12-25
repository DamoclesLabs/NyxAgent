import { TokenData } from '../types';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskAssessmentResult {
    riskLevel: RiskLevel;
    riskScore: number;
    detailedAnalysis: string[];
}

export class RiskAssessmentService {
    async assessRisk(tokenData: TokenData): Promise<RiskAssessmentResult> {
        let riskScore = 0;
        const detailedAnalysis: string[] = [];

        console.log('\n开始风险评估...');

        // 1. 持仓集中度分析
        const top20Percentage = this.calculateTop20HoldingPercentage(tokenData.holdings);
        console.log('\n1. 持仓集中度分析:');
        console.log(`- 前20大持有者总占比: ${top20Percentage.toFixed(2)}%`);

        if (top20Percentage > 50) {
            riskScore += 5;
            detailedAnalysis.push('高度集中: 前20大持有者占比超过50%');
            console.log('- 高度集中 (+5分)');
        } else if (top20Percentage > 30) {
            riskScore += 3;
            detailedAnalysis.push('中度集中: 前20大持有者占比超过30%');
            console.log('- 中度集中 (+3分)');
        }

        // 2. 合约权限分析
        console.log('\n2. 合约权限分析:');
        if (tokenData.contract.mintAuthority) {
            riskScore += 4;
            detailedAnalysis.push('存在铸币权限');
            console.log('- 存在铸币权限 (+4分)');
        }
        if (tokenData.contract.freezeAuthority) {
            riskScore += 3;
            detailedAnalysis.push('存在冻结权限');
            console.log('- 存在冻结权限 (+3分)');
        }

        // 3. DEX流动性分析
        const dexLiquidity = tokenData.holdings
            .filter(h => h.isDex)
            .reduce((sum, h) => sum + h.percentage, 0);

        console.log('\n3. DEX流动性分析:');
        console.log(`- 当前DEX流动性: ${dexLiquidity.toFixed(2)}%`);

        if (dexLiquidity < 5) {
            riskScore += 3;
            detailedAnalysis.push('极低流动性: DEX流动性低于5%');
            console.log('- 极低流动性 (+3分)');
        } else if (dexLiquidity < 10) {
            riskScore += 2;
            detailedAnalysis.push('低流动性: DEX流动性低于10%');
            console.log('- 低流动性 (+2分)');
        }

        // 4. 开发者历史分析
        console.log('\n4. 开发者分析:');
        console.log(`- 开发者创建的代币数量: ${tokenData.creator.otherTokens.length}`);

        if (tokenData.creator.otherTokens.length > 10) {
            riskScore += 3;
            detailedAnalysis.push('高风险开发者: 创建了超过10个代币');
            console.log('- 高风险开发者 (+3分)');
        } else if (tokenData.creator.otherTokens.length > 5) {
            riskScore += 2;
            detailedAnalysis.push('可疑开发者: 创建了超过5个代币');
            console.log('- 可疑开发者 (+2分)');
        }

        // 5. 市值分析
        console.log('\n5. 市值分析:');
        console.log(`- 当前市值: $${tokenData.marketCap?.toLocaleString() || '未知'}`);

        if (tokenData.marketCap && tokenData.marketCap < 10000) {
            riskScore += 2;
            detailedAnalysis.push('微小市值: 市值低于$10,000');
            console.log('- 微小市值 (+2分)');
        }

        console.log(`\n总风险评分: ${riskScore}`);

        // 确定最终风险等级
        let riskLevel: RiskLevel;
        if (riskScore >= 7) {
            riskLevel = 'HIGH';
            console.log('最终风险等级: HIGH (得分>=7)');
        } else if (riskScore >= 4) {
            riskLevel = 'MEDIUM';
            console.log('最终风险等级: MEDIUM (得分>=4)');
        } else {
            riskLevel = 'LOW';
            console.log('最终风险等级: LOW (得分<4)');
        }

        return {
            riskLevel,
            riskScore,
            detailedAnalysis
        };
    }

    private calculateTop20HoldingPercentage(holdings: TokenData['holdings']): number {
        // 过滤掉DEX地址，只计算普通持有者
        const nonDexHoldings = holdings.filter(h => !h.isDex);

        // 获取前20大持有者
        const top20Holdings = nonDexHoldings
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 20);

        // 计算总持仓比例
        return top20Holdings.reduce((sum, h) => sum + h.percentage, 0);
    }
}