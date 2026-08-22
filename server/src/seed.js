/**
 * 演示数据种子（吐槽同事：用户 / 同事档案 / 公司档案 / 同事状态 / 小程序）
 * 运行：npm run seed  或 首次启动时 AUTO_SEED=true 自动填充
 * 所有演示账号密码均为：123456
 */
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'
import { config } from './config.js'
import { initDb } from './db.js'
import { SQLITE_DDL, MYSQL_DDL } from './schema.js'

const now = () => new Date().toISOString()
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString()

const PASSWORD = '123456'

export const DEMO_USERS = [
  { username: 'aqing', nickname: '阿青', avatarSymbol: 'face.smiling', bio: '互联网运营 · 爱吐槽也爱摸鱼', locationLabel: '海淀 · 中关村', distanceKm: null, creditScore: 82, verification: 'full', isExposureVip: false },
  { username: 'linxiao', nickname: '林晓', avatarSymbol: 'camera.fill', bio: '产品汪一只 · 需求改到崩溃', locationLabel: '朝阳 · 国贸', distanceKm: 3.2, creditScore: 90, verification: 'full', isExposureVip: true },
  { username: 'chenmo', nickname: '陈默', avatarSymbol: 'book.fill', bio: '后端工程师 · CR 狂魔', locationLabel: '朝阳 · 798', distanceKm: 12.0, creditScore: 78, verification: 'student', isExposureVip: false },
  { username: 'suqing', nickname: '苏晴', avatarSymbol: 'paintbrush.fill', bio: '设计狮 · 改稿第 18 版', locationLabel: '海淀 · 中关村', distanceKm: 6.5, creditScore: 85, verification: 'realname', isExposureVip: false },
  { username: 'wangye', nickname: '王野', avatarSymbol: 'film.fill', bio: '测试 · 专治各种不服', locationLabel: '西城 · 天桥', distanceKm: 8.0, creditScore: 88, verification: 'realname', isExposureVip: false },
  { username: 'zhouke', nickname: '周可', avatarSymbol: 'guitars.fill', bio: '前端 · 永远在等接口', locationLabel: '海淀 · 五道口', distanceKm: 1.5, creditScore: 92, verification: 'full', isExposureVip: false },
  { username: 'gaoyuan', nickname: '高远', avatarSymbol: 'camera.aperture', bio: '销售 · KPI 压顶', locationLabel: '东城 · 东四', distanceKm: 15.0, creditScore: 75, verification: 'none', isExposureVip: false },
  { username: 'hanxue', nickname: '韩雪', avatarSymbol: 'chevron.left.forwardslash.chevron.right', bio: 'HR · 招聘 JD 写得天花乱坠', locationLabel: '海淀 · 西二旗', distanceKm: 5.8, creditScore: 76, verification: 'realname', isExposureVip: false },
  { username: 'baiyifan', nickname: '白一凡', avatarSymbol: 'pencil.and.outline', bio: '实习生 · 端茶倒水取快递', locationLabel: '海淀 · 清华园', distanceKm: 4.0, creditScore: 84, verification: 'student', isExposureVip: false },
  { username: 'mili', nickname: '米粒', avatarSymbol: 'music.note', bio: '运营 · 周报文学大师', locationLabel: '朝阳 · 三里屯', distanceKm: 8.2, creditScore: 88, verification: 'full', isExposureVip: true },
  { username: 'azhe', nickname: '阿哲', avatarSymbol: 'laptopcomputer', bio: '运维 · 半夜被报警叫醒', locationLabel: '丰台 · 科技园', distanceKm: 20.0, creditScore: 70, verification: 'none', isExposureVip: false }
]

export async function seed(db, { force = false } = {}) {
  const count = db.get('SELECT COUNT(*) AS c FROM users').c
  if (count > 0 && !force) {
    console.log('[seed] 已有数据，跳过（--force 可重建）')
    return false
  }
  if (force) {
    db.exec(`
      DELETE FROM messages; DELETE FROM conversations; DELETE FROM colleague_statuses;
      DELETE FROM colleagues; DELETE FROM companies; DELETE FROM users;
      DELETE FROM sqlite_sequence WHERE name IN ('users','companies','colleagues','colleague_statuses','conversations','messages');
    `)
  }

  const hash = await bcrypt.hash(PASSWORD, 10)
  const userIds = {}
  for (const u of DEMO_USERS) {
    const r = db.run(
      `INSERT INTO users (username, password_hash, nickname, avatar_symbol, bio, location_label, distance_km, credit_score, verification, is_exposure_vip, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [u.username, hash, u.nickname, u.avatarSymbol, u.bio, u.locationLabel,
        u.distanceKm, u.creditScore, u.verification, u.isExposureVip ? 1 : 0, now()]
    )
    userIds[u.username] = r.lastInsertRowid
  }

  // 示例小程序：贪吃蛇游戏（单文件自包含 HTML，符合小程序格式规范）
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const snakeHtml = readFileSync(join(__dirname, 'snake-app.html'), 'utf8')
    const existing = db.get('SELECT id FROM apps WHERE name = ?', ['贪吃蛇'])
    if (!existing) {
      db.run(
        `INSERT INTO apps (user_id, name, description, icon, html_content, version, size_kb, downloads, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [userIds['aqing'], '贪吃蛇', '经典街机贪吃蛇：方向键/滑动控制，吃食物成长，速度随长度提升。示例小程序。',
          '🐍', snakeHtml, '1.0.0', Math.ceil(Buffer.byteLength(snakeHtml, 'utf8') / 1024), 0, now()]
      )
    }
  } catch (e) {
    console.warn('[seed] 示例小程序插入失败:', e.message)
  }

  // 演示会话与消息
  const linXiao = userIds['linxiao']
  const zhouKe = userIds['zhouke']
  const miLi = userIds['mili']
  const me = userIds['aqing']
  const c1 = db.run(`INSERT INTO conversations (user_a, user_b, last_message_text, last_time, unread_a, unread_b) VALUES (?,?,?,?,?,?)`,
    [me, linXiao, '好的，周六见！', daysAgo(0.04), 0, 1])
  db.run(`INSERT INTO messages (conversation_id, sender_id, text, is_system_note, created_at) VALUES (?,?,?,?,?)`, [c1.lastInsertRowid, linXiao, '在吗？这周的需求评审又改了三版 😮‍💨', 0, daysAgo(2)])
  db.run(`INSERT INTO messages (conversation_id, sender_id, text, is_system_note, created_at) VALUES (?,?,?,?,?)`, [c1.lastInsertRowid, me, '太懂了，我的周报都写不下了', 0, daysAgo(1.99)])
  db.run(`INSERT INTO messages (conversation_id, sender_id, text, is_system_note, created_at) VALUES (?,?,?,?,?)`, [c1.lastInsertRowid, linXiao, '周六出来喝杯咖啡吐槽一下？', 0, daysAgo(1)])
  db.run(`INSERT INTO messages (conversation_id, sender_id, text, is_system_note, created_at) VALUES (?,?,?,?,?)`, [c1.lastInsertRowid, linXiao, '⚠️ 该消息含违禁词：价格，已被平台风控拦截。本平台仅支持合规内容交流。', 1, daysAgo(0.99)])
  db.run(`INSERT INTO messages (conversation_id, sender_id, text, is_system_note, created_at) VALUES (?,?,?,?,?)`, [c1.lastInsertRowid, linXiao, '好的，周六见！', 0, daysAgo(0.04)])
  const c2 = db.run(`INSERT INTO conversations (user_a, user_b, last_message_text, last_time, unread_a, unread_b) VALUES (?,?,?,?,?,?)`,
    [me, zhouKe, '成交！本周三开始？', daysAgo(2), 0, 0])
  db.run(`INSERT INTO messages (conversation_id, sender_id, text, is_system_note, created_at) VALUES (?,?,?,?,?)`, [c2.lastInsertRowid, zhouKe, '接口什么时候能给我？我页面都写好了', 0, daysAgo(4)])
  db.run(`INSERT INTO messages (conversation_id, sender_id, text, is_system_note, created_at) VALUES (?,?,?,?,?)`, [c2.lastInsertRowid, me, '成交！本周三开始？', 0, daysAgo(2)])
  const c3 = db.run(`INSERT INTO conversations (user_a, user_b, last_message_text, last_time, unread_a, unread_b) VALUES (?,?,?,?,?,?)`,
    [me, miLi, '周末晚上有空吗？', daysAgo(0.08), 0, 2])
  db.run(`INSERT INTO messages (conversation_id, sender_id, text, is_system_note, created_at) VALUES (?,?,?,?,?)`, [c3.lastInsertRowid, miLi, '周报帮我润色一下呗，老板说不够有文采', 0, daysAgo(1)])
  db.run(`INSERT INTO messages (conversation_id, sender_id, text, is_system_note, created_at) VALUES (?,?,?,?,?)`, [c3.lastInsertRowid, me, '可以！先发我看看', 0, daysAgo(0.99)])
  db.run(`INSERT INTO messages (conversation_id, sender_id, text, is_system_note, created_at) VALUES (?,?,?,?,?)`, [c3.lastInsertRowid, miLi, '周末晚上有空吗？', 0, daysAgo(0.08)])

  console.log(`[seed] 完成：${DEMO_USERS.length} 个演示用户（密码均为 123456）`)
  return true
}

// ── CLI 入口：npm run seed [--force] ──
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = await initDb()
  db.exec(config.dbDriver === 'mysql' ? MYSQL_DDL : SQLITE_DDL)
  await seed(db, { force: process.argv.includes('--force') })
}

/**
 * 确保示例小程序存在（每次启动检查补齐，幂等）：
 * 预置「贪吃蛇」游戏小程序，作为小程序市场的格式示例
 */
export function ensureSampleApps(db) {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const snakeHtml = readFileSync(join(__dirname, 'snake-app.html'), 'utf8')
    const existing = db.get('SELECT id FROM apps WHERE name = ?', ['贪吃蛇'])
    if (existing) return 0
    const owner = db.get('SELECT id FROM users WHERE username = ?', ['aqing'])
    if (!owner) return 0
    db.run(
      `INSERT INTO apps (user_id, name, description, icon, html_content, version, size_kb, downloads, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [owner.id, '贪吃蛇', '经典街机贪吃蛇：方向键/滑动控制，吃食物成长，速度随长度提升。示例小程序。',
        '🐍', snakeHtml, '1.0.0', Math.ceil(Buffer.byteLength(snakeHtml, 'utf8') / 1024), 0, new Date().toISOString()]
    )
    console.log('[seed] 已预置示例小程序：贪吃蛇')
    return 1
  } catch (e) {
    console.warn('[seed] 示例小程序插入失败:', e.message)
    return 0
  }
}

/**
 * 确保同事 / 公司 / 状态示例数据存在（幂等）：
 * 仅当首个演示用户「aqing」尚无公司档案时，补齐一公司、一同事、两条状态。
 */
export function ensureSampleDomainData(db) {
  try {
    const owner = db.get('SELECT id FROM users WHERE username = ?', ['aqing'])
    if (!owner) return 0
    const companyCount = db.get('SELECT COUNT(*) AS c FROM companies WHERE user_id = ?', [owner.id]).c
    if (companyCount > 0) return 0

    const c = db.run(
      `INSERT INTO companies (user_id, name, industry, scale, overtime_culture, welfare, location, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [owner.id, '宇宙无限科技有限公司', '互联网', '2000人 / 大厂', '大小周', '六险一金', '北京 · 海淀', now()]
    )
    const companyId = c.lastInsertRowid

    const col = db.run(
      `INSERT INTO colleagues (user_id, name, position, department, relation, attribute_tags, company_id, notes, avatar_symbol, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [owner.id, '王总', '部门总监', '研发部', '上级', JSON.stringify(['甩锅倾向', '画饼', '执行力']), companyId,
        '周会必画饼，季度 OKR 永远完不成但锅永远是你的。', '👔', now()]
    )
    const colleagueId = col.lastInsertRowid

    db.run(
      `INSERT INTO colleague_statuses (user_id, colleague_id, content, theme_tags, software_tags, mood, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [owner.id, colleagueId, '今天又是被王总拉去开没有结论的会的一天，PPT 改了第八版。',
        JSON.stringify(['开会', '画饼']), JSON.stringify(['钉钉', 'PPT']), '😮‍💨', daysAgo(0.5)]
    )
    db.run(
      `INSERT INTO colleague_statuses (user_id, colleague_id, content, theme_tags, software_tags, mood, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [owner.id, null, '隔壁组又在群里 @ 全体 发需求变更，周五上线，微笑。',
        JSON.stringify(['需求变更', '甩锅大会']), JSON.stringify(['企业微信', '邮箱']), '😤', daysAgo(0.2)]
    )
    console.log('[seed] 已预置同事/公司/状态示例数据')
    return 1
  } catch (e) {
    console.warn('[seed] 示例领域数据插入失败:', e.message)
    return 0
  }
}
