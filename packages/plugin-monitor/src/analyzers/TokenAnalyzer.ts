import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } from '@solana/spl-token';

interface TokenHolding {
  tokenAddress: string;
  balance: number;
  balanceUSD?: number;
}

interface TokenAnalysis {
  creatorHolding?: TokenHolding;
}

export class TokenAnalyzer {
    private connection: Connection;
    private cache: Map<string, {
      data: TokenHolding;
      timestamp: number;
    }>;
    private CACHE_TTL = 30 * 1000; // 30秒缓存

    constructor(connection: Connection) {
      this.connection = connection;
      this.cache = new Map();
    }

    private async checkATAExists(ata: PublicKey): Promise<boolean> {
      try {
        await getAccount(this.connection, ata);
        return true;
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError) {
          console.log('代币账户未创建');
          return false;
        }
        console.error('检查代币账户时发生错误:', error);
        return false;
      }
    }

    async getTokenHolding(walletAddress: string, tokenMint: string): Promise<TokenHolding> {
      try {
        // 检查缓存
        const cacheKey = `holding-${walletAddress}-${tokenMint}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
          return cached.data;
        }

        // 验证代币地址
        const mintPubkey = new PublicKey(tokenMint);
        const walletPubkey = new PublicKey(walletAddress);

        // 获取代币信息
        const mintInfo = await this.connection.getParsedAccountInfo(mintPubkey);
        if (!mintInfo.value) {
          console.log(`代币 ${tokenMint} 不存在`);
          return {
            tokenAddress: tokenMint,
            balance: 0
          };
        }

        const decimals = (mintInfo.value.data as any).parsed.info.decimals;

        // 获取ATA地址
        const ata = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
        let balance = 0;
        let foundAccount = false;

        // 检查 ATA 是否存在
        if (await this.checkATAExists(ata)) {
          try {
            const tokenBalance = await this.connection.getTokenAccountBalance(ata);
            balance = Number(tokenBalance.value.amount)/Math.pow(10, decimals);
            foundAccount = true;
            console.log(`在 ATA 中找到余额: ${balance}`);
          } catch (error) {
            if (error instanceof Error) {
              console.log(`获取 ATA 余额失败: ${error.message}`);
            } else {
              console.log('获取 ATA 余额时发生未知错误');
            }
          }
        } else {
          console.log('ATA 不存在，检查其他代币账户...');
        }

        // 如果 ATA 不存在或获取失败，检查其他代币账户
        if (!foundAccount) {
          try {
            const tokenAccounts = await this.connection.getTokenAccountsByOwner(
              walletPubkey,
              {
                mint: mintPubkey
              }
            );

            if (tokenAccounts.value.length > 0) {
              const tokenBalance = await this.connection.getTokenAccountBalance(
                tokenAccounts.value[0].pubkey
              );
              balance = Number(tokenBalance.value.amount)/Math.pow(10, decimals);
              foundAccount = true;
              console.log(`在其他账户中找到余额: ${balance}`);
            } else {
              console.log('未找到任何代币账户');
            }
          } catch (error) {
            if (error instanceof Error) {
              console.log(`获取其他代币账户失败: ${error.message}`);
            } else {
              console.log('获取其他代币账户时发生未知错误');
            }
          }
        }

        // 构造返回结果
        const holding: TokenHolding = {
          tokenAddress: tokenMint,
          balance: balance
        };

        // 更新缓存
        this.cache.set(cacheKey, {
          data: holding,
          timestamp: Date.now()
        });

        return holding;

      } catch (error) {
        if (error instanceof Error) {
          console.log(`获取代币持仓失败: ${error.message}`);
        } else {
          console.log('获取代币持仓时发生未知错误');
        }
        // 返回默认值而不是抛出错误
        return {
          tokenAddress: tokenMint,
          balance: 0
        };
      }
    }

    async getBatchTokenHoldings(
      walletAddresses: string[],
      tokenMint: string
    ): Promise<Map<string, TokenHolding>> {
      const results = new Map<string, TokenHolding>();

      await Promise.all(
        walletAddresses.map(async (wallet) => {
          try {
            const holding = await this.getTokenHolding(wallet, tokenMint);
            results.set(wallet, holding);
          } catch (error) {
            if (error instanceof Error) {
              console.log(`获取 ${wallet} 的持仓失败: ${error.message}`);
            } else {
              console.log(`获取 ${wallet} 的持仓时发生未知错误`);
            }
            results.set(wallet, {
              tokenAddress: tokenMint,
              balance: 0
            });
          }
        })
      );

      return results;
    }

    async getCreatorHolding(creator: string, tokenMint: string): Promise<TokenAnalysis> {
      try {
        const holding = await this.getTokenHolding(creator, tokenMint);
        return {
          creatorHolding: holding
        };
      } catch (error) {
        if (error instanceof Error) {
          console.log(`获取创建者持仓失败: ${error.message}`);
        } else {
          console.log('获取创建者持仓时发生未知错误');
        }
        return {
          creatorHolding: {
            tokenAddress: tokenMint,
            balance: 0
          }
        };
      }
    }

    clearCache() {
      this.cache.clear();
    }

    async analyzeToken(tokenAddress: string, creator: string): Promise<TokenAnalysis> {
      try {
        const holding = await this.getTokenHolding(creator, tokenAddress);
        console.log("创建者持仓数量：", holding.balance, "代币地址：", holding.tokenAddress);
        return {
          creatorHolding: holding
        };
      } catch (error) {
        if (error instanceof Error) {
          console.log(`分析代币失败: ${error.message}`);
        } else {
          console.log('分析代币时发生未知错误');
        }
        return {
          creatorHolding: {
            tokenAddress: tokenAddress,
            balance: 0
          }
        };
      }
    }
}