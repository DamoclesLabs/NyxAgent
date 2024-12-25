import axios from 'axios';

export class DeepseekAPI {
    private readonly baseUrl = 'https://api.deepseek.com/v1/chat/completions';
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000; // 1秒

    constructor(private apiKey: string) {}

    async analyze(prompt: string): Promise<string> {
        let lastError;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`尝试调用 Deepseek API (第 ${attempt}/${this.maxRetries} 次)`);

                const response = await axios.post(
                    this.baseUrl,
                    {
                        model: 'deepseek-chat',
                        messages: [
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        temperature: 0.7
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.apiKey}`
                        },
                        timeout: 30000 // 30秒超时
                    }
                );

                if (response.data && response.data.choices && response.data.choices[0]) {
                    return response.data.choices[0].message.content;
                }

                throw new Error('无效的API响应格式');
            } catch (error) {
                lastError = error;
                console.error(`API调用失败 (尝试 ${attempt}/${this.maxRetries}):`, error.message);

                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    console.log(`等待 ${delay/1000} 秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // 如果所有重试都失败，返回一个默认的保守分析
        console.error('所有 API 调用尝试都失败，返回默认分析');
        return JSON.stringify({
            "代币分析": {
                "风险等级": "高",
                "风险因素": ["API调用失败，无法进行准确分析", "建议等待系统恢复后再次评估"],
                "积极因素": [],
                "流动性评估": "由于分析失败，建议谨慎评估流动性",
                "持仓评估": "无法获取完整评估，建议进一步观察"
            },
            "创建者分析": {
                "信用等级": "高",
                "项目成功率": "暂时无法评估",
                "风险行为": ["无法完成完整分析"],
                "历史表现": "需要系统恢复后重新评估"
            },
            "整体风险等级": "高",
            "投资建议": "由于无法完成完整分析，建议暂时观望，等待系统恢复后重新评估"
        });
    }
}