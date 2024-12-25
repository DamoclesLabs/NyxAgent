module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFiles: ['dotenv/config'],
    testTimeout: 30000,
    verbose: true,
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.json'
            }
        ]
    },
    transformIgnorePatterns: [
        'node_modules/(?!(@solana|@metaplex-foundation)/)'
    ]
};