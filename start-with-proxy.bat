@echo off
REM 设置代理环境变量
set HTTP_PROXY=socks5://127.0.0.1:10808
set HTTPS_PROXY=socks5://127.0.0.1:10808

REM 启动Eliza
pnpm start --characters="characters/web3-security-expert.character.json"

REM 脚本结束后暂停，以便查看输出
pause