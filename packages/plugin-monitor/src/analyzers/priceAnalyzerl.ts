import { Connection, PublicKey, Commitment, AccountInfo, ParsedAccountData } from '@solana/web3.js';
import { TokenHolding, TokenHoldingInfo } from '../types/types';
import { ALL_DEX_ADDRESSES } from '../types/token';
import axios, { AxiosError } from 'axios';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';

export class PriceLiquidityService {
    private readonly USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    private readonly JUPITER_API_BASE = 'https://api.jup.ag/price/v2';
    private readonly RAYDIUM_ADDRESS = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
    private readonly HELIUS_URL: string;

    constructor(private connection: Connection) {
        if (!process.env.HELIUS_API_KEY) {
            throw new Error('HELIUS_API_KEY is required in environment variables');
        }
        this.HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    }

    private async getTokenHoldersCount(mint: string): Promise<number> {
        try {
            let totalHolders = 0;
            let cursor = undefined;

            while (true) {
                const response = await axios.post(this.HELIUS_URL, {
                    jsonrpc: "2.0",
                    id: "helius-test",
                    method: "getTokenAccounts",
                    params: {
                        mint: mint,
                        limit: 1000,
                        cursor: cursor
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 300));
                const data = response.data;
                if (!data?.result?.token_accounts || data.result.token_accounts.length === 0) {
                    break;
                }

                totalHolders += data.result.token_accounts.length;
                cursor = data.result.cursor;

                if (!cursor) break;
            }

            return totalHolders;
        } catch (error) {
            console.error('获取持有者数量失败:', error);
            return 0;
        }
    }

    async getTokenPrice(tokenAddress: string): Promise<number | null> {
        try {
            const response = await axios.get(
                `${this.JUPITER_API_BASE}?ids=${tokenAddress}&showExtraInfo=true`
            );

            console.log('API Response:', response.data);

            const tokenData = response.data.data[tokenAddress];
            if (!tokenData) {
                console.log('No price data available');
                return null;
            }

            // 确保价格是数字
            const price = Number(tokenData.price || 0);

            console.log('\n价格分析:');
            console.log(`当前价格: $${Number(price).toFixed(6)} USDC`);

            return price;
        } catch (error) {
            console.log('Error fetching price data:', error);
            if (error instanceof AxiosError && error.response) {
                console.log('API Response:', error.response.data);
            }
            return null;
        }
    }

    async getHoldingInfo(mint: PublicKey): Promise<TokenHoldingInfo> {
        try {
            console.log('正在获取代币账户信息...');

            // 获取代币的总供应量
            const supplyInfo = await this.connection.getTokenSupply(mint);
            const totalSupply = supplyInfo.value.uiAmount;

            if (!totalSupply) {
                console.log('无法获取代币总供应量');
                return {
                    holdings: [],
                    top5NonDexPercentage: 0
                };
            }

            console.log(`总供应量: ${totalSupply}`);

            // 获取前20大账户
            const largestAccounts = await this.connection.getTokenLargestAccounts(
                mint,
                'confirmed' as Commitment
            );

            if (!largestAccounts?.value) {
                console.log('未找到任何代币账户');
                return {
                    holdings: [],
                    top5NonDexPercentage: 0
                };
            }

            // 获取总持仓人数
            const totalHolders = await this.getTokenHoldersCount(mint.toString());
            console.log(`总持仓人数: ${totalHolders}`);

            // 获取每个代币账户的实际所有者
            const holdings = [];
            for (const account of largestAccounts.value) {
                try {
                    const tokenAccountInfo = await this.connection.getParsedAccountInfo(account.address);
                    const ownerAddress = (tokenAccountInfo.value?.data as ParsedAccountData)?.parsed?.info?.owner;

                    if (!ownerAddress) {
                        console.log(`无法获取账户 ${account.address.toString()} 的所有者地址`);
                        continue;
                    }

                    const balanceInfo = await this.connection.getTokenAccountBalance(account.address);
                    const amount = balanceInfo.value.uiAmount;

                    if (amount !== null) {
                        holdings.push({
                            address: ownerAddress,
                            amount: amount,
                            percentage: (amount / totalSupply) * 100,
                            isDex: ALL_DEX_ADDRESSES.includes(ownerAddress),
                            totalHolders: totalHolders
                        });
                    }

                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (error) {
                    console.log(`获取账户 ${account.address.toString()} 的信息时出错:`, error);
                    continue;
                }
            }

            // 按持仓比例降序排序
            const sortedHoldings = holdings.sort((a, b) => b.percentage - a.percentage);
            const top5NonDexPercentage = await this.logHoldingsSummary(sortedHoldings);
            console.log(`处理完成，返回 ${sortedHoldings.length} 个持仓账户，总持仓人数: ${totalHolders}`);
            console.log(`前5大非DEX持仓总占比: ${top5NonDexPercentage.toFixed(2)}%`);

            return {
                holdings: sortedHoldings,
                top5NonDexPercentage
            };
        } catch (error) {
            console.log('获取持仓信息时出错:', error);
            return {
                holdings: [],
                top5NonDexPercentage: 0
            };
        }
    }

    private async logHoldingsSummary(holdings: TokenHolding[]): Promise<number> {
        const dexHoldings = holdings.filter(h => h.isDex);
        const nonDexHoldings = holdings.filter(h => !h.isDex);

        console.log('\n持仓分布摘要:');
        console.log(`DEX持仓数量: ${dexHoldings.length}`);
        console.log(`普通账户数量: ${nonDexHoldings.length}`);

        const totalDexPercentage = dexHoldings.reduce((sum, h) => sum + h.percentage, 0);
        console.log(`DEX总持仓比例: ${totalDexPercentage.toFixed(2)}%`);

        if (nonDexHoldings.length > 0) {
            console.log('\n前5大持仓账户:');
            const top5NonDexPercentage = nonDexHoldings
                .slice(0, 5)
                .reduce((sum, h) => sum + h.percentage, 0);

            for (let i = 0; i < Math.min(5, nonDexHoldings.length); i++) {
                const holding = nonDexHoldings[i];
                console.log(`${i + 1}. ${holding.address}: ${holding.percentage.toFixed(2)}%`);
            }

            return top5NonDexPercentage;
        }

        return 0;
    }

    async getDetailedPriceInfo(tokenMint: string) {
        try {
            const priceData = await this.getTokenPrice(tokenMint);
            if (!priceData) return null;

            console.log('\n价格分析:');
            console.log(`当前价格: $${Number(priceData).toFixed(6)} USDC`);

            // 获取代币的总供应量
            const supplymint = await this.connection.getTokenSupply(new PublicKey(tokenMint));
            const totalSupply = supplymint.value.uiAmount;

            if (totalSupply) {
                // 计算市值 = 总供应量 * 当前价格
                const marketCap = Number(totalSupply) * Number(priceData);
                console.log(`市值: $${marketCap.toLocaleString()} USDC`);

                return {
                    price: priceData,
                    marketCap: marketCap
                };
            }

            return {
                price: priceData,
                marketCap: null
            };
        } catch (error) {
            console.log('Error getting detailed price info:', error);
            return null;
        }
    }
}