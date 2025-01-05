import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    outDir: 'dist',
    sourcemap: true,
    clean: true,
    format: ['esm'],
    external: [
        'dotenv',
        'fs',
        'path',
        '@reflink/reflink',
        '@node-llama-cpp',
        'https',
        'http',
        'agentkeepalive',
        'safe-buffer',
        'base-x',
        'bs58',
        'borsh',
        '@solana/buffer-layout',
        'stream',
        'buffer',
        'querystring',
        'amqplib',
        '@solana/web3.js',
        '@metaplex-foundation/js',
        '@metaplex-foundation/mpl-token-metadata'
    ]
});