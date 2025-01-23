import axios, { AxiosError } from 'axios';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

interface ChatCompletionRequest {
  messages: Message[];
  model: string;
  frequency_penalty?: number;
  max_tokens?: number;
  temperature?: number;
  timeout?: number;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface TokenInfo {
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
  creatorHolding?: {
    balance: number;
    balanceUSD?: number;
  };
}

export class LLMService {
  private readonly apiKey: string;
  private readonly apiEndpoint: string;
  private readonly model: string;
  private readonly timeout: number = 30000; // 30秒超时
  private readonly maxRetries: number = 3;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.apiEndpoint = 'https://api.deepseek.com/chat/completions';
    this.model = 'deepseek-chat';

    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is not set');
    }
  }

  private generateAnalysisPrompt(tokenInfo: TokenInfo): string {
    const creationDate = new Date(tokenInfo.createdAt).toLocaleString();
    const launchDate = new Date(tokenInfo.launchedAt).toLocaleString();
    const timeDiff = (tokenInfo.launchedAt - tokenInfo.createdAt) / (1000 * 60 * 60); // Convert to hours

    // Calculate wallet age
    const walletAgeInHours = tokenInfo.creatorWalletAge?.createdAt
      ? (Date.now() - tokenInfo.creatorWalletAge.createdAt) / (1000 * 60 * 60)
      : 0;

    let prompt = `Analyze the risk of tokens on the PumpFun platform and generate a detailed analysis suitable for Twitter threads:

Please generate a 4-tweet thread in the following format:

🚨 Token Monitor Alert (1/4)
Token Name: $${tokenInfo.tokenName}
Contract Address:

 ${tokenInfo.tokenAddress}

Creation Time: ${creationDate}
Raydium Launch: ${launchDate}
Time Difference: ${timeDiff.toFixed(2)} hours

👨‍💻 Creator Information (2/4)
Address: ${tokenInfo.creator}
Wallet Status: ${tokenInfo.creatorWalletAge?.isNewWallet
  ? `New Wallet (<24h)`
  : `Mature Wallet (${walletAgeInHours.toFixed(1)} hours)`}
Current Holdings: ${tokenInfo.creatorHolding?.balance || 0} tokens
${tokenInfo.creatorHolding?.balanceUSD ? `≈ $${tokenInfo.creatorHolding.balanceUSD}` : ''}

📜 Creator History Record (3/4)`;

    if (tokenInfo.creatorTokens && tokenInfo.creatorTokens.length > 0) {
      prompt += `\nHistorical Tokens: ${tokenInfo.creatorTokens.length}\n`;
      const successfulTokens = tokenInfo.creatorTokens.filter(t => (t.marketCap || 0) > 100000).length;
      prompt += `Success Cases: ${successfulTokens} (Market Cap >$100k)\n\nHistorical Token List:`;

      // Sort by time in descending order, show all tokens
      const sortedTokens = [...tokenInfo.creatorTokens]
        .sort((a, b) => b.timestamp - a.timestamp);

      sortedTokens.forEach((token, index) => {
        prompt += `\n${index + 1}. ${token.name || 'Unknown'}
   Address: ${token.tokenAddress}
   Created: ${new Date(token.timestamp).toLocaleString()}
   Market Cap: ${token.marketCap ? `$${token.marketCap.toLocaleString()}` : 'Unknown'}
   Price: ${token.price ? `$${token.price}` : 'Unknown'}`;
      });
    } else {
      prompt += '\nNo historical token records';
    }

    prompt += `

💡 Nyx Risk Analysis (4/4)
Please analyze based on the following factors:
1. Fast creation is normal in Solana ecosystem
2. New wallets need extra attention but don't always indicate risk
3. Low holdings is a positive signal (can't dump)
4. Focus on historical token performance and success cases
5. Comprehensive assessment of risks and opportunities

Please provide:
- Risk Level Assessment (High/Medium/Low)
- Key Risk Points Analysis
- Investment Recommendations
- Special Attention Points

Note:
- Each tweet must be within 280 characters
- Use concise professional language
- Provide specific data support
- Highlight important information
- Third tweet should show all historical token information`;

    return prompt;
  }

  private async handleAxiosError(error: AxiosError): Promise<never> {
    if (error.response) {
      // Server returned error response
      console.error('API Response Error:', {
        status: error.response.status,
        data: error.response.data
      });
      throw new Error(`DeepSeek API Response Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // Request was made but no response received
      console.error('No API Response:', error.request);
      throw new Error('DeepSeek API No Response');
    } else {
      // Request configuration error
      console.error('Request Configuration Error:', error.message);
      throw new Error(`Request Configuration Error: ${error.message}`);
    }
  }

  async analyzeTokenRisk(tokenInfo: TokenInfo): Promise<string> {
    try {
      console.log('Starting to generate analysis prompt...');
      const prompt = this.generateAnalysisPrompt(tokenInfo);

      console.log('Starting AI analysis...');
      const analysis = await this.retry(
        () => this.analyze(prompt),
        this.maxRetries,
        1000,
        'Token Risk Analysis'
      );

      console.log('AI analysis completed');
      return analysis;
    } catch (error) {
      console.error('Token risk analysis failed:', error);
      if (error instanceof Error) {
        return `Analysis failed: ${error.message}. Please try again later.`;
      }
      return 'Analysis failed: Unknown error occurred. Please try again later.';
    }
  }

  async analyze(prompt: string): Promise<string> {
    try {
      console.log('Preparing to send API request...');

      const messages: Message[] = [
        {
          role: 'system',
          content: 'You are Nyx, a professional Solana ecosystem analyst, focusing on token risk analysis on the PumpFun platform. Your analysis style: 1) Direct and clear 2) Data-driven 3) Emphasis on key points 4) Professional and objective. Remember: Fast creation is normal, new wallets need caution but are not always risky, low holdings are positive as they prevent dumping, focus on historical success cases. Each response must be complete with no unfinished sentences.'
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const request: ChatCompletionRequest = {
        messages,
        model: this.model,
        max_tokens: 2000,
        frequency_penalty: 0.5,
        temperature: 0.7,
        timeout: this.timeout
      };

      console.log('Sending API request...');
      const response = await axios.post<ChatCompletionResponse>(
        this.apiEndpoint,
        request,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout,
          validateStatus: (status) => status === 200
        }
      );

      console.log('Received API response');
      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response format');
      }

      let content = response.data.choices[0].message.content.trim();

      // Validate response completeness
      if (content.length < 10) {
        throw new Error('API response content too short');
      }

      // Split into individual tweets
      const tweets = content.split(/\n(?=🚨|👨‍💻|📜|💡)/g);

      // Validate tweet completeness
      if (tweets.length !== 4) {
        throw new Error(`Incomplete response: Expected 4 tweets, received ${tweets.length}`);
      }

      // Add emoji symbols
      const emojis = {
        'risk': '⚠️',
        'new wallet': '👤',
        'mature wallet': '👨‍💼',
        'holdings': '💰',
        'time': '⏰',
        'success': '✅',
        'failure': '❌',
        'warning': '🚨',
        'analysis': '🔍',
        'market': '📊',
        'recommendation': '💡',
        'bullish': '📈',
        'bearish': '📉',
        'attention': '⚡',
        'history': '📜',
        'creator': '👨‍💻',
        'liquidity': '💧',
        'trading': '💱',
        'monitor': '🎯',
        'alert': '🔔',
        'rating': '📊',
        'high risk': '🔴',
        'medium risk': '🟡',
        'low risk': '🟢',
        'investment': '💵',
        'price': '💲',
        'supply': '📦',
        'opportunity': '🎯'
      };

      // Process each tweet
      const processedTweets = tweets.map((tweet, index) => {
        // Add emoji symbols
        let processedTweet = tweet.trim();
        Object.entries(emojis).forEach(([key, emoji]) => {
          processedTweet = processedTweet.replace(new RegExp(key, 'g'), `${key}${emoji}`);
        });

        // Ensure each tweet has the correct number
        processedTweet = processedTweet.replace(/\((\d+)\/(\d+)\)/g, `(${index + 1}/4)`);

        return processedTweet;
      });

      // Combine all tweets
      return processedTweets.join('\n\n');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return this.handleAxiosError(error);
      }
      if (error instanceof Error) {
        console.error('API Call Error:', error);
        throw new Error(`API Call Failed: ${error.message}`);
      }
      console.error('API Call Unknown Error');
      throw new Error('API Call Unknown Error');
    }
  }

  async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    operationName: string = 'Operation'
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Attempting ${operationName} (${i + 1}/${maxRetries})...`);
        const result = await operation();
        console.log(`${operationName} Successful`);
        return result;
      } catch (error) {
        console.error(`${operationName} Failed (Attempt ${i + 1}/${maxRetries}):`, error);

        if (i === maxRetries - 1) {
          console.error(`${operationName} Failed After ${maxRetries} Attempts`);
          throw error;
        }

        const retryDelay = delay * Math.pow(2, i);
        console.log(`Waiting ${retryDelay}ms before retrying...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    throw new Error(`${operationName} Failed After ${maxRetries} Attempts`);
  }
}