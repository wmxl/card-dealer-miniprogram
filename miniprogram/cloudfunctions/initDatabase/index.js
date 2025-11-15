// 云函数：初始化数据库集合
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 检查并创建 rooms 集合
    try {
      await db.createCollection('rooms')
      console.log('rooms 集合创建成功')
    } catch (error) {
      if (error.errCode === -1) {
        console.log('rooms 集合已存在')
      } else {
        throw error
      }
    }

    // 检查并创建 players 集合
    try {
      await db.createCollection('players')
      console.log('players 集合创建成功')
    } catch (error) {
      if (error.errCode === -1) {
        console.log('players 集合已存在')
      } else {
        throw error
      }
    }

    return {
      success: true,
      message: '数据库集合初始化成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}
