import { Service, ServiceType, IAgentRuntime, stringToUuid } from '@ai16z/eliza';
import { SolanaMonitor } from './SolanaMonitor';
import { TimelineAnalyzer } from '../analyzers/TimelineAnalyzer';
import { TokenAnalyzer } from '../analyzers/TokenAnalyzer';
import { LLMService } from './LLMService';
import { Connection } from '@solana/web3.js';
import { EventEmitter } from 'events';
import TwitterClientInterface from '@ai16z/client-twitter';

interface TwitterClient {
  twitterClient: {
    sendTweet(content: string, inReplyTo?: string): Promise<Response>;
  };
  requestQueue: {
    add<T>(request: () => Promise<T>): Promise<T>;
  };
}

interface TwitterManager {
  client: TwitterClient;
  post: {
    client: TwitterClient;
  };
}

// 定义事件类型
interface TokenLaunchEvent {
  tokenAddress: string;
  tokenName?: string;
  creator?: string;
  launchTimestamp: number;
  createdAt?: number;
  transaction: string;
  analysis?: string;
  tweets?: string[];
}

export class MonitorService extends Service {
  private solanaMonitor: SolanaMonitor | null = null;
  private timelineAnalyzer: TimelineAnalyzer | null = null;
  private tokenAnalyzer: TokenAnalyzer | null = null;
  private llmService: LLMService | null = null;
  private connection: Connection | null = null;
  private eventEmitter: EventEmitter;
  private isInitialized = false;
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5秒
  private runtime: IAgentRuntime | null = null;
  private twitterClient: TwitterManager | null = null;
  private readonly MAX_TWEET_LENGTH = 280;
  private tokenQueue: Array<{
    tokenAddress: string;
    signature: string;
    timestamp: number;
    solAmount: number;
    tokenAmount: number;
  }> = [];
  private tweetCount = 0;
  private readonly HOURLY_TOKEN_LIMIT = 20;
  private readonly TWEETS_PER_TOKEN = 4;
  private readonly HOURLY_TWEET_LIMIT = this.HOURLY_TOKEN_LIMIT * this.TWEETS_PER_TOKEN;
  private isProcessing = false;
  private lastResetTime = Date.now();
  private isFirstRun = true;
  private readonly MIN_TOKEN_PRICE = 0.0001;

  constructor(twitterManagerOrRuntime?: TwitterManager | IAgentRuntime) {
    super();
    this.eventEmitter = new EventEmitter();
    if (twitterManagerOrRuntime && 'client' in twitterManagerOrRuntime) {
      this.twitterClient = twitterManagerOrRuntime;
    }
  }

  static get serviceType(): ServiceType {
    return ServiceType.TEXT_GENERATION;
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    try {
      this.runtime = runtime;

      // 避免重复初始化
      if (this.isInitialized) {
        console.log('服务已经初始化');
        return;
      }

      // 验证环境变量
      if (!process.env.HELIUS_RPC_URL || !process.env.HELIUS_WS_URL) {
        throw new Error('缺少 Helius RPC 配置');
      }

      if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error('缺少 DEEPSEEK_API_KEY 配置');
      }

      console.log('正在初始化连接...');
      try {
        // 初始化 Solana 连接
        this.connection = new Connection(process.env.HELIUS_RPC_URL, {
          commitment: 'confirmed',
          wsEndpoint: process.env.HELIUS_WS_URL
        });

        // 测试连接，设置超时
        await Promise.race([
          this.connection.getLatestBlockhash(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('连接超时')), 5000))
        ]);
      } catch (error) {
        console.error('Solana 连接失败:', error);
        throw new Error('无法连接到 Solana 网络');
      }

      // 初始化各个组件
      this.solanaMonitor = new SolanaMonitor(this.connection);
      this.timelineAnalyzer = new TimelineAnalyzer(this.connection);
      this.tokenAnalyzer = new TokenAnalyzer(this.connection);
      this.llmService = new LLMService();

      // 设置事件监听
      this.solanaMonitor.on('newToken', async (data) => {
        await this.handleNewToken(data);
      });

      // 初始化监控器
      console.log('正在初始化监控器...');
      await this.solanaMonitor.initialize();

      this.isInitialized = true;
      this.retryCount = 0;
      console.log('初始化完成');

    } catch (error) {
      console.error('初始化失败:', error);
      await this.handleConnectionError(error);
    }
  }

  private splitTweetContent(content: string): string[] {
    const paragraphs = content.split("\n\n").map(p => p.trim());
    const tweets: string[] = [];
    let currentTweet = "";

    for (const paragraph of paragraphs) {
      if (!paragraph) continue;

      if ((currentTweet + "\n\n" + paragraph).trim().length <= this.MAX_TWEET_LENGTH) {
        currentTweet = currentTweet ? currentTweet + "\n\n" + paragraph : paragraph;
      } else {
        if (currentTweet) {
          tweets.push(currentTweet.trim());
          currentTweet = paragraph;
        } else if (paragraph.length <= this.MAX_TWEET_LENGTH) {
          tweets.push(paragraph.trim());
        } else {
          // 如果单个段落超过长度限制，按句子分割
          const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
          let tweet = "";
          for (const sentence of sentences) {
            if ((tweet + sentence).length <= this.MAX_TWEET_LENGTH) {
              tweet += sentence;
            } else {
              if (tweet) tweets.push(tweet.trim());
              tweet = sentence;
            }
          }
          if (tweet) tweets.push(tweet.trim());
        }
      }
    }
    if (currentTweet) tweets.push(currentTweet.trim());
    return tweets;
  }

  private async sendTweets(tweets: string[]): Promise<void> {
    try {
      if (!this.twitterClient) {
        console.log('Twitter 客户端未初始化，跳过发送推文');
        return;
      }

      const roomId = stringToUuid('monitor-tweets-' + this.runtime!.agentId);
      let previousTweetId: string | undefined;

      for (const tweet of tweets) {
        // 将每条推文分割成可能的多条推文
        const tweetChunks = this.splitTweetContent(tweet);

        for (const chunk of tweetChunks) {
          try {
            // 使用 twitterClient.post 来发送推文
            const result = await this.twitterClient.client.requestQueue.add(
              async () => await this.twitterClient!.client.twitterClient.sendTweet(chunk.trim(), previousTweetId)
            );
            const body = await result.json();
            if (!body?.data?.create_tweet?.tweet_results?.result) {
              console.error('发送推文失败，响应无效:', body);
              continue;
            }
            const tweetResult = body.data.create_tweet.tweet_results.result;

            // 添加调试日志

            previousTweetId = tweetResult.rest_id;

            // 等待一小段时间再发送下一条，避免触发限制
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log('推文发送成功:', chunk.slice(0, 50) + '...');
          } catch (error) {
            console.error('发送推文失败:', error);
            // 继续发送下一条推文
            continue;
          }
        }
      }
      console.log('所有推文发送完成');
    } catch (error) {
      console.error('发送推文过程中发生错误:', error);
    }
  }

  private async handleNewToken(data: {
    tokenAddress: string;
    signature: string;
    timestamp: number;
    solAmount: number;
    tokenAmount: number;
  }) {
    try {
      console.log('\n=== 监测到新代币 ===');
      console.log('代币地址:', data.tokenAddress);
      console.log('交易签名:', data.signature);
      console.log('时间戳:', new Date(data.timestamp).toLocaleString());

      // 如果是首次运行，直接处理代币
      if (this.isFirstRun) {
        await this.processToken(data);
        this.tweetCount += this.TWEETS_PER_TOKEN;
      } else {
        // 否则将代币添加到队列
        this.tokenQueue.push(data);
        // 如果没有在处理队列，开始处理
        if (!this.isProcessing) {
          this.processQueue();
        }
      }
    } catch (error) {
      console.error('处理新代币事件失败:', error);
      const basicEvent: TokenLaunchEvent = {
        tokenAddress: data.tokenAddress,
        launchTimestamp: data.timestamp,
        transaction: data.signature
      };
      this.eventEmitter.emit('tokenLaunched', basicEvent);
    }
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.isFirstRun = false;

    try {
      while (true) {
        // 检查是否需要重置计数器
        const now = Date.now();
        if (now - this.lastResetTime >= 3600000) { // 1小时
          this.tweetCount = 0;
          this.lastResetTime = now;
          console.log('重置每小时推文计数器');
        }

        // 检查是否达到小时限制
        if (this.tweetCount >= this.HOURLY_TWEET_LIMIT) {
          console.log('达到每小时限制，等待下一个小时...');
          await this.waitUntilNextHour();
          continue;
        }

        // 获取队列中的下一个代币
        const tokenData = this.tokenQueue.shift();
        if (!tokenData) {
          console.log('队列为空，等待新代币...');
          break;
        }

        // 检查代币价格
        const tokenPrice = await this.tokenAnalyzer!.getTokenPrice(tokenData.tokenAddress);
        console.log('代币价格:', tokenPrice ? `$${tokenPrice}` : '未知');

        if (!tokenPrice || tokenPrice < this.MIN_TOKEN_PRICE) {
          console.log(`代币价格 ($${tokenPrice}) 低于最小阈值 ($${this.MIN_TOKEN_PRICE})，跳过处理`);
          continue;
        }

        // 处理代币
        await this.processToken(tokenData);
        this.tweetCount += this.TWEETS_PER_TOKEN;

        console.log(`当前小时已处理 ${this.tweetCount / this.TWEETS_PER_TOKEN}/${this.HOURLY_TOKEN_LIMIT} 个代币`);
      }
    } catch (error) {
      console.error('处理队列时发生错误:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async waitUntilNextHour() {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const waitTime = nextHour.getTime() - now.getTime();
    console.log(`等待 ${Math.floor(waitTime / 1000 / 60)} 分钟到下一个小时...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    this.tweetCount = 0;
    this.lastResetTime = Date.now();
  }

  private async processToken(data: {
    tokenAddress: string;
    signature: string;
    timestamp: number;
    solAmount: number;
    tokenAmount: number;
  }) {
    try {
      console.log('\n=== 开始处理代币 ===');
      console.log('代币地址:', data.tokenAddress);

      // 收集时间线数据
      const timelineData = await this.timelineAnalyzer!.collectData(
        data.tokenAddress,
        data.timestamp
      );

      // 分析代币持仓
      const tokenAnalysis = await this.tokenAnalyzer!.analyzeToken(
        data.tokenAddress,
        timelineData.creator
      );

      // AI 风险分析
      const tokenInfo = {
        tokenAddress: data.tokenAddress,
        tokenName: timelineData.tokenName,
        creator: timelineData.creator,
        createdAt: timelineData.createdAt,
        launchedAt: data.timestamp,
        creatorTokens: timelineData.creatorTokens,
        creatorWalletAge: timelineData.creatorWalletAge,
        creatorHolding: tokenAnalysis.creatorHolding
      };

      const riskAnalysis = await this.llmService!.analyzeTokenRisk(tokenInfo);
      const tweets = riskAnalysis.split('\n\n');
      await this.sendTweets(tweets);

      // 发出完整的代币发布事件
      const event: TokenLaunchEvent = {
        tokenAddress: data.tokenAddress,
        tokenName: timelineData.tokenName,
        creator: timelineData.creator,
        launchTimestamp: data.timestamp,
        createdAt: timelineData.createdAt,
        transaction: data.signature,
        analysis: riskAnalysis,
        tweets
      };

      this.eventEmitter.emit('tokenLaunched', event);
      console.log('=== 代币处理完成 ===\n');
    } catch (error) {
      console.error('处理代币时发生错误:', error);
    }
  }

  protected getRuntime(): IAgentRuntime | null {
    return this.runtime;
  }

  private async handleConnectionError(error: any): Promise<void> {
    console.error('连接错误:', error);

    if (this.retryCount < this.MAX_RETRIES) {
      this.retryCount++;
      console.log(`尝试重新连接... (${this.retryCount}/${this.MAX_RETRIES})`);

      const delay = this.RETRY_DELAY * Math.pow(2, this.retryCount - 1);
      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        if (this.runtime) {
          await this.initialize(this.runtime);
        } else {
          throw new Error('Runtime 未初始化');
        }
      } catch (retryError) {
        if (this.retryCount === this.MAX_RETRIES) {
          console.error('达到最大重试次数，停止重试');
          // 清理资源
          await this.destroy();
          throw retryError;
        }
        // 如果还没到最大重试次数，继续重试
        await this.handleConnectionError(retryError);
      }
    } else {
      console.error('达到最大重试次数，停止重试');
      // 清理资源
      await this.destroy();
      throw error;
    }
  }

  async destroy(): Promise<void> {
    try {
      // 先移除所有事件监听器
      this.eventEmitter.removeAllListeners();

      // 清理 Solana Monitor
      if (this.solanaMonitor) {
        await this.solanaMonitor.destroy();
        this.solanaMonitor = null;
      }

      // 清理其他组件
      this.timelineAnalyzer = null;
      this.tokenAnalyzer = null;
      this.llmService = null;

      // 清理连接
      if (this.connection) {
        try {
          // 等待所有挂起的请求完成
          await new Promise(resolve => setTimeout(resolve, 1000));
          // 将连接设为 null 会自动触发垃圾回收，关闭相关的 WebSocket 连接
          this.connection = null;
        } catch (error) {
          console.log('清理连接时出错:', error);
        }
      }

      // 清理 Twitter 客户端
      if (this.twitterClient) {
        try {
          await TwitterClientInterface.stop(this.runtime!);
          this.twitterClient = null;
        } catch (error) {
          console.log('清理 Twitter 客户端时出错:', error);
        }
      }

      this.isInitialized = false;
      this.retryCount = 0;
      console.log('服务已清理');
    } catch (error) {
      console.error('清理服务失败:', error);
      // 即使清理失败，也要重置状态
      this.isInitialized = false;
      this.retryCount = 0;
      throw error;
    }
  }

  // 添加事件监听方法
  on(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.on(event, listener);
  }

  // 移除事件监听方法
  off(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.off(event, listener);
  }

  // 获取服务状态
  getStatus(): {
    isInitialized: boolean;
    retryCount: number;
    hasConnection: boolean;
    hasMonitor: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      retryCount: this.retryCount,
      hasConnection: this.connection !== null,
      hasMonitor: this.solanaMonitor !== null
    };
  }

  // 添加获取分析器的方法
  getTokenAnalyzer(): TokenAnalyzer | null {
    return this.tokenAnalyzer;
  }

  getTimelineAnalyzer(): TimelineAnalyzer | null {
    return this.timelineAnalyzer;
  }

  getLLMService(): LLMService | null {
    return this.llmService;
  }
}