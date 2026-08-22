/**
 * 社交路由：同事状态（吐槽动态）
 * - GET  /statuses            时间倒序返回全部状态（含作者与关联同事名）
 * - POST /statuses            发布一条状态（内容前置风控）
 * - DELETE /statuses/:id      删除自己的状态
 */
import { Router } from 'express'
import { requireAuth, serializeUser } from '../middleware.js'
import { checkTextRisk } from '../risk.js'

export function socialRouter(db) {
  const router = Router()
  router.use(requireAuth)
  const now = () => new Date().toISOString()

  const serializeStatus = (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    authorName: row.author_name,
    avatarSymbol: row.author_avatar || '👤',
    content: row.content,
    colleagueName: row.colleague_name || null,
    themeTags: row.theme_tags ? JSON.parse(row.theme_tags) : [],
    softwareTags: row.software_tags ? JSON.parse(row.software_tags) : [],
    mood: row.mood || null,
    time: row.created_at
  })

  // ── 列表 ──
  router.get('/statuses', (req, res) => {
    const rows = db.all(`
      SELECT s.*, u.nickname AS author_name, u.avatar_symbol AS author_avatar,
             c.name AS colleague_name
      FROM colleague_statuses s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN colleagues c ON c.id = s.colleague_id
      ORDER BY s.id DESC LIMIT 200`)
    res.json({ statuses: rows.map(serializeStatus) })
  })

  // ── 发布 ──
  router.post('/statuses', (req, res) => {
    const content = String(req.body?.content || '').trim()
    if (!content) return res.status(400).json({ error: '内容不能为空' })
    if (content.length > 2000) return res.status(400).json({ error: '内容不能超过 2000 字' })
    const risk = checkTextRisk(content)
    if (risk.isIllegal) {
      return res.status(403).json({ error: risk.warning, matchedWords: risk.matchedWords, blocked: true })
    }
    const colleagueId = req.body?.colleagueId ? Number(req.body.colleagueId) : null
    const themeTags = Array.isArray(req.body?.themeTags) ? req.body.themeTags.slice(0, 20) : []
    const softwareTags = Array.isArray(req.body?.softwareTags) ? req.body.softwareTags.slice(0, 20) : []
    const mood = req.body?.mood ? String(req.body.mood) : null

    const r = db.run(
      `INSERT INTO colleague_statuses (user_id, colleague_id, content, theme_tags, software_tags, mood, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [req.userId, colleagueId, content, JSON.stringify(themeTags), JSON.stringify(softwareTags), mood, now()]
    )
    const row = db.get(`
      SELECT s.*, u.nickname AS author_name, u.avatar_symbol AS author_avatar,
             c.name AS colleague_name
      FROM colleague_statuses s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN colleagues c ON c.id = s.colleague_id
      WHERE s.id = ?`, [r.lastInsertRowid])
    res.status(201).json({ status: serializeStatus(row) })
  })

  // ── 删除（仅本人） ──
  router.delete('/statuses/:id', (req, res) => {
    const r = db.run('DELETE FROM colleague_statuses WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    if (r.changes === 0) return res.status(404).json({ error: '状态不存在或无权删除' })
    res.json({ ok: true })
  })

  return router
}
