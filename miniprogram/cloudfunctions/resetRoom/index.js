// 云函数：重置房间
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { room_id } = event

  try {
    // 检查房间是否存在
    const roomResult = await db.collection('rooms').doc(room_id).get()

    if (!roomResult.data) {
      return {
        error: '房间不存在'
      }
    }

    // 删除所有玩家
    const playersResult = await db.collection('players')
      .where({
        room_id: room_id
      })
      .get()

    const deletePromises = playersResult.data.map(player => {
      return db.collection('players').doc(player._id).remove()
    })

    await Promise.all(deletePromises)

    // 重置房间状态
    await db.collection('rooms').doc(room_id).update({
      data: {
        status: 'waiting',
        updated_at: db.serverDate()
      }
    })

    return {
      message: '房间已重置'
    }
  } catch (error) {
    return {
      error: '重置房间失败',
      details: error.message
    }
  }
}
