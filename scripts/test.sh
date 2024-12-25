#!/bin/bash

# 设置错误时退出
set -e

# 检查参数
if [ $# -eq 0 ]; then
    echo "请指定要测试的文件路径"
    exit 1
fi

# 获取测试文件路径
TEST_FILE=$1

# 检查文件是否存在
if [ ! -f "$TEST_FILE" ]; then
    echo "测试文件不存在: $TEST_FILE"
    exit 1
fi

# 运行指定的测试文件
echo "运行测试: $TEST_FILE"
jest "$TEST_FILE" --detectOpenHandles --forceExit