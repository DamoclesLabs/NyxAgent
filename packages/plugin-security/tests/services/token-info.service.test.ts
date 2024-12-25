import { Connection, PublicKey } from '@solana/web3.js';
import { TokenInfoService } from '../../src/services/token-info.service';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

describe('TokenInfoService', () => {
    let tokenInfoService: TokenInfoService;
    let connection: Connection;

    beforeAll(() => {
        if (!process.env.SOLANA_RPC_URL) {
            throw new Error('SOLANA_RPC_URL environment variable is not set');
        }
        console.log('使用 RPC:', process.env.SOLANA_RPC_URL);
        connection = new Connection(process.env.SOLANA_RPC_URL);
        tokenInfoService = new TokenInfoService(connection);
    });

    it('should get USDC token info', async () => {
        console.log('\n测试 USDC 代币信息获取...');
        // USDC token mint address
        const usdcMint = new PublicKey('Gn9k4RCU5kqeyJNkbb8CZHm3pcWpMtNn5SnkuCnjpump');
        console.log(' Mint 地址:', usdcMint.toString());

        const tokenInfo = await tokenInfoService.getTokenInfo(usdcMint);
        console.log('获取到的  信息:', {
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            decimals: tokenInfo.contract.decimals,
            supply: tokenInfo.contract.supply.toString(),
            mintAuthority: tokenInfo.contract.mintAuthority,
            freezeAuthority: tokenInfo.contract.freezeAuthority,
            hasMetadata: tokenInfo.contract.hasMetadata
        });

    }, 30000);

    it('should get BONK token info', async () => {
        console.log('\n测试 BONK 代币信息获取...');
        // BONK token mint address
        const bonkMint = new PublicKey('2xPUtcrcqsCzS6TF4Q9kW78C2cdKWG2zTd6UYJk6pump');
        console.log(' Mint 地址:', bonkMint.toString());

        const tokenInfo = await tokenInfoService.getTokenInfo(bonkMint);
        console.log('获取到的  信息:', {
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            decimals: tokenInfo.contract.decimals,
            supply: tokenInfo.contract.supply.toString(),
            mintAuthority: tokenInfo.contract.mintAuthority,
            freezeAuthority: tokenInfo.contract.freezeAuthority,
            hasMetadata: tokenInfo.contract.hasMetadata
        });

    }, 30000);

});