"""
微信小程序 - 桌游发牌助手后端
使用Flask提供RESTful API
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import random
import string
import os
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 数据库文件路径
DB_PATH = os.path.join(os.path.dirname(__file__), 'game.db')

def init_db():
    """初始化数据库"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 创建房间表
    c.execute('''CREATE TABLE IF NOT EXISTS rooms
                 (id TEXT PRIMARY KEY,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  max_players INTEGER DEFAULT 10,
                  status TEXT DEFAULT 'waiting')''')

    # 创建玩家表
    c.execute('''CREATE TABLE IF NOT EXISTS players
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  room_id TEXT,
                  player_number INTEGER,
                  nickname TEXT,
                  letter TEXT,
                  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (room_id) REFERENCES rooms(id))''')

    conn.commit()
    conn.close()

def generate_room_id():
    """生成6位房间ID"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@app.route('/api/room/create', methods=['POST'])
def create_room():
    """创建房间"""
    data = request.json
    max_players = data.get('max_players', 10)

    # 验证人数范围
    if max_players < 5 or max_players > 10:
        return jsonify({'error': '人数必须在5-10人之间'}), 400

    room_id = generate_room_id()

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 确保房间ID唯一
    while True:
        c.execute('SELECT id FROM rooms WHERE id = ?', (room_id,))
        if not c.fetchone():
            break
        room_id = generate_room_id()

    c.execute('INSERT INTO rooms (id, max_players) VALUES (?, ?)',
              (room_id, max_players))

    conn.commit()
    conn.close()

    return jsonify({
        'room_id': room_id,
        'max_players': max_players,
        'message': '房间创建成功'
    })

@app.route('/api/room/<room_id>/info', methods=['GET'])
def get_room_info(room_id):
    """获取房间信息"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute('SELECT id, max_players, status FROM rooms WHERE id = ?', (room_id,))
    room = c.fetchone()

    if not room:
        conn.close()
        return jsonify({'error': '房间不存在'}), 404

    # 获取房间内的玩家
    c.execute('''SELECT player_number, nickname, letter
                 FROM players
                 WHERE room_id = ?
                 ORDER BY player_number''', (room_id,))
    players = c.fetchall()

    conn.close()

    player_list = [
        {
            'player_number': p[0],
            'nickname': p[1] or f'玩家{p[0]}',
            'letter': p[2]
        }
        for p in players
    ]

    return jsonify({
        'room_id': room[0],
        'max_players': room[1],
        'status': room[2],
        'current_players': len(player_list),
        'players': player_list
    })

@app.route('/api/room/<room_id>/join', methods=['POST'])
def join_room(room_id):
    """加入房间"""
    data = request.json
    nickname = data.get('nickname', '')

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 检查房间是否存在
    c.execute('SELECT max_players, status FROM rooms WHERE id = ?', (room_id,))
    room = c.fetchone()

    if not room:
        conn.close()
        return jsonify({'error': '房间不存在'}), 404

    max_players, status = room

    # 检查房间是否已开始
    if status == 'started':
        conn.close()
        return jsonify({'error': '房间已开始游戏，无法加入'}), 400

    # 获取当前玩家数量
    c.execute('SELECT COUNT(*) FROM players WHERE room_id = ?', (room_id,))
    current_count = c.fetchone()[0]

    if current_count >= max_players:
        conn.close()
        return jsonify({'error': '房间已满'}), 400

    # 分配玩家编号
    player_number = current_count + 1

    # 插入玩家
    c.execute('''INSERT INTO players (room_id, player_number, nickname)
                 VALUES (?, ?, ?)''',
              (room_id, player_number, nickname))

    conn.commit()

    # 获取更新后的房间信息
    c.execute('SELECT COUNT(*) FROM players WHERE room_id = ?', (room_id,))
    new_count = c.fetchone()[0]

    conn.close()

    return jsonify({
        'player_number': player_number,
        'current_players': new_count,
        'max_players': max_players,
        'message': '加入房间成功'
    })

@app.route('/api/room/<room_id>/deal', methods=['POST'])
def deal_cards(room_id):
    """发牌 - 分配字母"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 检查房间是否存在
    c.execute('SELECT max_players, status FROM rooms WHERE id = ?', (room_id,))
    room = c.fetchone()

    if not room:
        conn.close()
        return jsonify({'error': '房间不存在'}), 404

    max_players, status = room

    # 获取房间内的玩家
    c.execute('SELECT player_number, nickname FROM players WHERE room_id = ? ORDER BY player_number', (room_id,))
    players = c.fetchall()

    if len(players) < 5:
        conn.close()
        return jsonify({'error': '至少需要5人才能发牌'}), 400

    if len(players) > max_players:
        conn.close()
        return jsonify({'error': '玩家数量超过房间上限'}), 400

    # 检查是否已经发过牌
    c.execute('SELECT COUNT(*) FROM players WHERE room_id = ? AND letter IS NOT NULL', (room_id,))
    if c.fetchone()[0] > 0:
        conn.close()
        return jsonify({'error': '已经发过牌了'}), 400

    # 生成字母列表（从A开始，根据人数递增）
    letters = [chr(ord('A') + i) for i in range(len(players))]
    random.shuffle(letters)  # 随机打乱

    # 分配字母给玩家
    for i, (player_number, nickname) in enumerate(players):
        c.execute('UPDATE players SET letter = ? WHERE room_id = ? AND player_number = ?',
                  (letters[i], room_id, player_number))

    # 更新房间状态
    c.execute('UPDATE rooms SET status = ? WHERE id = ?', ('started', room_id))

    conn.commit()

    # 获取分配结果
    c.execute('''SELECT player_number, nickname, letter
                 FROM players
                 WHERE room_id = ?
                 ORDER BY player_number''', (room_id,))
    result = c.fetchall()

    conn.close()

    player_list = [
        {
            'player_number': p[0],
            'nickname': p[1] or f'玩家{p[0]}',
            'letter': p[2]
        }
        for p in result
    ]

    return jsonify({
        'room_id': room_id,
        'players': player_list,
        'message': '发牌成功'
    })

@app.route('/api/room/<room_id>/reset', methods=['POST'])
def reset_room(room_id):
    """重置房间（清空玩家和字母）"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 删除所有玩家
    c.execute('DELETE FROM players WHERE room_id = ?', (room_id,))

    # 重置房间状态
    c.execute('UPDATE rooms SET status = ? WHERE id = ?', ('waiting', room_id))

    conn.commit()
    conn.close()

    return jsonify({'message': '房间已重置'})

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
