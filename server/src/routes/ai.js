/**
 * AI 自动识别与关系总结（首版用关键词词典，无需 LLM；后续可接大模型）
 * - POST /api/ai/extract-tags      输入文本 → 返回 {category, behaviorTags, sentiment}
 * - GET  /api/ai/relationship/:colleagueId   同事关系总结（基于吐槽 + 评分）
 * - GET  /api/ai/personality        当前用户的职场人格
 */
import { Router } from 'express'
import { requireAuth } from '../middleware.js'
import { KEYWORD_MAP, PERSONALITY_TEMPLATES } from './tags-dict.js'

function matchFirst(text, dict) {
  for (const [id, kws] of Object.entries(dict)) {
    for (const kw of kws) {
      if (text.includes(kw)) return id
    }
  }
  return null
}
function matchAll(text, dict) {
  const hits = []
  for (const [id, kws] of Object.entries(dict)) {
    for (const kw of kws) {
      if (text.includes(kw) && !hits.includes(id)) hits.push(id)
    }
  }
  return hits
}

export function aiRouter(db) {
  const router = Router()

  // ── 自动识别 ──
  router.post('/ai/extract-tags', requireAuth, (req, res) => {
    const text = String(req.body?.text || '').trim()
    if (!text) return res.json({ category: null, behaviorTags: [], sentiment: null, hasMatch: false })
    const category = matchFirst(text, KEYWORD_MAP.colleagueTypes)
    const behaviorTags = matchAll(text, KEYWORD_MAP.behaviorTags)
    const sentiment = matchFirst(text, KEYWORD_MAP.sentiment)
    const hasMatch = !!(category || behaviorTags.length || sentiment)
    res.json({ category, behaviorTags, sentiment, hasMatch })
  })

  // ── 同事关系总结 ──
  router.get('/ai/relationship/:colleagueId', requireAuth, (req, res) => {
    const cid = Number(req.params.colleagueId)
    const colleague = db.get('SELECT * FROM colleagues WHERE id = ?', [cid])
    if (!colleague) return res.status(404).json({ error: '同事不存在' })

    // 雷达分（取该用户对该同事的最新评分；若无则用 5 维平均 60）
    const r = db.get(`SELECT cooperation, expertise, communication, support, trust FROM colleague_radar_scores WHERE colleague_id = ? AND scorer_id = ?`, [cid, req.userId])
    const radar = r
      ? {
          cooperation: Number(r.cooperation),
          expertise: Number(r.expertise),
          communication: Number(r.communication),
          support: Number(r.support),
          trust: Number(r.trust)
        }
      : { cooperation: 60, expertise: 60, communication: 60, support: 60, trust: 60 }

    // 关系健康度
    const avg = (radar.cooperation + radar.expertise + radar.communication + radar.support + radar.trust) / 5

    // 吐槽中关联该同事的行为标签聚合
    const rows = db.all(`SELECT behavior_tags, sentiment, content FROM complaints WHERE colleague_id = ? AND user_id = ? ORDER BY id DESC LIMIT 50`, [cid, req.userId])
    const tagCount = {}
    for (const row of rows) {
      const tags = row.behavior_tags ? JSON.parse(row.behavior_tags) : []
      for (const t of tags) tagCount[t] = (tagCount[t] || 0) + 1
    }
    const topBehaviors = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t)

    // 简单关系类型标签
    const relationType =
      radar.communication < 50 && radar.trust < 50 ? '高频摩擦型' :
      radar.cooperation > 75 && radar.trust > 70 ? '默契合作型' :
      radar.support < 40 ? '独立型合作' :
      '中性共事型'

    // AI 建议
    const suggestions = []
    if (radar.communication < 60) suggestions.push('减少口头沟通，改用文字确认关键交付物。')
    if (radar.trust < 60) suggestions.push('重要决策同步抄送，明确双方共识。')
    if (topBehaviors.includes('shift_blame')) suggestions.push('遇到责任归属时主动书面记录分工，避免事后争议。')
    if (topBehaviors.includes('meeting_bs')) suggestions.push('会前提供议程，会后及时给结论摘要。')
    if (topBehaviors.includes('read_noreply')) suggestions.push('约定明确响应时间（如 4 小时内），超时升级。')
    if (radar.cooperation > 75) suggestions.push('继续保持协同节奏，可尝试更多跨项目合作。')
    if (suggestions.length === 0) suggestions.push('维持现有合作方式，定期同步进度即可。')

    // 关键矛盾
    const conflicts = []
    if (topBehaviors.includes('shift_blame')) conflicts.push('需求变更与责任归属')
    if (topBehaviors.includes('sudden_req')) conflicts.push('临时需求频繁')
    if (topBehaviors.includes('meeting_bs')) conflicts.push('会议效率低')
    if (topBehaviors.includes('faceup') || topBehaviors.includes('faceprivate')) conflicts.push('沟通方式不一致')
    if (conflicts.length === 0) conflicts.push('暂无突出矛盾')

    res.json({
      colleagueId: String(cid),
      colleagueName: colleague.name,
      position: colleague.position || '',
      relation: colleague.relation || '',
      radar,
      healthScore: Math.round(avg),
      relationType,
      conflicts,
      topBehaviors,
      suggestions,
      baseOn: rows.length, // 基于的吐槽记录条数
      disclaimer: '本报告基于你的记录生成的估计，不是客观人格判断。'
    })
  })

  // ── 职场人格 ──
  router.get('/ai/personality', requireAuth, (req, res) => {
    let profile = db.get('SELECT * FROM personality_profiles WHERE user_id = ?', [req.userId])
    if (!profile) {
      db.run(`INSERT INTO personality_profiles (user_id, personality, total_complaints, total_resonances, top_target, top_theme, weakest_point, emotion_index, relationship_sensitivity, slack_score, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [req.userId, '🐟 摸鱼哲学家', 0, 0, '', '', '', 50, 50, 50, new Date().toISOString()])
      profile = db.get('SELECT * FROM personality_profiles WHERE user_id = ?', [req.userId])
    }
    const template = PERSONALITY_TEMPLATES.find((t) => t.label === profile.personality) || PERSONALITY_TEMPLATES[1]

    res.json({
      personality: profile.personality,
      emoji: template.emoji,
      desc: template.desc,
      stats: {
        totalComplaints: profile.total_complaints,
        totalResonances: profile.total_resonances,
        topTarget: profile.top_target,
        topTheme: profile.top_theme,
        weakestPoint: profile.weakest_point,
        emotionIndex: profile.emotion_index,
        relationshipSensitivity: profile.relationship_sensitivity,
        slackScore: profile.slack_score
      },
      disclaimer: '基于你的吐槽记录生成的估计'
    })
  })

  return router
}
