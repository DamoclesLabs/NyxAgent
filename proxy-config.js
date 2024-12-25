const { SocksProxyAgent } = require('socks-proxy-agent');

// 创建 socks5 代理配置
const proxyUrl = 'socks5://127.0.0.1:10808';
const agent = new SocksProxyAgent(proxyUrl, {
    timeout: 5000,
    keepAlive: true
});

// 导出代理配置
module.exports = {
    httpAgent: agent,
    httpsAgent: agent
};