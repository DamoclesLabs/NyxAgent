export interface RiskPattern {
    id: string;
    category: 'CREATOR' | 'PRICE' | 'HOLDING' | 'CONTRACT' | 'MARKET' | 'LIQUIDITY' | 'SOCIAL' | 'TECHNICAL';
    pattern: string;
    description: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    indicators: string[];
    mitigations: string[];
}

export const TOKEN_RISK_PATTERNS: RiskPattern[] = [
    // 创建者风险模式
    {
        id: 'CREATOR-001',
        category: 'CREATOR',
        pattern: '多个失败项目',
        description: '创建者有多个价值大幅下跌或被放弃的代币项目历史',
        riskLevel: 'HIGH',
        indicators: [
            '多个代币价格下跌超过90%',
            '代币生命周期短（小于3个月）',
            '社交媒体账号被弃用',
            '项目团队成员频繁更换'
        ],
        mitigations: [
            '验证创建者公开身份',
            '研究之前项目详情',
            '检查社区反馈',
            '审查团队背景和履历'
        ]
    },
    {
        id: 'CREATOR-002',
        category: 'CREATOR',
        pattern: '匿名团队',
        description: '项目团队完全匿名或身份信息不透明',
        riskLevel: 'HIGH',
        indicators: [
            '缺乏可验证的团队信息',
            '使用假名或化名',
            '无法在主流平台验证身份',
            '团队成员社交媒体账号新建'
        ],
        mitigations: [
            '要求团队进行身份认证',
            '检查团队历史贡献',
            '寻找可信机构背书',
            '验证团队专业背景'
        ]
    },

    // 合约风险模式
    {
        id: 'CONTRACT-001',
        category: 'CONTRACT',
        pattern: '合约安全隐患',
        description: '智能合约代码存在潜在安全漏洞',
        riskLevel: 'HIGH',
        indicators: [
            '未经审计的合约代码',
            '关键函数缺乏访问控制',
            '使用已知的危险函数',
            '合约可升级但无时间锁'
        ],
        mitigations: [
            '进行专业安全审计',
            '检查合约权限设置',
            '审查合约升级机制',
            '验证时间锁和多签机制'
        ]
    },
    {
        id: 'CONTRACT-002',
        category: 'CONTRACT',
        pattern: '可疑权限设置',
        description: '合约所有者拥有过度权限或可疑功能',
        riskLevel: 'HIGH',
        indicators: [
            '所有者可直接修改关键参数',
            '缺乏多签机制',
            '可暂停转账功能',
            '可直接铸造或销毁代币'
        ],
        mitigations: [
            '实施多签钱包管理',
            '添加时间锁机制',
            '限制所有者权限',
            '建立社区治理机制'
        ]
    },

    // 市场风险模式
    {
        id: 'MARKET-001',
        category: 'MARKET',
        pattern: '市场操纵迹象',
        description: '存在明显的市场操纵或价格控制行为',
        riskLevel: 'HIGH',
        indicators: [
            '大量机器人交易',
            '交易对手集中',
            '反常的买卖盘口分布',
            '与其他代币高度相关的价格走势'
        ],
        mitigations: [
            '分析交易机器人活动',
            '监控大额交易流向',
            '追踪关联钱包行为',
            '评估市场深度变化'
        ]
    },
    {
        id: 'MARKET-002',
        category: 'MARKET',
        pattern: '流动性风险',
        description: '代币流动性不足或高度集中',
        riskLevel: 'HIGH',
        indicators: [
            'DEX流动性池规模过小',
            '单一交易对占比过高',
            '流动性提供者过于集中',
            '流动性锁定期限过短'
        ],
        mitigations: [
            '分散流动性来源',
            '增加流动性锁定期',
            '引入更多做市商',
            '建立流动性激励机制'
        ]
    },

    // 持仓风险模式
    {
        id: 'HOLDING-001',
        category: 'HOLDING',
        pattern: '持仓高度集中',
        description: '代币持仓集中在少数钱包地址',
        riskLevel: 'HIGH',
        indicators: [
            '前5大持仓占比超过50%',
            '独立持有者数量少',
            '非DEX钱包持有大量代币',
            '大户地址相互关联'
        ],
        mitigations: [
            '监控大户钱包动向',
            '检查代币解锁计划',
            '分析持仓分布趋势',
            '追踪关联地址转移'
        ]
    },
    {
        id: 'HOLDING-002',
        category: 'HOLDING',
        pattern: '代币分配不合理',
        description: '代币分配方案存在明显偏向或不合理性',
        riskLevel: 'MEDIUM',
        indicators: [
            '团队持仓比例过高',
            '解锁期过短',
            '早期投资者获取成本过低',
            '公募比例过小'
        ],
        mitigations: [
            '审查代币经济模型',
            '评估解锁时间表',
            '分析代币分配公平性',
            '检查投资者成本结构'
        ]
    },

    // 价格风险模式
    {
        id: 'PRICE-001',
        category: 'PRICE',
        pattern: '异常价格走势',
        description: '代币价格显示可疑模式或操纵迹象',
        riskLevel: 'HIGH',
        indicators: [
            '无重大消息的突然价格暴涨',
            '低交易量下的价格上涨',
            '协同买卖模式',
            '价格与市场趋势严重背离'
        ],
        mitigations: [
            '对比市场整体趋势',
            '分析交易量变化',
            '检查与主流代币的价格相关性',
            '监控异常交易模式'
        ]
    },
    {
        id: 'PRICE-002',
        category: 'PRICE',
        pattern: '价格操纵漏洞',
        description: '合约或交易机制存在价格操纵漏洞',
        riskLevel: 'HIGH',
        indicators: [
            '预言机实现不安全',
            '缺乏价格操纵防护',
            '闪电贷攻击风险',
            'MEV套利风险'
        ],
        mitigations: [
            '使用去中心化预言机',
            '实施价格操纵防护',
            '增加交易滑点限制',
            '防范闪电贷攻击'
        ]
    },

    // 技术风险模式
    {
        id: 'TECHNICAL-001',
        category: 'TECHNICAL',
        pattern: '技术实现缺陷',
        description: '代币技术实现存在重大缺陷或安全隐患',
        riskLevel: 'HIGH',
        indicators: [
            '使用过时的合约标准',
            '关键功能实现有误',
            '缺乏必要的安全检查',
            '合约代码未优化'
        ],
        mitigations: [
            '升级到最新合约标准',
            '完善安全检查机制',
            '优化合约代码',
            '进行全面技术审计'
        ]
    },
    {
        id: 'TECHNICAL-002',
        category: 'TECHNICAL',
        pattern: '基础设施风险',
        description: '项目基础设施或依赖组件存在风险',
        riskLevel: 'MEDIUM',
        indicators: [
            '依赖集中化服务',
            '使用不安全的RPC节点',
            '合约依赖过多外部调用',
            '缺乏故障恢复机制'
        ],
        mitigations: [
            '使用去中心化基础设施',
            '部署私有RPC节点',
            '减少外部依赖',
            '建立应急响应机制'
        ]
    },

    // 社区风险模式
    {
        id: 'SOCIAL-001',
        category: 'SOCIAL',
        pattern: '社区异常',
        description: '项目社区表现出异常或不健康的特征',
        riskLevel: 'MEDIUM',
        indicators: [
            '社区成员虚假或机器人',
            '过度营销和炒作',
            '缺乏实质性讨论',
            '社区参与度突然下降'
        ],
        mitigations: [
            '分析社区成员真实性',
            '评估社区讨论质量',
            '监控社区活跃度',
            '建立健康的社区文化'
        ]
    },
    {
        id: 'SOCIAL-002',
        category: 'SOCIAL',
        pattern: '治理风险',
        description: '项目治理机制存在重大缺陷',
        riskLevel: 'MEDIUM',
        indicators: [
            '中心化决策机制',
            '治理提案通过率异常',
            '社区投票参与度低',
            '关键决策缺乏透明度'
        ],
        mitigations: [
            '完善治理机制',
            '提高决策透明度',
            '鼓励社区参与',
            '建立有效的提案机制'
        ]
    }
];