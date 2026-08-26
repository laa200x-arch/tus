/**
 * 吐槽广场（职场关系操作系统 v2 核心入口）
 * - GET  /api/complaints/feed?sort=hot|new   feed（热度/最新）
 * - GET  /api/complaints/mine                我的吐槽
 * - POST /api/complaints                     发布（含风控）
 * - DELETE /api/complaints/:id               删除自己的
 * - POST /api/complaints/:id/like            点赞（toggle）
 * - POST /api/complaints/:id/resonate        共鸣（toggle）
 * - GET  /api/complaints/topics              热搜榜（按 hot_score 倒序前 10）
 */
import { Router } from 'express'
import { requireAuth } from '../middleware.js'
import { checkTextRisk } from '../risk.js'
import { normalizeOutfit } from '../little-energy.js'

export function complaintsRouter(db, io) {
  const router = Router()
  const now = () => new Date().toISOString()

  // 计算热度 = 共鸣数*3 + 点赞数*1 + 时间衰减（小时）
  function recomputeHotScore(complaintId) {
    const res = db.get(`
      SELECT
        (SELECT COUNT(*) FROM complaint_resonances WHERE complaint_id = ?) AS rc,
        (SELECT COUNT(*) FROM complaint_likes WHERE complaint_id = ?) AS lc,
        (SELECT CAST((julianday('now') - julianday(created_at)) * 24 AS REAL) FROM complaints WHERE id = ?) AS hours
    `, [complaintId, complaintId, complaintId])
    if (!res) return 0
    const hours = Math.max(0, Number(res.hours || 0))
    const decay = Math.max(0, 1 - hours / 72) // 72 小时衰减
    return (Number(res.rc || 0) * 3 + Number(res.lc || 0)) * decay
  }

  // 查询单条带计数
  const enrichRow = (row, viewerId) => {
    if (!row) return null
    const likes = db.get('SELECT COUNT(*) AS c FROM complaint_likes WHERE complaint_id = ?', [row.id])
    const resonances = db.get('SELECT COUNT(*) AS c FROM complaint_resonances WHERE complaint_id = ?', [row.id])
    const comments = db.get('SELECT COUNT(*) AS c FROM complaint_comments WHERE complaint_id = ?', [row.id])
    const liked = !!db.get('SELECT 1 FROM complaint_likes WHERE complaint_id = ? AND user_id = ?', [row.id, viewerId])
    const resonated = !!db.get('SELECT 1 FROM complaint_resonances WHERE complaint_id = ? AND user_id = ?', [row.id, viewerId])
    const likeCount = Number(likes?.c || 0)
    const resonanceCount = Number(resonances?.c || 0)
    // 共鸣率 = 共鸣数 / (点赞+共鸣)，无互动时为 0（设计稿卡片"共鸣值 %"）
    const resonanceRate = (likeCount + resonanceCount) > 0 ? Math.round((resonanceCount / (likeCount + resonanceCount)) * 100) : 0
    return {
      id: String(row.id),
      userId: String(row.user_id),
      authorName: row.is_anonymous ? '匿名用户' : row.author_name,
      avatarSymbol: row.is_anonymous ? '🎭' : (row.author_avatar || '👤'),
      littleEnergyOutfit: row.is_anonymous ? null : normalizeOutfit(parseOutfit(row.author_outfit)),
      isAnonymous: !!row.is_anonymous,
      content: row.content,
      colleagueId: row.colleague_id ? String(row.colleague_id) : null,
      colleagueName: row.colleague_name || null,
      category: row.category || null,
      behaviorTags: row.behavior_tags ? JSON.parse(row.behavior_tags) : [],
      sentiment: row.sentiment || null,
      aiExtracted: row.ai_extracted ? JSON.parse(row.ai_extracted) : null,
      likeCount,
      resonanceCount,
      commentCount: Number(comments?.c || 0),
      resonanceRate,
      hotScore: Number(row.hot_score || 0),
      liked,
      resonated,
      time: row.created_at
    }
  }

  const parseOutfit = (value) => {
    if (!value) return null
    try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return null }
  }

  // ── Feed（设计稿分类 Tab：recommend 推荐 / new 最新 / anonymous 匿名 / colleague 我的同事 / mine 我的） ──
  router.get('/complaints/feed', requireAuth, (req, res) => {
    const sort = String(req.query.sort || 'hot')
    const filter = String(req.query.filter || 'recommend')
    const limit = Math.min(50, Number(req.query.limit) || 30)
    // 先把 hot_score 重算（简单的"按需"重算：取前 100 条）
    const ids = db.all('SELECT id FROM complaints ORDER BY id DESC LIMIT 200')
    for (const r of ids) {
      const hs = recomputeHotScore(r.id)
      db.run('UPDATE complaints SET hot_score = ? WHERE id = ?', [hs, r.id])
    }
    const orderBy = sort === 'new' ? 'c.id DESC' : 'c.hot_score DESC, c.id DESC'
    let where = ''
    const args = []
    if (filter === 'anonymous') {
      where = 'WHERE c.is_anonymous = 1'
    } else if (filter === 'colleague') {
      // 我同事档案里关联的吐槽（colleague_id 属于我）
      where = 'WHERE c.colleague_id IN (SELECT id FROM colleagues WHERE user_id = ?)'
      args.push(req.userId)
    } else if (filter === 'mine') {
      where = 'WHERE c.user_id = ?'
      args.push(req.userId)
    }
    const rows = db.all(`
      SELECT c.*, u.nickname AS author_name, u.avatar_symbol AS author_avatar, u.little_energy_outfit AS author_outfit,
             col.name AS colleague_name
      FROM complaints c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN colleagues col ON col.id = c.colleague_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ?`, [...args, limit])
    res.json({
      complaints: rows.map((r) => enrichRow(r, req.userId)),
      sort,
      filter
    })
  })

  // ── 我的 ──
  router.get('/complaints/mine', requireAuth, (req, res) => {
    const rows = db.all(`
      SELECT c.*, u.nickname AS author_name, u.avatar_symbol AS author_avatar, u.little_energy_outfit AS author_outfit,
             col.name AS colleague_name
      FROM complaints c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN colleagues col ON col.id = c.colleague_id
      WHERE c.user_id = ?
      ORDER BY c.id DESC LIMIT 100`, [req.userId])
    res.json({ complaints: rows.map((r) => enrichRow(r, req.userId)) })
  })

  // ── 发布 ──
  router.post('/complaints', requireAuth, (req, res) => {
    const content = String(req.body?.content || '').trim()
    if (!content) return res.status(400).json({ error: '内容不能为空' })
    if (content.length > 1000) return res.status(400).json({ error: '内容不能超过 1000 字' })
    const risk = checkTextRisk(content)
    if (risk.isIllegal) {
      return res.status(403).json({ error: risk.warning, matchedWords: risk.matchedWords, blocked: true })
    }
    const colleagueId = req.body?.colleagueId ? Number(req.body.colleagueId) : null
    const category = req.body?.category ? String(req.body.category).slice(0, 32) : null
    const behaviorTags = Array.isArray(req.body?.behaviorTags) ? req.body.behaviorTags.slice(0, 8) : []
    const sentiment = req.body?.sentiment ? String(req.body.sentiment).slice(0, 16) : null
    const isAnonymous = req.body?.isAnonymous ? 1 : 0
    const aiExtracted = req.body?.aiExtracted || null

    const r = db.run(`
      INSERT INTO complaints (user_id, content, colleague_id, category, behavior_tags, sentiment, is_anonymous, ai_extracted, hot_score, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [req.userId, content, colleagueId, category, JSON.stringify(behaviorTags), sentiment, isAnonymous, aiExtracted ? JSON.stringify(aiExtracted) : null, 0, now()]
    )
    const row = db.get(`
      SELECT c.*, u.nickname AS author_name, u.avatar_symbol AS author_avatar, u.little_energy_outfit AS author_outfit,
             col.name AS colleague_name
      FROM complaints c JOIN users u ON u.id = c.user_id
      LEFT JOIN colleagues col ON col.id = c.colleague_id
      WHERE c.id = ?`, [r.lastInsertRowid])
    const enriched = enrichRow(row, req.userId)
    if (io) io.emit('complaint:new', enriched)
    res.status(201).json({ complaint: enriched })
  })

  // ── 删除（仅本人） ──
  router.delete('/complaints/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id)
    const r = db.run('DELETE FROM complaints WHERE id = ? AND user_id = ?', [id, req.userId])
    if (r.changes === 0) return res.status(404).json({ error: '吐槽不存在或无权删除' })
    db.run('DELETE FROM complaint_likes WHERE complaint_id = ?', [id])
    db.run('DELETE FROM complaint_resonances WHERE complaint_id = ?', [id])
    res.json({ ok: true })
  })

  // ── 点赞 toggle ──
  router.post('/complaints/:id/like', requireAuth, (req, res) => {
    const id = Number(req.params.id)
    if (!db.get('SELECT 1 FROM complaints WHERE id = ?', [id])) return res.status(404).json({ error: '吐槽不存在' })
    const existing = db.get('SELECT 1 FROM complaint_likes WHERE complaint_id = ? AND user_id = ?', [id, req.userId])
    let liked
    if (existing) {
      db.run('DELETE FROM complaint_likes WHERE complaint_id = ? AND user_id = ?', [id, req.userId])
      liked = false
    } else {
      db.run('INSERT INTO complaint_likes (complaint_id, user_id, created_at) VALUES (?,?,?)', [id, req.userId, now()])
      liked = true
    }
    const cnt = db.get('SELECT COUNT(*) AS c FROM complaint_likes WHERE complaint_id = ?', [id])
    db.run('UPDATE complaints SET hot_score = ? WHERE id = ?', [recomputeHotScore(id), id])
    res.json({ liked, likeCount: Number(cnt?.c || 0) })
  })

  // ── 共鸣 toggle ──
  router.post('/complaints/:id/resonate', requireAuth, (req, res) => {
    const id = Number(req.params.id)
    if (!db.get('SELECT 1 FROM complaints WHERE id = ?', [id])) return res.status(404).json({ error: '吐槽不存在' })
    const existing = db.get('SELECT 1 FROM complaint_resonances WHERE complaint_id = ? AND user_id = ?', [id, req.userId])
    let resonated
    if (existing) {
      db.run('DELETE FROM complaint_resonances WHERE complaint_id = ? AND user_id = ?', [id, req.userId])
      resonated = false
    } else {
      db.run('INSERT INTO complaint_resonances (complaint_id, user_id, created_at) VALUES (?,?,?)', [id, req.userId, now()])
      resonated = true
    }
    const cnt = db.get('SELECT COUNT(*) AS c FROM complaint_resonances WHERE complaint_id = ?', [id])
    db.run('UPDATE complaints SET hot_score = ? WHERE id = ?', [recomputeHotScore(id), id])
    res.json({ resonated, resonanceCount: Number(cnt?.c || 0) })
  })

  // ── 热搜榜（top 10） ──
  router.get('/complaints/topics', requireAuth, (req, res) => {
    // 把每一条都重算热度一遍（feed 也做）
    const ids = db.all('SELECT id FROM complaints ORDER BY id DESC LIMIT 200')
    for (const r of ids) {
      db.run('UPDATE complaints SET hot_score = ? WHERE id = ?', [recomputeHotScore(r.id), r.id])
    }
    const rows = db.all(`
      SELECT c.id, c.content, c.category, c.sentiment, c.hot_score,
             (SELECT COUNT(*) FROM complaint_resonances WHERE complaint_id = c.id) AS resonance_count,
             (SELECT COUNT(*) FROM complaint_likes WHERE complaint_id = c.id) AS like_count
      FROM complaints c
      ORDER BY c.hot_score DESC, c.id DESC
      LIMIT 10`)
    res.json({ topics: rows.map((r) => ({
      id: String(r.id),
      snippet: r.content.length > 30 ? r.content.slice(0, 30) + '…' : r.content,
      category: r.category,
      sentiment: r.sentiment,
      hotScore: Number(r.hot_score || 0),
      resonanceCount: Number(r.resonance_count || 0),
      likeCount: Number(r.like_count || 0)
    })) })
  })

  // ── 评论列表（设计稿卡片：评论数 + 评论弹窗） ──
  router.get('/complaints/:id/comments', requireAuth, (req, res) => {
    const id = Number(req.params.id)
    if (!db.get('SELECT 1 FROM complaints WHERE id = ?', [id])) return res.status(404).json({ error: '吐槽不存在' })
    const rows = db.all(`
      SELECT cm.*, u.nickname AS author_name, u.avatar_symbol AS author_avatar
      FROM complaint_comments cm JOIN users u ON u.id = cm.user_id
      WHERE cm.complaint_id = ? ORDER BY cm.id ASC LIMIT 200`, [id])
    res.json({ comments: rows.map((r) => ({
      id: String(r.id),
      complaintId: String(r.complaint_id),
      userId: String(r.user_id),
      authorName: r.author_name,
      avatarSymbol: r.author_avatar,
      content: r.content,
      time: r.created_at
    })) })
  })

  // ── 发表评论 ──
  router.post('/complaints/:id/comments', requireAuth, (req, res) => {
    const id = Number(req.params.id)
    if (!db.get('SELECT 1 FROM complaints WHERE id = ?', [id])) return res.status(404).json({ error: '吐槽不存在' })
    const content = String(req.body?.content || '').trim()
    if (!content) return res.status(400).json({ error: '评论内容不能为空' })
    if (content.length > 300) return res.status(400).json({ error: '评论不能超过 300 字' })
    const risk = checkTextRisk(content)
    if (risk.isIllegal) return res.status(403).json({ error: risk.warning, matchedWords: risk.matchedWords, blocked: true })
    const r = db.run(
      'INSERT INTO complaint_comments (complaint_id, user_id, content, created_at) VALUES (?,?,?,?)',
      [id, req.userId, content, now()]
    )
    const me = db.get('SELECT nickname, avatar_symbol FROM users WHERE id = ?', [req.userId])
    res.status(201).json({ comment: {
      id: String(r.lastInsertRowid),
      complaintId: String(id),
      userId: String(req.userId),
      authorName: me?.nickname || '我',
      avatarSymbol: me?.avatar_symbol || '👤',
      content,
      time: now()
    } })
  })

  // ── 删除评论（仅本人或吐槽作者） ──
  router.delete('/complaints/:id/comments/:commentId', requireAuth, (req, res) => {
    const cid = Number(req.params.id)
    const commentId = Number(req.params.commentId)
    const row = db.get('SELECT * FROM complaint_comments WHERE id = ? AND complaint_id = ?', [commentId, cid])
    if (!row) return res.status(404).json({ error: '评论不存在' })
    const complaint = db.get('SELECT user_id FROM complaints WHERE id = ?', [cid])
    if (row.user_id !== req.userId && complaint?.user_id !== req.userId) {
      return res.status(403).json({ error: '无权删除' })
    }
    db.run('DELETE FROM complaint_comments WHERE id = ?', [commentId])
    res.json({ ok: true })
  })

  return router
}
