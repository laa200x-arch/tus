/**
 * 全局搜索（设计稿首页搜索框：同事 / 公司 / 话题）
 * - GET /api/search?q=  → { complaints, colleagues, companies }
 */
import { Router } from 'express'
import { requireAuth } from '../middleware.js'

export function searchRouter(db) {
  const router = Router()

  router.get('/search', requireAuth, (req, res) => {
    const q = String(req.query.q || '').trim()
    if (!q) return res.json({ query: '', complaints: [], colleagues: [], companies: [] })
    const like = `%${q}%`

    // 吐槽（全站，含匿名——匿名只给内容与时间，不给作者）
    const complaints = db.all(
      `SELECT id, content, category, sentiment, is_anonymous, created_at
       FROM complaints WHERE content LIKE ? ORDER BY id DESC LIMIT 20`, [like]
    ).map((r) => ({
      id: String(r.id),
      content: r.content,
      snippet: r.content.length > 40 ? r.content.slice(0, 40) + '…' : r.content,
      isAnonymous: !!r.is_anonymous,
      category: r.category || null,
      sentiment: r.sentiment || null,
      time: r.created_at
    }))

    // 同事（仅我自己的档案）
    const colleagues = db.all(
      `SELECT id, name, position, department, company_id FROM colleagues
       WHERE user_id = ? AND (name LIKE ? OR position LIKE ? OR department LIKE ?) ORDER BY id DESC LIMIT 20`,
      [req.userId, like, like, like]
    ).map((r) => ({ id: String(r.id), name: r.name, position: r.position || '', department: r.department || '', companyId: r.company_id ? String(r.company_id) : null }))

    // 公司（仅我自己的）
    const companies = db.all(
      `SELECT id, name, industry, scale FROM companies
       WHERE user_id = ? AND (name LIKE ? OR industry LIKE ?) ORDER BY id DESC LIMIT 20`,
      [req.userId, like, like]
    ).map((r) => ({ id: String(r.id), name: r.name, industry: r.industry || '', scale: r.scale || '' }))

    res.json({ query: q, complaints, colleagues, companies })
  })

  return router
}
