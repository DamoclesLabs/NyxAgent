import { Connection } from '@solana/web3.js';
import { SolanaMonitor } from '../src/services/SolanaMonitor';
import { TimelineAnalyzer } from '../src/analyzers/TimelineAnalyzer';
import { TokenAnalyzer } from '../src/analyzers/TokenAnalyzer';
import { LLMService } from '../src/services/LLMService';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

describe('SolanaMonitor', () => {
  let monitor: SolanaMonitor | undefined;
  let timelineAnalyzer: TimelineAnalyzer;
  let tokenAnalyzer: TokenAnalyzer;
  let llmService: LLMService;
  let connection: Connection;
  let isTestRunning = false;

  // 在所有测试开始前
  beforeAll(() => {
    // 确保没有遗留的测试实例
    if (monitor) {
      monitor.destroy();
      monitor = undefined;
    }
  });

  // 在所有测试结束后
  afterAll(async () => {
    // 清理所有资源
    if (monitor) {
      await monitor.destroy();
      monitor = undefined;
    }
    isTestRunning = false;
  });

  beforeEach(async () => {
    // 如果已经有测试在运行，跳过
    if (isTestRunning) {
      console.log('已有测试实例在运行，跳过初始化...');
      return;
    }

    try {
      isTestRunning = true;

      // 验证环境变量
      if (!process.env.HELIUS_RPC_URL || !process.env.HELIUS_WS_URL) {
        throw new Error('Missing Helius configuration in environment variables');
      }

      if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error('Missing DEEPSEEK_API_KEY in environment variables');
      }

      console.log('正在初始化连接...');
      // 使用真实的 Helius RPC 连接
      connection = new Connection(process.env.HELIUS_RPC_URL, {
        commitment: 'confirmed',
        wsEndpoint: process.env.HELIUS_WS_URL
      });

      monitor = new SolanaMonitor(connection);
      timelineAnalyzer = new TimelineAnalyzer(connection);
      tokenAnalyzer = new TokenAnalyzer(connection);
      llmService = new LLMService();

      // 初始化监控器
      console.log('正在初始化监控器...');
      await monitor.initialize();
      console.log('初始化完成');
    } catch (error) {
      console.error('初始化失败:', error);
      isTestRunning = false;
      throw error;
    }
  }, 30000);

  afterEach(async () => {
    // 只有当前测试实例在运行时才清理
    if (monitor && isTestRunning) {
      await monitor.destroy();
      monitor = undefined;
      isTestRunning = false;
      console.log('测试实例已清理');
    }
  }, 30000);

  it('should monitor and analyze token launches in real environment', async () => {
    // 如果已经有测试在运行，跳过
    if (!monitor || !isTestRunning) {
      console.log('跳过测试...');
      return;
    }

    console.log('\n=== 开始监控代币发布 ===');
    console.log('正在监听地址:', process.env.TARGET_ADDRESS);

    // 创建一个 Promise 来等待事件触发
    const eventPromise = new Promise((resolve) => {
      monitor!.on('newToken', async (data) => {
        console.log('\n=== 监测到新代币 ===');
        console.log('代币地址:', data.tokenAddress);
        console.log('交易签名:', data.signature);
        console.log('时间戳:', new Date(data.timestamp).toLocaleString());
        console.log('SOL 数量:', data.solAmount);
        console.log('代币数量:', data.tokenAmount);

        try {
          // 收集并分析时间线数据
          console.log('\n=== 开始分析时间线数据 ===');
          const timelineData = await timelineAnalyzer.collectData(
            data.tokenAddress,
            data.timestamp
          );

          // 打印分析结果
          console.log('\n=== 时间线分析结果 ===');
          console.log('代币地址:', timelineData.tokenAddress);
          console.log('创建者:', timelineData.creator);
          console.log('创建时间:', new Date(timelineData.createdAt).toLocaleString());
          console.log('发布时间:', new Date(timelineData.launchedAt).toLocaleString());

          // 分析代币持仓情况
          console.log('\n=== 开始分析代币持仓 ===');
          const tokenAnalysis = await tokenAnalyzer.analyzeToken(
            data.tokenAddress,
            timelineData.creator
          );

          if (tokenAnalysis.creatorHolding) {
            console.log('\n创建者持仓情况:');
            console.log('持仓数量:', tokenAnalysis.creatorHolding.balance.toLocaleString());
            if (tokenAnalysis.creatorHolding.balanceUSD) {
              console.log('持仓价值: $', tokenAnalysis.creatorHolding.balanceUSD.toLocaleString());
            }
          } else {
            console.log('\n创建者未持有该代币');
          }

          if (timelineData.creatorTokens && timelineData.creatorTokens.length > 0) {
            console.log('\n创建者历史代币:');
            timelineData.creatorTokens.forEach((token, index) => {
              console.log(`\n代币 ${index + 1}:`);
              console.log('地址:', token.tokenAddress);
              console.log('名称:', token.name || '未知');
              console.log('创建时间:', new Date(token.timestamp).toLocaleString());
              console.log('当前价格:', token.price ? `$${token.price}` : '未知');
              console.log('供应量:', token.supply ? token.supply.toLocaleString() : '未知');
              console.log('市值:', token.marketCap ? `$${token.marketCap.toLocaleString()}` : '未知');
            });
          } else {
            console.log('\n未找到创建者历史代币记录');
          }

          // 使用 LLMService 进行风险分析
          console.log('\n=== 开始 AI 风险分析 ===');
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

          const riskAnalysis = await llmService.analyzeTokenRisk(tokenInfo);
          console.log('\nAI 风险分析结果:');
          console.log(riskAnalysis);

          resolve(data);
        } catch (error) {
          console.error('分析失败:', error);
          resolve(data); // 即使分析失败也继续测试
        }
      });
    });

    // 等待5分钟或直到收到事件
    console.log('\n等待新代币发布事件（最多5分钟）...');
    try {
      await Promise.race([
        eventPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('超时：未在5分钟内检测到新代币')), 300000))
      ]);
    } finally {
      // 确保测试结束后清理资源
      if (monitor) {
        await monitor.destroy();
        monitor = undefined;
        isTestRunning = false;
        console.log('测试完成，资源已清理');
      }
    }
  }, 360000); // 测试超时时间设置为6分钟
});
