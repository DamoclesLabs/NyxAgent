export interface PumpFunTokenInfo {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  created_timestamp: number;
  raydium_pool: string;
  total_supply: number;
  market_cap: number;
  usd_market_cap: number;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  bonding_curve: string;
  complete: boolean;
  is_currently_live: boolean;
}

export interface TokenAnalysis {
  tokenAddress: string;
  creatorHistory: {
    address: string;
    createdTokens: number;
    reputationScore: number;
  };
  tokenPrice: {
    currentPrice: number;
    priceChange: number;
    solReserves: number;
    tokenReserves: number;
  };
  holderDistribution: {
    totalHolders: number;
    topHoldersPercentage: number;
  };
  tokenTimeline: {
    createdAt: number;
    launchedAt: number;
    timeDifference: number;
  };
  orderVolume: {
    buyVolume: number;
    sellVolume: number;
    ratio: number;
  };
  tokenPermissions: {
    mintable: boolean;
    freezable: boolean;
    hasAuthority: boolean;
  };
}

export interface TokenInfo {
  tokenName: string;
  tokenAddress: string;
  createdAt: number;
  launchTime?: number;
  timeDifference?: number;
  creator: string;
  creatorWalletAge?: {
    createdAt: number;
    isNewWallet: boolean;
    ageInHours: number;
  };
  creatorHolding?: {
    balance: number;
    balanceUSD?: number;
  };
  creatorTokens?: Array<{
    name: string;
    tokenAddress: string;
    timestamp: number;
    marketCap?: number;
    price?: number;
  }>;
  successfulTokens?: number;
}