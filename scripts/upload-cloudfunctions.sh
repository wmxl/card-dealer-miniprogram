#!/bin/bash

# 上传云函数脚本
# 使用方法：./scripts/upload-cloudfunctions.sh

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 云函数目录
CLOUDFUNCTIONS_DIR="miniprogram/cloudfunctions"

echo -e "${GREEN}开始上传云函数...${NC}"

# 检查是否在项目根目录
if [ ! -d "$CLOUDFUNCTIONS_DIR" ]; then
    echo -e "${RED}错误：请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 云函数列表
FUNCTIONS=("initDatabase" "createRoom" "getRoomInfo" "joinRoom" "dealCards" "resetRoom")

# 遍历上传每个云函数
for func in "${FUNCTIONS[@]}"; do
    if [ -d "$CLOUDFUNCTIONS_DIR/$func" ]; then
        echo -e "${YELLOW}上传云函数: $func${NC}"

        # 使用微信开发者工具 CLI 上传
        # 注意：需要先安装微信开发者工具，并且配置好路径
        # 如果使用 miniprogram-ci，需要先安装：npm install -g miniprogram-ci

        # 方法1：使用微信开发者工具 CLI（如果已安装）
        # /Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy --env cloud1-4gha1as13416048d --name $func --path $CLOUDFUNCTIONS_DIR/$func

        # 方法2：使用 miniprogram-ci（推荐）
        echo -e "${YELLOW}请使用以下命令上传云函数：${NC}"
        echo -e "cd $CLOUDFUNCTIONS_DIR/$func && npm install"
        echo -e "然后在微信开发者工具中右键上传，或使用 miniprogram-ci"
    else
        echo -e "${RED}警告：云函数目录不存在: $func${NC}"
    fi
done

echo -e "${GREEN}提示：由于微信云函数上传需要认证，建议使用以下方法之一：${NC}"
echo -e "${YELLOW}1. 使用微信开发者工具界面上传（最简单）${NC}"
echo -e "${YELLOW}2. 使用 miniprogram-ci 命令行工具（需要配置密钥）${NC}"
echo -e "${YELLOW}3. 使用微信开发者工具 CLI（需要配置路径）${NC}"
