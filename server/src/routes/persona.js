/**
 * 同事品行系统（v3 核心壁垒·游戏化人格）
 * - GET  /api/persona/:colleagueId                 拉取我对该同事的六维打分（无则默认 50）
 * - POST /api/persona/:colleagueId                 提交六维打分（upsert，0-100）
 * - GET  /api/persona/:colleagueId/prediction      人格标签 + 行为预测（规则引擎 + 吐槽数据加权）
 */
import { Router } from 'express'
import { requireAuth } from '../middleware.js'

const DIMS = ['eq', 'responsibility', 'control', 'execution', 'showmanship', 'temper']
const DIM_LABELS = { eq: '情商', responsibility: '责任心', control: '控制欲', execution: '执行力', showmanship: '表演欲', temper: '脾气' }

const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0))

export function personaRouter(db) {
  const router = Router()

  const defaultScores = () => {
    const s = {}
    for (const d of DIMS) s[d] = 50
    return s
  }

  // ── 拉取六维 ──
  router.get('/persona/:colleagueId', requireAuth, (req, res) => {
    const cid = Number(req.params.colleagueId)
    const row = db.get('SELECT * FROM colleague_persona_scores WHERE colleague_id = ? AND scorer_id = ?', [cid, req.userId])
    if (!row) return res.json({ scored: false, colleagueId: String(cid), scores: defaultScores() })
    const scores = {}
    for (const d of DIMS) scores[d] = Number(row[d])
    res.json({ scored: true, colleagueId: String(cid), scores })
  })

  // ── 提交六维（upsert） ──
  router.post('/persona/:colleagueId', requireAuth, (req, res) => {
    const cid = Number(req.params.colleagueId)
    if (!db.get('SELECT 1 FROM colleagues WHERE id = ?', [cid])) return res.status(404).json({ error: '同事不存在' })
    const s = req.body?.scores || {}
    const scores = {}
    for (const d of DIMS) scores[d] = clamp(s[d])
    const existing = db.get('SELECT id FROM colleague_persona_scores WHERE colleague_id = ? AND scorer_id = ?', [cid, req.userId])
    const now = new Date().toISOString()
    if (existing) {
      db.run(`UPDATE colleague_persona_scores SET eq=?, responsibility=?, control=?, execution=?, showmanship=?, temper=?, created_at=? WHERE id=?`,
        [scores.eq, scores.responsibility, scores.control, scores.execution, scores.showmanship, scores.temper, now, existing.id])
    } else {
      db.run(`INSERT INTO colleague_persona_scores (colleague_id, scorer_id, eq, responsibility, control, execution, showmanship, temper, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
        [cid, req.userId, scores.eq, scores.responsibility, scores.control, scores.execution, scores.showmanship, scores.temper, now])
    }
    res.json({ ok: true, scores })
  })

  // ── 人格标签 + 行为预测 ──
  router.get('/persona/:colleagueId/prediction', requireAuth, (req, res) => {
    const cid = Number(req.params.colleagueId)
    const col = db.get('SELECT * FROM colleagues WHERE id = ? AND user_id = ?', [cid, req.userId])
    if (!col) return res.status(404).json({ error: '同事不存在' })
    const row = db.get('SELECT * FROM colleague_persona_scores WHERE colleague_id = ? AND scorer_id = ?', [cid, req.userId])
    const s = defaultScores()
    if (row) for (const d of DIMS) s[d] = Number(row[d])

    // 人格标签（六维推演）
    const traits = []
    if (s.control >= 65) traits.push({ key: 'highControl', label: '🟣 高控制', desc: '喜欢主导节奏、临时拍板' })
    if (s.responsibility <= 40) traits.push({ key: 'lowResponsibility', label: '🔴 低责任', desc: '遇事倾向先撇清自己' })
    if (s.showmanship >= 65) traits.push({ key: 'highExpression', label: '🟢 高表达', desc: '存在感强、开会输出多' })
    if (s.eq >= 65) traits.push({ key: 'highEQ', label: '💜 高情商', desc: '说话圆滑、情绪稳定' })
    if (s.execution >= 65) traits.push({ key: 'highExecution', label: '⚡ 高执行', desc: '交付快、推进力强' })
    if (s.temper >= 65) traits.push({ key: 'hotTemper', label: '🧨 高脾气', desc: '情绪波动大、容易上头' })
    if (!traits.length) traits.push({ key: 'balanced', label: '⚪ 均衡型', desc: '各项指标都在安全区间' })

    // 吐槽数据加权（该同事被吐槽的行为标签）
    const tagRows = db.all('SELECT behavior_tags FROM complaints WHERE colleague_id = ?', [cid])
    const tagBoost = {}
    for (const r of tagRows) {
      try {
        for (const t of JSON.parse(r.behavior_tags || '[]')) tagBoost[t] = (tagBoost[t] || 0) + 1
      } catch { /* ignore */ }
    }
    const boost = (base, tags, amount) => {
      let b = base
      for (const t of tags) if (tagBoost[t]) b += amount * tagBoost[t]
      return Math.max(5, Math.min(98, Math.round(b)))
    }

    // 行为预测（规则 + 吐槽加权）
    const predictions = [
      { key: 'changeDemand', label: '喜欢临时改需求', probability: boost(s.control * 0.35 + (100 - s.responsibility) * 0.25 + 10, ['req_change', 'temporary_demand', 'change'], 6) },
      { key: 'longMeeting', label: '喜欢开长会议', probability: boost(s.showmanship * 0.35 + s.control * 0.25 + 10, ['meeting', 'long_meeting'], 6) },
      { key: 'blame', label: '主动承担责任', probability: boost(s.responsibility * 0.7 + 10, ['responsibility'], 5) },
      { key: 'shiftBlame', label: '遇事甩锅', probability: boost((100 - s.responsibility) * 0.5 + (100 - s.eq) * 0.2 + 10, ['shift_blame', 'push_work'], 7) },
      { key: 'lateMessage', label: '深夜/周末安排工作', probability: boost(s.control * 0.3 + (100 - s.execution) * 0.2 + 15, ['night_msg', 'weekend_work'], 6) }
    ]

    res.json({
      colleagueId: String(cid),
      colleagueName: col.name,
      scores: s,
      traits,
      predictions,
      riskLevel: col.risk_level || (traits.some((t) => t.key === 'lowResponsibility' || t.key === 'hotTemper') ? '中' : '低'),
      disclaimer: '以上为基于你的记录与打分的规则估算，非客观事实。'
    })
  })

  return router
}
