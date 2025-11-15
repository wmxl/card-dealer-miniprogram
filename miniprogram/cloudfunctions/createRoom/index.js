// 云函数：创建房间
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { max_players } = event

  // 验证人数范围
  if (max_players < 2 || max_players > 12) {
    return {
      error: '人数必须在2-12人之间'
    }
  }

  // 生成4位数字房间ID
  const generateRoomId = () => {
    // 生成1000-9999之间的随机数字
    const min = 1000
    const max = 9999
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  let roomId = generateRoomId().toString()

  // 确保房间ID唯一
  let exists = true
  while (exists) {
    const result = await db.collection('rooms').where({
      _id: roomId
    }).get()

    if (result.data.length === 0) {
      exists = false
    } else {
      roomId = generateRoomId().toString()
    }
  }

  // 创建房间
  try {
    await db.collection('rooms').add({
      data: {
        _id: roomId,
        max_players: max_players,
        status: 'waiting',
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    })

    return {
      room_id: roomId,
      max_players: max_players,
      message: '房间创建成功'
    }
  } catch (error) {
    return {
      error: '创建房间失败',
      details: error.message
    }
  }
}
