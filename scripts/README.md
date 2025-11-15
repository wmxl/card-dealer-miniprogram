# 自动化脚本说明

## 数据库初始化

### 方法1：通过云函数自动创建（推荐）

1. 上传并部署 `initDatabase` 云函数
2. 在微信开发者工具中：
   - 点击 **云开发** -> **云开发控制台** -> **云函数**
   - 找到 `initDatabase` 函数
   - 点击 **测试** 按钮
   - 运行测试，会自动创建 `rooms` 和 `players` 集合

### 方法2：通过代码创建

在云函数中调用：
```javascript
const db = cloud.database()
await db.createCollection('rooms')
await db.createCollection('players')
```

## 云函数上传

### 方法1：使用微信开发者工具界面（最简单，推荐）

1. 右键点击云函数文件夹
2. 选择 **上传并部署：云端安装依赖（不上传node_modules）**

### 方法2：使用 miniprogram-ci（命令行，需要配置）

1. **安装 miniprogram-ci**：
```bash
npm install -g miniprogram-ci
```

2. **配置密钥**：
   - 在微信公众平台 -> 开发 -> 开发管理 -> 开发设置
   - 找到 **小程序代码上传密钥**
   - 点击 **生成** 并下载密钥文件（通常是 `.key` 文件）
   - 将密钥文件保存为项目根目录的 `private.key`

3. **使用脚本上传**：
```bash
node scripts/deploy-cloudfunctions.js
```

脚本会自动上传所有云函数到配置的云环境。

### 方法3：使用微信开发者工具 CLI

如果安装了微信开发者工具，可以使用 CLI：

**Mac 系统**：
```bash
# 上传单个云函数
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy \
  --env cloud1-7gdxiqxud6591054 \
  --name createRoom \
  --path miniprogram/cloudfunctions/createRoom

# 批量上传
for func in initDatabase createRoom getRoomInfo joinRoom dealCards resetRoom; do
  /Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy \
    --env cloud1-7gdxiqxud6591054 \
    --name $func \
    --path miniprogram/cloudfunctions/$func
done
```

**Windows 系统**：
```bash
# 找到微信开发者工具安装路径，通常在：
# C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat

cli.bat cloud functions deploy \
  --env cloud1-7gdxiqxud6591054 \
  --name createRoom \
  --path miniprogram/cloudfunctions/createRoom
```

## 批量上传脚本

### deploy-cloudfunctions.js

使用 `miniprogram-ci` 批量上传所有云函数的脚本。

**使用方法**：
```bash
node scripts/deploy-cloudfunctions.js
```

**前提条件**：
- 已安装 `miniprogram-ci`：`npm install -g miniprogram-ci`
- 已配置密钥文件 `private.key` 在项目根目录
- 已更新脚本中的 AppID 和云环境ID

### upload-cloudfunctions.sh

Shell 脚本，提供批量上传的提示信息。

**使用方法**：
```bash
chmod +x scripts/upload-cloudfunctions.sh
./scripts/upload-cloudfunctions.sh
```

## 推荐方案

**最简单的方式**（推荐）：
1. 使用云函数 `initDatabase` 自动创建数据库集合（只需上传一次）
2. 云函数上传使用微信开发者工具界面（最稳定可靠）

**自动化程度最高**：
1. 使用 `miniprogram-ci` 命令行工具上传云函数
2. 使用 `initDatabase` 云函数创建数据库集合

## 注意事项

1. **数据库集合创建**：微信云开发限制，首次创建集合通常需要在控制台操作，或通过云函数创建
2. **云函数上传**：需要认证，命令行方式需要配置密钥
3. **环境ID**：确保所有操作都使用正确的云环境ID：`cloud1-7gdxiqxud6591054`
4. **AppID**：确保使用正确的 AppID：`wx09d2a83f6d890b4c`
