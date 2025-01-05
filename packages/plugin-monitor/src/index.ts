import { Plugin, IAgentRuntime } from "@ai16z/eliza";
import { MonitorService } from "./services/MonitorService";

// 导出所有服务
export * from "./services/MonitorService";
export * from "./services/SolanaMonitor";
export * from "./services/LLMService";
export * from "./analyzers/TokenAnalyzer";
export * from "./analyzers/TimelineAnalyzer";
export * from "./analyzers/types";

// 创建插件函数
export function createMonitorPlugin() {
    return {
        name: "monitor",
        description: "Plugin for monitoring Solana token launches and risk analysis",
        services: [
            new MonitorService(),
        ],
        actions: []
    } as const satisfies Plugin;
}