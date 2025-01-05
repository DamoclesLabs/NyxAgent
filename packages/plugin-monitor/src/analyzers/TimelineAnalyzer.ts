import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { getMint } from '@solana/spl-token';
import { Metaplex } from '@metaplex-foundation/js';

interface TokenData {
  tokenAddress: string;
  tokenName: string;
  creator: string;
  createdAt: number;
  launchedAt: number;
  creatorTokens?: Array<{
    timestamp: number;
    tokenAddress: string;
    name?: string;
    price?: number;
    supply?: number;
    marketCap?: number;
  }>;
  creatorWalletAge?: {
    createdAt: number;
    isNewWallet: boolean;
  };
}

export class TimelineAnalyzer {
  private readonly pumpFunApiBase = 'https://frontend-api.pump.fun/coins';
  private readonly metaplex: Metaplex;
  private readonly jupiterPriceEndpoint = 'https://api.jup.ag/price/v2';

  constructor(private readonly connection: Connection) {
    this.metaplex = new Metaplex(connection);
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    operationName: string = 'operation'
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1;
        const delay = baseDelay * Math.pow(2, attempt);

        console.error(`${operationName} 失败 (尝试 ${attempt + 1}/${maxRetries}):`, error);

        if (isLastAttempt) {
          throw error;
        }

        console.log(`等待 ${delay}ms 后重试...`);
        await this.sleep(delay);
      }
    }
    throw new Error(`${operationName} 在 ${maxRetries} 次尝试后失败`);
  }

  private async getTokenPrice(mintAddress: string): Promise<number | undefined> {
    try {
      // 首先尝试从 pump.fun 获取数据
      const pumpFunResponse = await this.retry(
        async () => {
          const response = await axios.get(`${this.pumpFunApiBase}/${mintAddress}`);
          return response.data;
        },
        3,
        1000,
        '获取 PumpFun 数据'
      );

      if (pumpFunResponse?.usd_market_cap) {
        // 如果有市值数据，用市值除以10亿作为价格
        const price = pumpFunResponse.usd_market_cap / 1_000_000_000;
        console.log(`从 PumpFun 计算的价格: $${price}`);
        return price;
      }

      // 如果 pump.fun 没有数据，尝试从 Jupiter 获取
      console.log('尝试从 Jupiter 获取价格...');
      const jupiterResponse = await this.retry(
        async () => {
          const response = await axios.get(`${this.jupiterPriceEndpoint}?ids=${mintAddress}&showExtraInfo=true`);
          return response.data?.data?.[mintAddress]?.price;
        },
        3,
        1000,
        '获取 Jupiter 价格'
      );

      if (jupiterResponse) {
        console.log(`从 Jupiter 获取的价格: $${jupiterResponse}`);
        return jupiterResponse;
      }

      console.log(`未能获取到 ${mintAddress} 的价格数据`);
      return undefined;
    } catch (error) {
      console.error(`获取代币价格失败 (${mintAddress}):`, error);
      return undefined;
    }
  }

  private async getTokenMarketCap(mintAddress: string): Promise<number | undefined> {
    try {
      const response = await axios.get(`${this.pumpFunApiBase}/${mintAddress}`);
      return response.data?.usd_market_cap;
    } catch (error) {
      console.error(`获取市值失败 (${mintAddress}):`, error);
      return undefined;
    }
  }

  private async getWalletAge(address: string): Promise<{ createdAt: number; isNewWallet: boolean }> {
    return this.retry(
      async () => {
        console.log('\n--- 开始获取钱包创建时间 ---');

        // 获取第一批交易
        const firstResponse = await axios.get(
          `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${process.env.HELIUS_API_KEY}&source=SYSTEM_PROGRAM`
        );

        if (!firstResponse.data || firstResponse.data.length === 0) {
          console.log('未找到钱包交易记录');
          return { createdAt: 0, isNewWallet: true };
        }

        // 获取最早的交易
        let oldestTx = firstResponse.data[firstResponse.data.length - 1];
        let hasMore = true;

        while (hasMore) {
          await this.sleep(500);

          const response = await axios.get(
            `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${process.env.HELIUS_API_KEY}&source=SYSTEM_PROGRAM&before=${oldestTx.signature}`
          );

          if (!response.data || response.data.length === 0) {
            hasMore = false;
            continue;
          }

          oldestTx = response.data[response.data.length - 1];
        }

        const createdAt = oldestTx.timestamp * 1000;
        const walletAgeInHours = (Date.now() - createdAt) / (1000 * 60 * 60);
        const isNewWallet = walletAgeInHours < 24;

        console.log(`钱包最早交易签名: ${oldestTx.signature}`);
        console.log(`钱包创建时间: ${new Date(createdAt).toLocaleString()}`);
        console.log(`钱包年龄: ${walletAgeInHours.toFixed(1)} 小时`);
        console.log(`是否新钱包: ${isNewWallet ? '是' : '否'}`);

        return { createdAt, isNewWallet };
      },
      3,
      1000,
      '获取钱包年龄'
    ).catch(error => {
      console.error('获取钱包年龄失败:', error);
      return { createdAt: 0, isNewWallet: true };
    });
  }

  async getCreatorTokens(creator: string): Promise<Array<{
    timestamp: number;
    tokenAddress: string;
    name?: string;
    price?: number;
    supply?: number;
    marketCap?: number;
  }>> {
    return this.retry(
      async () => {
        console.log('\n--- 开始获取创建者的代币创建记录 ---');

        // 第一次获取
        const response1 = await axios.get(
          `https://api.helius.xyz/v0/addresses/${creator}/transactions?api-key=${process.env.HELIUS_API_KEY}&type=CREATE&source=PUMP_FUN`
        );

        await this.sleep(3000);

        // 第二次获取
        const response2 = await axios.get(
          `https://api.helius.xyz/v0/addresses/${creator}/transactions?api-key=${process.env.HELIUS_API_KEY}&type=CREATE&source=PUMP_FUN`
        );

        const response = response1.data?.length >= (response2.data?.length || 0) ? response1 : response2;
        console.log(`第一次获取到 ${response1.data?.length || 0} 条记录`);
        console.log(`第二次获取到 ${response2.data?.length || 0} 条记录`);
        console.log(`最终使用 ${response.data?.length || 0} 条记录`);

        if (!response.data || response.data.length === 0) {
          console.log('未找到代币创建记录');
          return [];
        }

        const tokens = new Map();

        for (const tx of response.data) {
          if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
            const transfer = tx.tokenTransfers[0];
            const mintAddress = transfer.mint;

            if (mintAddress && !tokens.has(mintAddress)) {
              try {
                const mintInfo = await this.retry(
                  async () => getMint(this.connection, new PublicKey(mintAddress)),
                  3,
                  1000,
                  `获取代币 ${mintAddress} 信息`
                );

                const metadata = await this.retry(
                  async () => this.metaplex.nfts().findByMint({ mintAddress: new PublicKey(mintAddress) }),
                  3,
                  1000,
                  `获取代币 ${mintAddress} 元数据`
                );

                await this.sleep(400);

                // 获取价格和市值
                const price = await this.getTokenPrice(mintAddress);
                const marketCap = await this.getTokenMarketCap(mintAddress);

                const actualSupply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);

                tokens.set(mintAddress, {
                  timestamp: tx.timestamp * 1000,
                  tokenAddress: mintAddress,
                  name: metadata.name,
                  price,
                  supply: actualSupply,
                  marketCap: marketCap || (price ? price * actualSupply : undefined)
                });

                console.log(`找到新代币: ${mintAddress}`);
                console.log(`代币名称: ${metadata.name}`);
                console.log(`创建时间: ${new Date(tx.timestamp * 1000).toLocaleString()}`);
                console.log(`当前价格: ${price ? `$${price}` : '未知'}`);
                console.log(`市值: ${marketCap ? `$${marketCap.toLocaleString()}` : '未知'}`);

                await this.sleep(400);
              } catch (error) {
                console.log(`获取代币信息失败: ${error}`);
              }
            }
          }
        }

        const tokenList = Array.from(tokens.values());
        console.log(`✅ 成功获取 ${tokenList.length} 个代币创建记录`);
        console.log('--- 代币创建记录获取完成 ---\n');

        return tokenList;
      },
      3,
      1000,
      '获取创建者代币列表'
    ).catch(error => {
      console.error('❌ 获取创建者代币列表失败:', error);
      if (error instanceof Error) {
        console.error('错误类型:', error.name);
        console.error('错误信息:', error.message);
        console.error('错误堆栈:', error.stack);
      }
      return [];
    });
  }

  async collectData(tokenAddress: string, launchTimestamp: number): Promise<TokenData> {
    return this.retry(
      async () => {
        const response = await axios.get(`${this.pumpFunApiBase}/${tokenAddress}`);
        const tokenInfo = response.data;

        const metadata = await this.retry(
          async () => this.metaplex.nfts().findByMint({ mintAddress: new PublicKey(tokenAddress) }),
          3,
          1000,
          `获取代币 ${tokenAddress} 元数据`
        );

        const creatorTokens = await this.getCreatorTokens(tokenInfo.creator);
        const creatorWalletAge = await this.getWalletAge(tokenInfo.creator);

        return {
          tokenAddress,
          tokenName: metadata.name,
          creator: tokenInfo.creator,
          createdAt: tokenInfo.created_timestamp,
          launchedAt: launchTimestamp,
          creatorTokens,
          creatorWalletAge
        };
      },
      3,
      1000,
      '收集代币数据'
    ).catch(error => {
      console.error('Error collecting token data:', error);
      throw new Error(`Failed to collect data for token ${tokenAddress}: ${error.message}`);
    });
  }
}