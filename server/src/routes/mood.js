/**
 * 情绪打卡（每日入口 + 30 天曲线 + AI 总结）
 * - GET  /api/mood/today        今日是否已打卡 + 默认值
 * - POST /api/mood/checkin      每日一次（upsert），含情绪、压力源、备注
 * - GET  /api/mood/trends?days=30  最近 N 天曲线（按日聚合）
 * - GET  /api/mood/summary      AI 总结（最近 30 天主要压力来源 + 模式）
 */
import { Router } from 'express'
import { requireAuth } from '../middleware.js'
import { MOODS, normalizeMood } from '../little-energy.js'

const moodScores = new Map(MOODS.map((mood) => [mood.id, mood.score]))

function isSupportedMood(value) {
  return typeof value === 'string' && MOODS.some((mood) => mood.id === value || mood.legacyEmoji === value)
}

function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function moodRouter(db) {
  const router = Router()
  const now = () => new Date().toISOString()

  // ── 今日 ──
  router.get('/mood/today', requireAuth, (req, res) => {
    const date = todayDateStr()
    const row = db.get(`SELECT * FROM mood_checkins WHERE user_id = ? AND checkin_date = ?`, [req.userId, date])
    if (!row) {
      return res.json({ checked: false, date })
    }
    res.json({
      checked: true,
      date,
      mood: normalizeMood(row.mood),
      stressSources: row.stress_sources ? JSON.parse(row.stress_sources) : [],
      note: row.note,
      createdAt: row.created_at
    })
  })

  // ── 打卡（upsert） ──
  router.post('/mood/checkin', requireAuth, (req, res) => {
    const rawMood = typeof req.body?.mood === 'string' ? req.body.mood.trim() : ''
    if (!isSupportedMood(rawMood)) return res.status(400).json({ error: '请选择有效的今日情绪' })
    const mood = normalizeMood(rawMood)
    const stressSources = Array.isArray(req.body?.stressSources) ? req.body.stressSources.slice(0, 10) : []
    const note = String(req.body?.note || '').slice(0, 500)
    const date = todayDateStr()
    const existing = db.get('SELECT id FROM mood_checkins WHERE user_id = ? AND checkin_date = ?', [req.userId, date])
    if (existing) {
      db.run(`UPDATE mood_checkins SET mood=?, stress_sources=?, note=?, created_at=? WHERE id=?`,
        [mood, JSON.stringify(stressSources), note, now(), existing.id])
    } else {
      db.run(`INSERT INTO mood_checkins (user_id, mood, stress_sources, note, checkin_date, created_at) VALUES (?,?,?,?,?,?)`,
        [req.userId, mood, JSON.stringify(stressSources), note, date, now()])
    }
    res.json({ ok: true, date, mood, stressSources, note })
  })

  // ── 趋势（最近 N 天） ──
  router.get('/mood/trends', requireAuth, (req, res) => {
    const days = Math.min(60, Math.max(7, Number(req.query.days) || 30))
    const rows = db.all(`
      SELECT checkin_date, mood, stress_sources
      FROM mood_checkins
      WHERE user_id = ? AND checkin_date >= date('now', ?)
      ORDER BY checkin_date ASC`,
      [req.userId, `-${days - 1} days`])
    // 构造连续日期数组，缺失那天为 null
    const map = new Map()
    for (const r of rows) map.set(r.checkin_date, r)
    const trend = []
    const today = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const r = map.get(ds)
      trend.push(r ? { date: ds, mood: normalizeMood(r.mood), stressSources: r.stress_sources ? JSON.parse(r.stress_sources) : [] } : { date: ds, mood: null, stressSources: [] })
    }
    res.json({ days, trend })
  })

  // ── AI 总结（最近 30 天压力源分布 + 高低峰） ──
  router.get('/mood/summary', requireAuth, (req, res) => {
    const rows = db.all(`
      SELECT checkin_date, mood, stress_sources
      FROM mood_checkins
      WHERE user_id = ? AND checkin_date >= date('now', '-30 days')
      ORDER BY checkin_date ASC`, [req.userId])
    if (rows.length === 0) {
      return res.json({
        totalDays: 0,
        message: '暂无足够数据，开始每天打卡，AI 会在一周后给出你的职场情绪画像。',
        rankings: [],
        hotWeekdays: [],
        insights: []
      })
    }
    // 压力源统计
    const sourceCount = {}
    for (const r of rows) {
      const ss = r.stress_sources ? JSON.parse(r.stress_sources) : []
      for (const s of ss) sourceCount[s] = (sourceCount[s] || 0) + 1
    }
    const rankings = Object.entries(sourceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, count }))

    // 每周几情绪低的统计
    const weekdayMood = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [] }
    for (const r of rows) {
      const wd = new Date(r.checkin_date).getDay()
      weekdayMood[wd].push(normalizeMood(r.mood))
    }
    const hotWeekdays = Object.entries(weekdayMood)
      .map(([wd, moods]) => ({ wd: Number(wd), count: moods.filter((m) => moodScores.get(m) < 0).length, total: moods.length }))
      .filter((x) => x.total > 0)
      .sort((a, b) => (b.count / b.total) - (a.count / a.total))
      .slice(0, 2)
      .map((x) => ['周日','周一','周二','周三','周四','周五','周六'][x.wd])

    // 简单 insights
    const insights = []
    if (rows.length >= 7) insights.push(`过去 30 天打卡 ${rows.length} 次，情绪坚持记录中。`)
    if (hotWeekdays.length) insights.push(`你的情绪在${hotWeekdays.join('和')}明显下降，注意调整节奏。`)
    if (rankings.length) insights.push(`最大压力源是「${rankings[0].id}」（${rankings[0].count} 次），建议针对性沟通。`)

    res.json({
      totalDays: rows.length,
      message: `已为你分析最近 ${rows.length} 天的职场情绪。`,
      rankings,
      hotWeekdays,
      insights
    })
  })

  return router
}
