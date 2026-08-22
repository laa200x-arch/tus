/**
 * 同事关系雷达（5 维度打分）
 * - GET   /api/radar/:colleagueId         拉取我对该同事的打分；无则返回默认 60
 * - POST  /api/radar/:colleagueId         提交打分（5 维 0-100，单用户对单同事唯一）
 * - GET   /api/radar/list?ids=1,2,3       同事列表用：批量拉多人雷达均值
 */
import { Router } from 'express'
import { requireAuth } from '../middleware.js'

export function radarRouter(db) {
  const router = Router()

  const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0))

  router.get('/radar/:colleagueId', requireAuth, (req, res) => {
    const cid = Number(req.params.colleagueId)
    const row = db.get('SELECT * FROM colleague_radar_scores WHERE colleague_id = ? AND scorer_id = ?', [cid, req.userId])
    if (!row) {
      return res.json({
        scored: false,
        colleagueId: String(cid),
        scores: { cooperation: 60, expertise: 60, communication: 60, support: 60, trust: 60 }
      })
    }
    res.json({
      scored: true,
      colleagueId: String(cid),
      scores: {
        cooperation: Number(row.cooperation),
        expertise: Number(row.expertise),
        communication: Number(row.communication),
        support: Number(row.support),
        trust: Number(row.trust)
      }
    })
  })

  // ── 批量（必须注册在 /radar/:colleagueId 之前，否则 "batch" 会被当作同事 ID） ──
  router.post('/radar/batch', requireAuth, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
    if (ids.length === 0) return res.json({ items: {} })
    const out = {}
    for (const cid of ids) {
      const row = db.get('SELECT * FROM colleague_radar_scores WHERE colleague_id = ? AND scorer_id = ?', [cid, req.userId])
      if (row) {
        out[cid] = {
          cooperation: Number(row.cooperation),
          expertise: Number(row.expertise),
          communication: Number(row.communication),
          support: Number(row.support),
          trust: Number(row.trust)
        }
      } else {
        out[cid] = { cooperation: 60, expertise: 60, communication: 60, support: 60, trust: 60 }
      }
    }
    res.json({ items: out })
  })

  router.post('/radar/:colleagueId', requireAuth, (req, res) => {
    const cid = Number(req.params.colleagueId)
    if (!db.get('SELECT 1 FROM colleagues WHERE id = ?', [cid])) return res.status(404).json({ error: '同事不存在' })
    const s = req.body?.scores || {}
    const cooperation = clamp(s.cooperation)
    const expertise = clamp(s.expertise)
    const communication = clamp(s.communication)
    const support = clamp(s.support)
    const trust = clamp(s.trust)
    const existing = db.get('SELECT id FROM colleague_radar_scores WHERE colleague_id = ? AND scorer_id = ?', [cid, req.userId])
    if (existing) {
      db.run(`UPDATE colleague_radar_scores SET cooperation=?, expertise=?, communication=?, support=?, trust=?, created_at=? WHERE id=?`,
        [cooperation, expertise, communication, support, trust, new Date().toISOString(), existing.id])
    } else {
      db.run(`INSERT INTO colleague_radar_scores (colleague_id, scorer_id, cooperation, expertise, communication, support, trust, created_at) VALUES (?,?,?,?,?,?,?,?)`,
        [cid, req.userId, cooperation, expertise, communication, support, trust, new Date().toISOString()])
    }
    res.json({ ok: true, scores: { cooperation, expertise, communication, support, trust } })
  })

  return router
}
