import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import {
    Metaplex,
    findMetadataPda,
    token
} from '@metaplex-foundation/js';
import { TokenContract } from '../types/types';

export class TokenInfoService {
    private metaplex: Metaplex;

    constructor(private connection: Connection) {
        this.metaplex = Metaplex.make(connection);
    }

    async getTokenInfo(mintAddress: PublicKey): Promise<{
        name: string;
        symbol: string;
        contract: TokenContract;
    }> {
        try {
            // 获取代币基础信息
            const mintInfo = await getMint(this.connection, mintAddress);

            // 使用 Metaplex 获取元数据
            const metadata = await this.metaplex
                .nfts()
                .findByMint({ mintAddress });

            const contract: TokenContract = {
                hasMetadata: true,
                mintAuthority: mintInfo.mintAuthority?.toBase58() || undefined,
                freezeAuthority: mintInfo.freezeAuthority?.toBase58() || undefined,
                supply: Number(mintInfo.supply),
                decimals: mintInfo.decimals
            };

            return {
                name: metadata.name,
                symbol: metadata.symbol,
                contract
            };
        } catch (error) {
            console.error('获取代币信息失败:', error);
            throw error;
        }
    }
}