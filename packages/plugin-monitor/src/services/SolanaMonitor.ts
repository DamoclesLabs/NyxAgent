import { Connection, PublicKey } from '@solana/web3.js';
import { EventEmitter } from 'events';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

export class SolanaMonitor {
  private connection: Connection;
  private subscriptionId: number | null = null;
  private eventEmitter: EventEmitter;
  private readonly TARGET_ADDRESS = process.env.TARGET_ADDRESS || '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg';
  private retryCount = 0;
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY = 5000; // 5秒
  private isReconnecting = false;

  constructor(connection: Connection) {
    this.connection = connection;
    this.eventEmitter = new EventEmitter();
  }

  async initialize() {
    await this.setupWebsocketConnection();
  }

  private async handleConnectionError(error: any) {
    if (this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;

    // 检查错误类型
    if (error.code === 429) {
      console.log('Rate limit exceeded, waiting longer before retry...');
      await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * 2));
    } else if (error.code === 503) {
      console.log('Service unavailable, waiting before retry...');
      await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
    }

    if (this.retryCount < this.MAX_RETRIES) {
      this.retryCount++;
      console.log(`Attempting to reconnect... (Attempt ${this.retryCount}/${this.MAX_RETRIES})`);

      // 指数退避重试
      const delay = this.RETRY_DELAY * Math.pow(2, this.retryCount - 1);
      await new Promise(resolve => setTimeout(resolve, delay));

      this.isReconnecting = false;
      await this.setupWebsocketConnection();
    } else {
      this.isReconnecting = false;
      console.error('Max retry attempts reached. Please check your API limits and connection.');
      throw new Error('Failed to establish connection after multiple attempts');
    }
  }

  private async setupWebsocketConnection() {
    try {
      // 如果已有订阅，先清理
      if (this.subscriptionId !== null) {
        await this.connection.removeOnLogsListener(this.subscriptionId);
      }

      // 订阅目标地址的日志
      this.subscriptionId = await this.connection.onLogs(
        new PublicKey(this.TARGET_ADDRESS),
        (logs) => {
          this.handleWebsocketMessage(logs);
        },
        'confirmed'
      );

      console.log(`Successfully subscribed to logs with ID: ${this.subscriptionId}`);
      this.retryCount = 0; // 重置重试计数
    } catch (error) {
      console.error('Error setting up WebSocket connection:', error);
      await this.handleConnectionError(error);
    }
  }

  private async parseTransaction(signature: string): Promise<string | null> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1秒

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const tx = await this.connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        if (!tx) {
          console.log('Transaction not found');
          return null;
        }

        // 获取所有账户地址
        const accountKeys = tx.transaction.message.getAccountKeys().keySegments().flat();

        // 在 Raydium 的初始化流动性池交易中，代币地址通常是第18个账户
        const tokenAddress = accountKeys[18]?.toString();
        if (tokenAddress) {
          console.log('Found token address:', tokenAddress);
          return tokenAddress;
        }

        return null;
      } catch (error) {
        console.error(`Error parsing transaction (attempt ${attempt + 1}/${maxRetries}):`, error);

        if (attempt === maxRetries - 1) {
          // 最后一次尝试失败
          throw error;
        }

        // 指数退避延迟
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return null;
  }

  private async handleWebsocketMessage(logs: any) {
    try {
      const signature = logs.signature;
      console.log('Transaction signature:', signature);

      // 检查是否是初始化流动性池操作
      const isPoolOperation = logs.logs.some((log: string) =>
        log.includes('initialize2: InitializeInstruction2')
      );

      if (!isPoolOperation) {
        return;
      }

      // 使用 Promise.all 并行处理多个事件
      Promise.all([
        this.processTransaction(signature, logs)
      ]).catch(error => {
        console.error('Error processing transaction:', error);
      });

    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  private async processTransaction(signature: string, logs: any) {
    try {
      // 从交易中获取代币地址
      const tokenAddress = await this.parseTransaction(signature);
      if (!tokenAddress) {
        console.log('Could not find token address in transaction');
        return;
      }

      // 提取初始化参数
      const initLog = logs.logs.find((log: string) =>
        log.includes('initialize2: InitializeInstruction2')
      );

      let solAmount = 0;
      let tokenAmount = 0;

      // 发出新代币事件
      this.eventEmitter.emit('newToken', {
        tokenAddress,
        signature,
        timestamp: Date.now(),
        solAmount,
        tokenAmount
      });
    } catch (error) {
      console.error('Error processing transaction:', error);
    }
  }

  async destroy() {
    try {
      if (this.subscriptionId !== null) {
        await this.connection.removeOnLogsListener(this.subscriptionId);
        this.subscriptionId = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // 添加事件监听方法
  on(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.on(event, listener);
  }
}