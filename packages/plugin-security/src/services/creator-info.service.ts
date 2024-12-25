import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { TokenCreator } from '../types/types';
import { Metaplex } from '@metaplex-foundation/js';
import axios from 'axios';
import { PriceLiquidityService } from './price-liquidity.service';
import { TOKEN_PROGRAM_ID,getMint} from '@solana/spl-token';

interface TokenInfo {
    name: string;
    address: string;
    price?: number;
    supply?: number;
    marketCap?: number;
    timestamp: number;
}

export class CreatorInfoService {
    private metaplex: Metaplex;

    constructor(
        private connection: Connection,
        private priceLiquidityService: PriceLiquidityService
    ) {
        this.metaplex = Metaplex.make(connection);
    }

    async isContract(address: PublicKey): Promise<boolean> {
        try {
            const accountInfo = await this.connection.getAccountInfo(address);
            if (!accountInfo) return false;

            // 检查是否是可执行程序
            if (accountInfo.executable) return true;

            // 检查是否是代币程序
            if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) return true;

            // 检查是否不是系统程序（可能是其他类型的程序）
            return !accountInfo.owner.equals(SystemProgram.programId);
        } catch (error) {
            console.log('检查合约地址失败:', error);
            return false;
        }
    }

    private async getPumpFunInfo(mintAddress: string) {
        try {
            const response = await axios.get(
                `https://frontend-api.pump.fun/coins/${mintAddress}`
            );

            if (response.data && response.data.creator) {
                return {
                    creator: response.data.creator,
                    creationTime: Math.floor(response.data.created_timestamp / 1000),
                    raydiumPool: response.data.raydium_pool
                };
            }
            return null;
        } catch (error) {
            console.log('从 pump.fun 获取信息失败:', error);
            return null;
        }
    }

    async getCreatorInfo(tokenMint: PublicKey): Promise<TokenCreator> {
        try {
            console.log('\n========== 开始获取代币创建者信息 ==========');
            console.log('代币地址:', tokenMint.toString());

            // 1. 首先尝试从 pump.fun API 获取信息
            const pumpFunInfo = await this.getPumpFunInfo(tokenMint.toString());

            if (pumpFunInfo) {
                console.log('✅ 从 pump.fun 获取到创建者信息');
                // 6. 获取创建者的其他代币项目
                console.log('\n6. 获取创建者的其他代币项目...');
                const otherTokens = await this.getCreatorOtherTokens(new PublicKey(pumpFunInfo.creator));
                console.log(`✅ 找到 ${otherTokens.length} 个其他代币项目`);

                return {
                    address: pumpFunInfo.creator,
                    otherTokens: otherTokens.map(token => ({
                        address: token.address,
                        name: token.name,
                        price: token.price,
                        marketCap: token.marketCap,
                        timestamp: token.timestamp
                    })),
                    currentToken: {
                        creationTime: pumpFunInfo.creationTime,
                        raydiumPool: pumpFunInfo.raydiumPool
                    }
                };
            }

            // 2. 如果 pump.fun 获取失败，使用原有的链上数据获取方式
            console.log('从 pump.fun 获取失败，使用链上数据获取方式');
            // 1. 验证地址格式
            console.log('\n1. 验证地址格式...');
            if (!PublicKey.isOnCurve(tokenMint.toBuffer())) {
                console.log('❌ 无效的代币地址');
                return { address: '', otherTokens: [] };
            }
            console.log('✅ 地址格式验证通过');

            // 1.5 验证是否是合约地址
            console.log('\n1.5 验证是否是合约地址...');
            const isContractAddr = await this.isContract(tokenMint);
            if (!isContractAddr) {
                console.log('❌ 不是合约地址');
                return { address: '', otherTokens: [] };
            }
            console.log('✅ 合约地址验证通过');

            // 2. 获取所有交易记录
            console.log('\n2. 获取记录...');
            const allSignatures = await this.getAllTransactionSignatures(tokenMint);
            if (allSignatures.length === 0) {
                console.log('❌ 未找到任何交易记录');
                return { address: '', otherTokens: [] };
            }
            console.log(`✅ 获取到 ${allSignatures.length} 条交易记录`);

            console.log('- 最早区块高度:', allSignatures[allSignatures.length-1].slot,"\n",allSignatures[allSignatures.length-1].signature);

            // 首先按区块高度排序
            allSignatures.sort((a, b) => (a.slot || 0) - (b.slot || 0));

            // 检查排序后的前两个交易是否在同一区块
            if (allSignatures[0].slot === allSignatures[1].slot) {
                console.log('\n发现同区块交易，获取详细信息...');
                // 只获取这两个交易的详细信息
                const [tx1, tx2] = await Promise.all([
                    this.connection.getTransaction(allSignatures[0].signature, {
                        maxSupportedTransactionVersion: 0
                    }),
                    this.connection.getTransaction(allSignatures[1].signature, {
                        maxSupportedTransactionVersion: 0
                    })
                ]);

                // 如果两个交易的时戳也相同，分析指
                if (tx1?.blockTime === tx2?.blockTime) {
                    console.log('同区块交易时间戳相同，分析交易指令');

                    console.log(tx1?.meta?.logMessages);
                    console.log(tx2?.meta?.logMessages);
                    // 检查是否包含 Mint/Create 指令
                    const hasMintOrCreate1 = tx1?.meta?.logMessages?.some(log =>
                        log.includes('Instruction: Mint') ||
                        log.includes('Instruction: Create') ||
                        log.includes('Instruction: InitializeMint')
                    ) || false;

                    const hasMintOrCreate2 = tx2?.meta?.logMessages?.some(log =>
                        log.includes('Instruction: Mint') ||
                        log.includes('Instruction: Create') ||
                        log.includes('Instruction: InitializeMint')
                    ) || false;

                    console.log('交易1是否包含Mint/Create指令:', hasMintOrCreate1);
                    console.log('交易2是否包含Mint/Create指令:', hasMintOrCreate2);

                    // 包含 Mint/Create 指令的交易应该排在前面
                    if (!hasMintOrCreate1 && hasMintOrCreate2) {
                        // 交换位置
                        [allSignatures[0], allSignatures[1]] = [allSignatures[1], allSignatures[0]];
                    }
                }
            }

            console.log('\n交易记录已排序');
            console.log('排序后前两笔交易:');
            console.log('1.', allSignatures[0].signature, '\n   区块:', allSignatures[0].slot);
            console.log('2.', allSignatures[1].signature, '\n   区块:', allSignatures[1].slot);

            const earliestTx = allSignatures[0];

            console.log('最早交易详���:');
            console.log('- 交易签名:', earliestTx.signature);
            console.log('- 区块时间:', new Date(earliestTx.blockTime! * 1000).toLocaleString());
            console.log('- 确认状态:', earliestTx.confirmationStatus);

            this.sleep(500);
            // 4. 获取创建交易的详情
            console.log('\n4. 获取交易详情...');
            const tx = await this.connection.getParsedTransaction(
                earliestTx.signature,
                {
                    maxSupportedTransactionVersion: 0,
                    commitment: 'confirmed'
                }
            );

            if (!tx?.transaction?.message?.accountKeys?.[0]) {
                console.log('未找到有效的交易信息');
                return { address: '', otherTokens: [] };
            }

            // 5. 获取创建者信息
            const creator = tx.transaction.message.accountKeys[0].pubkey.toString();
            console.log('\n5. 建者信息:');
            console.log('- 地址:', creator);
            console.log('- 是否为签名者:', tx.transaction.message.accountKeys[0].signer);
            console.log('- 是否可写:', tx.transaction.message.accountKeys[0].writable);
            console.log('- 创建时间:', new Date(earliestTx.blockTime! * 1000).toLocaleString());

            // 6. 获取创建者的其他代币项目
            console.log('\n6. 获取创建者的其他代币项目...');
            const otherTokens = await this.getCreatorOtherTokens(new PublicKey(creator));
            console.log(`✅ 找到 ${otherTokens.length} 个其他代币项目`);

            console.log('\n========== 创建者信息获取完成 ==========\n');

            return {
                address: creator,
                otherTokens: otherTokens.map(token => ({
                    address: token.address,
                    name: token.name,
                    price: token.price,
                    marketCap: token.marketCap,
                    timestamp: token.timestamp
                })),
                currentToken: {
                    creationTime: earliestTx.blockTime || 0,
                    raydiumPool: null
                }
            };
        } catch (error) {
            console.log('❌ 获取创建者信息失败:', error);
            if (error instanceof Error) {
                console.log('错误类型:', error.name);
                console.log('错误信息:', error.message);
                console.log('错误堆栈:', error.stack);
            }
            return {
                address: '',
                otherTokens: []
            };
        }
    }

    private async getCreatorOtherTokens(creator: PublicKey) {
        try {
            console.log('\n--- 开始获取创建者的在最近400个区块内创建的其他代币 ---');

            // 第一次获取
            const response1 = await axios.get(
                `https://api.helius.xyz/v0/addresses/${creator.toString()}/transactions?api-key=${process.env.HELIUS_API_KEY}&type=CREATE&source=PUMP_FUN`
            );

            // 等待1秒
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 第二次获取
            const response2 = await axios.get(
                `https://api.helius.xyz/v0/addresses/${creator.toString()}/transactions?api-key=${process.env.HELIUS_API_KEY}&type=CREATE&source=PUMP_FUN`
            );

            // 比较两次结果，使用数组长度更长的那个
            const response = response1.data?.length >= (response2.data?.length || 0) ? response1 : response2;
            console.log(`第一次获取到 ${response1.data?.length || 0} 条记录`);
            console.log(`第二次获取到 ${response2.data?.length || 0} 条记录`);
            console.log(`最终使用 ${response.data?.length || 0} 条记录`);
            // 检查响应是否为空数组
            if (!response.data || response.data.length === 0) {
                console.log('未找到其他代币');
                return [];
            }

            const tokens = new Map<string, TokenInfo>();

            // 从每个交易中获取代币信息
            for (const tx of response.data) {
                if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
                    const transfer = tx.tokenTransfers[0];
                    const mintAddress = transfer.mint;
                    if (mintAddress && !tokens.has(mintAddress)) {
                        try {
                            // 获取代币基本信息
                            const mintInfo = await getMint(this.connection, new PublicKey(mintAddress));
                            const metadata = await this.metaplex
                                .nfts()
                                .findByMint({ mintAddress: new PublicKey(mintAddress) });

                            // 使用 PriceLiquidityService 获取价格
                            const price = await this.priceLiquidityService.getTokenPrice(mintAddress) ?? undefined;

                            // 计算实际供应量和市值
                            const actualSupply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);
                            const marketCap = price ? price * actualSupply : undefined;

                            tokens.set(mintAddress, {
                                name: metadata.name,
                                address: mintAddress,
                                price,
                                supply: actualSupply,
                                marketCap,
                                timestamp: tx.timestamp
                            });

                            console.log(`找到新代币: ${mintAddress}`);
                            console.log(`代币名称: ${metadata.name}`);
                            console.log(`创建时间: ${new Date(tx.timestamp * 1000).toLocaleString()}`);
                            console.log(`当前价格: ${price ? `$${price}` : '未知'}`);
                            console.log(`市值: ${marketCap}`);
                            await this.sleep(400);
                        } catch (error) {
                            console.log(`获取代币信息失败: ${error}`);
                        }
                    }
                }
            }

            const tokenList = Array.from(tokens.values()).map(token => ({
                address: token.address,
                name: token.name,
                price: token.price,
                marketCap: token.marketCap,
                timestamp: token.timestamp
            }));
            console.log(`\n✅ 成功获取 ${tokenList.length} 个代币信息`);
            console.log('--- 其他代币获取完成 within 400 block---\n');

            return tokenList;
        } catch (error) {
            console.log('❌ 获取创建者代币列表败:', error);
            if (error instanceof Error) {
                console.log('错误类型:', error.name);
                console.log('错误信息:', error.message);
                console.log('错误堆栈:', error.stack);
            }
            return [];
        }
    }

    private async getAllTransactionSignatures(mint: PublicKey) {
        console.log('\n--- 开始获取所有交易记录 ---');
        const allSignatures = [];
        let lastSignature = undefined;
        let pageCount = 0;

        while (true) {
            try {
                pageCount++;
                console.log(`\n取第 ${pageCount} 页交易记录...`);
                console.log('上一个签名:', lastSignature || '从最新开始');

                let retryCount = 0;
                let signatures;
                const maxRetries = 5;
                const baseDelay = 2000;

                while (retryCount < maxRetries) {
                    try {
                        signatures = await this.connection.getSignaturesForAddress(
                            mint,
                            {
                                before: lastSignature,
                                limit: 1000
                            },
                            'confirmed'
                        );
                        break;
                    } catch (error) {
                        retryCount++;
                        console.log(`获取签名失败，重试 ${retryCount}/${maxRetries}:`, error);
                        if (retryCount === maxRetries) {
                            throw error;
                        }
                        const delay = baseDelay * Math.pow(2, retryCount - 1);
                        console.log(`等待 ${delay/1000} 秒后重试...`);
                        await this.sleep(delay);
                    }
                }

                allSignatures.push(...(signatures || []));
                console.log(`本页获取到 ${signatures?.length || 0} 条记录`);
                console.log(`当前总计: ${allSignatures.length} 条记录`);

                if (signatures.length < 1000) {
                    console.log('记录数小于1000，尝试再次确认...');
                    lastSignature = allSignatures[allSignatures.length - 1].signature;
                    await this.sleep(2100);

                    const confirmSignatures = await this.connection.getSignaturesForAddress(
                        mint,
                        {
                            before: lastSignature,
                            limit: 1000
                        },
                        'confirmed'
                    );

                    if (!confirmSignatures || confirmSignatures.length === 0) {
                        console.log('确认没有更多交易记录');
                        break;
                    }

                    console.log(`发现额外的 ${confirmSignatures.length} 条记录，继续获取`);
                    allSignatures.push(...confirmSignatures);
                    lastSignature = allSignatures[allSignatures.length - 1].signature;
                } else {
                    if (!signatures || signatures.length === 0) {
                        console.log('没有更多交易记录');
                        break;
                    }
                    lastSignature = allSignatures[allSignatures.length - 1].signature;
                }

                await this.sleep(500);
            } catch (error) {
                console.log('获取交易记录失败:', error);
                break;
            }
        }

        return allSignatures;
    }

    private async sleep(ms: number): Promise<void> {
        if (ms <= 0) return;
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}