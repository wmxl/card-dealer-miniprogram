/**
 * 初始化数据库集合脚本
 * 使用方法：在微信开发者工具中运行此脚本，或通过云函数调用
 *
 * 注意：由于微信云开发的限制，数据库集合的创建通常需要在控制台操作
 * 或者通过云函数 initDatabase 来创建
 */

// 这个脚本需要在微信开发者工具的控制台中运行
// 或者创建一个云函数来执行

console.log(`
数据库初始化说明：

方法1：通过云函数初始化（推荐）
1. 上传并部署 initDatabase 云函数
2. 在云开发控制台 -> 云函数 -> initDatabase -> 测试
3. 运行测试，会自动创建 rooms 和 players 集合

方法2：通过控制台手动创建
1. 打开云开发控制台
2. 选择数据库
3. 点击 + 创建集合
4. 创建 rooms 和 players 两个集合

方法3：通过代码创建（需要在云函数中执行）
const db = cloud.database()
await db.createCollection('rooms')
await db.createCollection('players')
`)
