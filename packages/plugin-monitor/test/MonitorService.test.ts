import { MonitorService } from '../src/services/MonitorService';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

describe('MonitorService', () => {
  let service: MonitorService;
  let isTestRunning = false;

  beforeAll(() => {
    // 确保环境变量存在
    if (!process.env.HELIUS_RPC_URL || !process.env.HELIUS_WS_URL) {
      throw new Error('缺少 Helius RPC 配置');
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('缺少 DEEPSEEK_API_KEY 配置');
    }
  });

  beforeEach(async () => {
    // 如果已经有测试在运行，跳过
    if (isTestRunning) {
      console.log('已有测试实例在运行，跳过初始化...');
      return;
    }

    try {
      isTestRunning = true;
      service = new MonitorService();
    } catch (error) {
      console.error('初始化失败:', error);
      isTestRunning = false;
      throw error;
    }
  });

  afterEach(async () => {
    if (service && isTestRunning) {
      await service.destroy();
      isTestRunning = false;
      console.log('测试实例已清理');
    }
  });

  it('should initialize successfully', async () => {
    // 如果已经有测试在运行，跳过
    if (!isTestRunning) {
      console.log('跳过测试...');
      return;
    }

    await service.initialize();
    const status = service.getStatus();

    expect(status.isInitialized).toBe(true);
    expect(status.hasConnection).toBe(true);
    expect(status.hasMonitor).toBe(true);
    expect(status.retryCount).toBe(0);
  }, 30000);

  it('should handle token launch events', async () => {
    // 如果已经有测试在运行，跳过
    if (!isTestRunning) {
      console.log('跳过测试...');
      return;
    }

    await service.initialize();

    // 创建一个 Promise 来等待事件触发
    const eventPromise = new Promise((resolve) => {
      service.on('tokenLaunched', (event) => {
        expect(event).toHaveProperty('tokenAddress');
        expect(event).toHaveProperty('launchTimestamp');
        expect(event).toHaveProperty('transaction');
        resolve(event);
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
      await service.destroy();
      isTestRunning = false;
    }
  }, 360000);

  it('should handle connection errors and retry', async () => {
    // 如果已经有测试在运行，跳过
    if (!isTestRunning) {
      console.log('跳过测试...');
      return;
    }

    // 临时修改环境变量以触发错误
    const originalRpcUrl = process.env.HELIUS_RPC_URL;
    const originalWsUrl = process.env.HELIUS_WS_URL;
    process.env.HELIUS_RPC_URL = 'https://invalid-url.example.com';
    process.env.HELIUS_WS_URL = 'wss://invalid-url.example.com';

    try {
      await Promise.race([
        service.initialize(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('连接超时')), 5000))
      ]);
      // 如果初始化成功了，这是不对的
      throw new Error('应该失败但成功了');
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.message).toMatch(/连接超时|无法连接到 Solana 网络/);
      const status = service.getStatus();
      expect(status.retryCount).toBeGreaterThan(0);
    } finally {
      // 恢复环境变量
      process.env.HELIUS_RPC_URL = originalRpcUrl;
      process.env.HELIUS_WS_URL = originalWsUrl;
      await service.destroy();
      // 等待连接完全关闭
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }, 15000);

  it('should clean up resources on destroy', async () => {
    // 如果已经有测试在运行，跳过
    if (!isTestRunning) {
      console.log('跳过测试...');
      return;
    }

    try {
      // 先初始化一个有效的连接
      await service.initialize();

      // 确保初始化成功
      let status = service.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.hasConnection).toBe(true);
      expect(status.hasMonitor).toBe(true);

      // 执行清理
      await service.destroy();
      // 等待连接完全关闭
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 验证清理结果
      status = service.getStatus();
      expect(status.isInitialized).toBe(false);
      expect(status.hasConnection).toBe(false);
      expect(status.hasMonitor).toBe(false);
      expect(status.retryCount).toBe(0);
    } catch (error) {
      console.error('测试失败:', error);
      throw error;
    }
  }, 15000);

  it('should handle event listeners correctly', async () => {
    // 如果已经有测试在运行，跳过
    if (!isTestRunning) {
      console.log('跳过测试...');
      return;
    }

    let eventCount = 0;
    const listener = () => {
      eventCount++;
    };

    service.on('tokenLaunched', listener);

    // 手动触发事件
    service['eventEmitter'].emit('tokenLaunched', {
      tokenAddress: 'test-address',
      launchTimestamp: Date.now(),
      transaction: 'test-signature'
    });

    expect(eventCount).toBe(1);

    // 移除监听器
    service.off('tokenLaunched', listener);

    // 再次触发事件
    service['eventEmitter'].emit('tokenLaunched', {
      tokenAddress: 'test-address-2',
      launchTimestamp: Date.now(),
      transaction: 'test-signature-2'
    });

    expect(eventCount).toBe(1);
  });
});