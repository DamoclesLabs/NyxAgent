import { Connection, PublicKey } from '@solana/web3.js';
import { CreatorInfoService } from '../../src/services/creator-info.service';
import { PriceLiquidityService } from '../../src/services/price-liquidity.service';

jest.setTimeout(3000000);

describe('CreatorInfoService', () => {
    let creatorInfoService: CreatorInfoService;
    let connection: Connection;
    let priceLiquidityService: PriceLiquidityService;

    beforeEach(() => {
        // 初始化 Solana 连接
        const rpcUrl = process.env.SOLANA_RPC_URL;
        if (!rpcUrl) {
            throw new Error('SOLANA_RPC_URL environment variable is not set');
        }
        connection = new Connection(rpcUrl);
        priceLiquidityService = new PriceLiquidityService(connection);
        creatorInfoService = new CreatorInfoService(connection, priceLiquidityService);
    });

    describe('getCreatorInfo', () => {
        it('should get creator info for a valid token', async () => {
            // 使用一个已知的代币地址进行测试
            const tokenMint = new PublicKey('Gn9k4RCU5kqeyJNkbb8CZHm3pcWpMtNn5SnkuCnjpump');

            const result = await creatorInfoService.getCreatorInfo(tokenMint);

            // 验证返回的数据结构
            expect(result).toHaveProperty('address');
            expect(result).toHaveProperty('otherTokens');
            expect(Array.isArray(result.otherTokens)).toBe(true);
        }); // 设置超时时间为30秒

        it('should handle invalid token address', async () => {
            // 使用一个无效的代币地址
            const invalidMint = new PublicKey('HfjxRB8Q6aqqiCDBKbSFpBi7kL22CZD3yUNXAEbsX5sV');

            const result = await creatorInfoService.getCreatorInfo(invalidMint);

            // 验证错误处理
            expect(result).toEqual({
                address: '',
                otherTokens: []
            });
        });
    });

});