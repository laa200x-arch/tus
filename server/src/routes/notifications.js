/**
 * 消息中心（v3 设计稿：全部 / AI提醒 / 互动 / 系统）
 * - GET /api/notifications → { total, interaction[], ai[], system[] }
 *   interaction：我收到的共鸣/点赞/评论（最近 12 条）
 *   ai：规则引擎生成（情绪预警 / 冲突提示 / 打卡提醒 / 压力来源）
 *   system：版本与欢迎等静态消息
 * 已读状态由客户端本地管理（localStorage），服务端只做聚合。
 */
import { Router } from 'express'
import { requireAuth } from '../middleware.js'
import { moodScore } from '../little-energy.js'

export function notificationsRouter(db) {
  const router = Router()

  router.get('/notifications', requireAuth, (req, res) => {
    const uid = req.userId
    const now = new Date().toISOString()

    // ---- 互动（我收到的赞/共鸣/评论） ----
    const liked = db.all(`
      SELECT l.created_at AS time, u.nickname AS actor, u.avatar_symbol AS avatar, c.id AS complaint_id, c.content
      FROM complaint_likes l JOIN complaints c ON c.id = l.complaint_id JOIN users u ON u.id = l.user_id
      WHERE c.user_id = ? AND l.user_id != ? ORDER BY l.id DESC LIMIT 6`, [uid, uid])
    const resonated = db.all(`
      SELECT r.created_at AS time, u.nickname AS actor, u.avatar_symbol AS avatar, c.id AS complaint_id, c.content
      FROM complaint_resonances r JOIN complaints c ON c.id = r.complaint_id JOIN users u ON u.id = r.user_id
      WHERE c.user_id = ? AND r.user_id != ? ORDER BY r.id DESC LIMIT 6`, [uid, uid])
    const commented = db.all(`
      SELECT cm.created_at AS time, u.nickname AS actor, u.avatar_symbol AS avatar, c.id AS complaint_id, c.content, cm.content AS comment_text
      FROM complaint_comments cm JOIN complaints c ON c.id = cm.complaint_id JOIN users u ON u.id = cm.user_id
      WHERE c.user_id = ? AND cm.user_id != ? ORDER BY cm.id DESC LIMIT 6`, [uid, uid])

    const interaction = []
    for (const r of liked) interaction.push({ type: 'like', actor: r.actor, avatar: r.avatar || '👤', text: `赞了你的吐槽「${r.content.slice(0, 20)}…」`, complaintId: String(r.complaint_id), time: r.time })
    for (const r of resonated) interaction.push({ type: 'resonate', actor: r.actor, avatar: r.avatar || '👤', text: `对你的吐槽产生了共鸣「${r.content.slice(0, 20)}…」`, complaintId: String(r.complaint_id), time: r.time })
    for (const r of commented) interaction.push({ type: 'comment', actor: r.actor, avatar: r.avatar || '👤', text: `评论了你的吐槽：「${(r.comment_text || '').slice(0, 24)}」`, complaintId: String(r.complaint_id), time: r.time })
    interaction.sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 12)

    // ---- AI 提醒（规则引擎） ----
    const ai = []
    const today = now.slice(0, 10)
    const checkedToday = db.get('SELECT 1 FROM mood_checkins WHERE user_id = ? AND substr(checkin_date,1,10) = ?', [uid, today])
    if (!checkedToday) {
      ai.push({ type: 'mood_checkin', title: '⏰ 今日情绪打卡', text: '今天上班感觉怎么样？花 5 秒记录一下，AI 才能给你更准的洞察。', action: '去打卡', actionView: 'home', time: now })
    }
    // 最近 7 天负面情绪占比
    const week = db.all(`SELECT mood, stress_sources FROM mood_checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 7`, [uid])
    if (week.length >= 2) {
      const neg = week.filter((w) => moodScore(w.mood) < 0).length
      const ratio = Math.round((neg / week.length) * 100)
      if (ratio >= 40) {
        ai.push({ type: 'stress', title: '😮‍💨 情绪预警', text: `最近 ${week.length} 天里你有 ${ratio}% 的日子情绪偏负面，注意休息和调节。`, action: '查看情绪趋势', actionView: 'ai', time: now })
      }
      // 高频压力源
      const sources = {}
      for (const w of week) {
        try { for (const s of JSON.parse(w.stress_sources || '[]')) sources[s] = (sources[s] || 0) + 1 } catch { /* ignore */ }
      }
      const top = Object.entries(sources).sort((a, b) => b[1] - a[1])[0]
      if (top && top[1] >= 2) {
        ai.push({ type: 'stress_source', title: '🎯 主要压力来源', text: `你最近的主要压力来源是「${top[0]}」（出现 ${top[1]} 次），建议主动调整。`, action: '查看详情', actionView: 'ai', time: now })
      }
    }
    // 冲突提示：对某同事吐槽 ≥ 3 次
    const conflict = db.all(`
      SELECT colleague_id, COUNT(*) AS c FROM complaints
      WHERE user_id = ? AND colleague_id IS NOT NULL GROUP BY colleague_id HAVING c >= 3 ORDER BY c DESC LIMIT 3`, [uid])
    for (const r of conflict) {
      const col = db.get('SELECT name FROM colleagues WHERE id = ?', [r.colleague_id])
      if (col) {
        ai.push({ type: 'conflict', title: `⚡ 与 ${col.name} 摩擦上升`, text: `你近期记录了 ${r.c} 条关于 ${col.name} 的吐槽，冲突概率上升，建议看看分析。`, action: '查看分析', actionView: 'colleague', colleagueId: String(r.colleague_id), time: now })
      }
    }
    if (!ai.length) {
      ai.push({ type: 'all_good', title: '🍵 状态平稳', text: '最近没有明显异常，继续保持记录，AI 洞察会越来越准。', action: '', actionView: '', time: now })
    }

    // ---- 系统 ----
    const system = [
      { type: 'version', title: '✨ 职场那些事 v2.1', text: '27 种小能仔情绪、全局状态同步、个人换装与聊天 Emoji 已上线。', action: '', actionView: '', time: now }
    ]

    res.json({ total: interaction.length + ai.length + system.length, interaction, ai, system })
  })

  return router
}
