/**
 * 首页统计聚合（设计稿 Dashboard 4 个数据卡片）
 * - GET /api/home/stats  → 今日吐槽 / 共鸣点赞 / 同事评分 / 关系健康
 */
import { Router } from 'express'
import { requireAuth } from '../middleware.js'
import { buildHomeOverview } from '../services/home-overview.js'

export function homeRouter(db) {
  const router = Router()

  router.get('/home/overview', requireAuth, (req, res, next) => {
    try {
      res.json({ ...buildHomeOverview(db, req.userId) })
    } catch (error) {
      next(error)
    }
  })

  router.get('/home/stats', requireAuth, (req, res) => {
    const uid = req.userId
    // 今日吐槽（我今日发布数）
    const today = new Date().toISOString().slice(0, 10)
    const todayComplaints = db.get(
      'SELECT COUNT(*) AS c FROM complaints WHERE user_id = ? AND substr(created_at,1,10) = ?',
      [uid, today]
    )?.c || 0
    // 共鸣点赞（我收到的共鸣 + 点赞 与 我发出的互动；取"我收到的共鸣"）
    const myResonances = db.get(
      `SELECT COUNT(*) AS c FROM complaint_resonances r JOIN complaints c ON c.id = r.complaint_id WHERE c.user_id = ?`,
      [uid]
    )?.c || 0
    const myLikes = db.get(
      `SELECT COUNT(*) AS c FROM complaint_likes l JOIN complaints c ON c.id = l.complaint_id WHERE c.user_id = ?`,
      [uid]
    )?.c || 0
    // 同事评分（我对同事的关系雷达五维均值，转 0-5 分）
    const radar = db.all('SELECT * FROM colleague_radar_scores WHERE scorer_id = ?', [uid])
    let avgColleagueScore = null
    if (radar.length) {
      const sum = radar.reduce((a, r) => a + r.cooperation + r.expertise + r.communication + r.support + r.trust, 0)
      avgColleagueScore = Math.round(((sum / (radar.length * 5)) / 20) * 10) / 10 // 0-100 → 0-5
    }
    // 关系健康（情绪打卡天数驱动，≥3 天出分）
    const moodDays = db.get('SELECT COUNT(*) AS c FROM mood_checkins WHERE user_id = ?', [uid])?.c || 0
    const healthScore = moodDays >= 3 ? Math.min(99, 55 + moodDays * 3) : null

    res.json({
      stats: {
        todayComplaints,
        myResonances,
        myLikes,
        avgColleagueScore,
        colleagueCount: radar.length,
        healthScore,
        moodDays
      }
    })
  })

  return router
}
