import { Connection, PublicKey } from '@solana/web3.js';
import { PriceLiquidityService } from '../../src/services/price-liquidity.service';

describe('PriceLiquidityService', () => {
    let priceLiquidityService: PriceLiquidityService;
    let connection: Connection;

    beforeEach(() => {
        console.log('\n========== 开始测试初始化 ==========');

        // 初始化 Solana 连接
        const rpcUrl = process.env.SOLANA_RPC_URL;
        if (!rpcUrl) {
            throw new Error('需要设置 SOLANA_RPC_URL 环境变量');
        }
        console.log('使用环境变量中的 SOLANA_RPC_URL');

        connection = new Connection(rpcUrl);
        console.log('已创建 Solana 连接');

        // 创建服务实例
        priceLiquidityService = new PriceLiquidityService(connection);
        console.log('已创建 PriceLiquidityService 实例');
        console.log('========== 初始化完成 ==========\n');
    });

    describe('getTokenPrice', () => {
        it('should get price for a valid token', async () => {
            console.log('\n========== 测试获取代币价格 ==========');
            // 使用 USDC 代币地址进行测试
            const tokenAddress = 'FvgqHMfL9yn39V79huDPy3YUNDoYJpuLWng2JfmQpump';
            console.log('测试代币地址:', tokenAddress);

            const price = await priceLiquidityService.getTokenPrice(tokenAddress);
            console.log('获取到的价格:', price);

            expect(price).not.toBeNull();
            expect(typeof price).toBe('number');
            console.log('========== 测试完成 ==========\n');
        });
    });

    describe('getHoldingInfo', () => {
        it('should get holding info for a valid token', async () => {
            console.log('\n========== 测试获取持仓信息 ==========');
            // 使用 USDC 代币地址进行测试
            const tokenMint = new PublicKey('FvgqHMfL9yn39V79huDPy3YUNDoYJpuLWng2JfmQpump');
            console.log('测试代币地址:', tokenMint.toString());

            const holdings = await priceLiquidityService.getHoldingInfo(tokenMint);
            console.log('获取到的持仓数量:', holdings.holdings.length);

            expect(Array.isArray(holdings.holdings)).toBe(true);
            console.log('========== 测试完成 ==========\n');
        });
    });

    describe('getDetailedPriceInfo', () => {
        it('should get detailed price info for a valid token', async () => {
            console.log('\n========== 测试获取详细价格信息 ==========');
            // 使用 USDC 代币地址进行测试
            const tokenMint = 'FvgqHMfL9yn39V79huDPy3YUNDoYJpuLWng2JfmQpump';
            console.log('测试代币地址:', tokenMint);

            const priceInfo = await priceLiquidityService.getDetailedPriceInfo(tokenMint);
            console.log('获取到的价格信息:', priceInfo);

            expect(priceInfo).not.toBeNull();
            console.log('========== 测试完成 ==========\n');
        });
    });
});