import { Plugin } from '@ai16z/eliza';
import analyzeTokenSecurity from './actions/analyzeTokenSecurity';

const securityPlugin: Plugin = {
    name: '@ai16z/plugin-security',
    description: '代币安全分析插件',
    actions: [analyzeTokenSecurity],
    evaluators: [],
    providers: []
};

export default securityPlugin;