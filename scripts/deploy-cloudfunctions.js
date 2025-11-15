/**
 * 使用 miniprogram-ci 批量上传云函数
 *
 * 使用方法：
 * 1. 安装：npm install -g miniprogram-ci
 * 2. 在微信公众平台下载密钥文件，保存为 private.key
 * 3. 运行：node scripts/deploy-cloudfunctions.js
 */

const ci = require('miniprogram-ci')
const path = require('path')
const fs = require('fs')

// 配置信息
const appid = 'wx221e1314bb265acd'
const envId = 'cloud1-4gha1as13416048d'
const privateKeyPath = path.join(__dirname, '../private.key')
const projectPath = path.join(__dirname, '../miniprogram')

// 云函数列表
const cloudFunctions = [
  'initDatabase',
  'createRoom',
  'getRoomInfo',
  'joinRoom',
  'dealCards',
  'resetRoom'
]

async function deployCloudFunctions() {
  try {
    // 检查密钥文件是否存在
    if (!fs.existsSync(privateKeyPath)) {
      console.error('❌ 错误：找不到密钥文件 private.key')
      console.log('请按照以下步骤获取密钥：')
      console.log('1. 访问 https://mp.weixin.qq.com/')
      console.log('2. 进入 开发 -> 开发管理 -> 开发设置')
      console.log('3. 找到"小程序代码上传密钥"，点击生成并下载')
      console.log('4. 将密钥文件保存为项目根目录的 private.key')
      process.exit(1)
    }

    // 读取密钥
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8')

    // 初始化项目
    const project = new ci.Project({
      appid,
      type: 'miniProgram',
      projectPath,
      privateKey,
      ignores: ['node_modules/**/*']
    })

    console.log('🚀 开始上传云函数...\n')

    // 上传每个云函数
    for (const funcName of cloudFunctions) {
      const funcPath = path.join(projectPath, 'cloudfunctions', funcName)

      if (!fs.existsSync(funcPath)) {
        console.log(`⏭️  跳过：云函数 ${funcName} 不存在`)
        continue
      }

      console.log(`📦 上传云函数: ${funcName}`)

      try {
        await ci.cloud.uploadFunction({
          project,
          env: envId,
          name: funcName,
          path: funcPath,
          remoteNpmInstall: true
        })

        console.log(`✅ ${funcName} 上传成功\n`)
      } catch (error) {
        console.error(`❌ ${funcName} 上传失败:`, error.message)
        console.log('')
      }
    }

    console.log('✨ 所有云函数上传完成！')
    console.log('\n📝 下一步：')
    console.log('1. 在云开发控制台运行 initDatabase 云函数创建数据库集合')
    console.log('2. 或者手动在控制台创建 rooms 和 players 集合')
  } catch (error) {
    console.error('❌ 上传失败:', error.message)
    if (error.message.includes('privateKey')) {
      console.log('\n提示：请检查 private.key 文件是否正确')
    }
    process.exit(1)
  }
}

// 检查是否安装了 miniprogram-ci
try {
  require.resolve('miniprogram-ci')
  deployCloudFunctions()
} catch (error) {
  console.error('❌ 错误：未安装 miniprogram-ci')
  console.log('\n请先安装：')
  console.log('npm install -g miniprogram-ci')
  console.log('\n或者使用微信开发者工具界面上传云函数')
  process.exit(1)
}
