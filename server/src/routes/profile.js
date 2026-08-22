/**
 * 个人档案路由：资料编辑 / 公开用户搜索（用于私聊找人）
 * 职场那些事已移除技能 / 认证 / 曝光的互换属性。
 */
import { Router } from 'express'
import { requireAuth, serializeUser } from '../middleware.js'
import { checkTextRisk } from '../risk.js'

export function profileRouter(db) {
  const router = Router()
  router.use(requireAuth)

  // 更新资料（昵称 / 简介 / 位置 / 头像）
  router.put('/me/profile', (req, res) => {
    const { nickname, bio, locationLabel, avatarUrl } = req.body || {}
    const riskText = [bio, nickname].filter((x) => x !== undefined).join(' ')
    if (riskText) {
      const risk = checkTextRisk(riskText)
      if (risk.isIllegal) return res.status(403).json({ error: risk.warning, matchedWords: risk.matchedWords })
    }
    db.run(
      `UPDATE users SET nickname = COALESCE(?, nickname), bio = COALESCE(?, bio), location_label = COALESCE(?, location_label),
        avatar_url = COALESCE(?, avatar_url) WHERE id = ?`,
      [nickname ?? null, bio ?? null, locationLabel ?? null, avatarUrl ?? null, req.userId]
    )
    const row = db.get('SELECT * FROM users WHERE id = ?', [req.userId])
    res.json({ user: serializeUser(row, { includePhone: true }) })
  })

  // 用户列表（公开档案，用于私聊搜索；?keyword= 按昵称/用户名模糊搜索）
  router.get('/users', (req, res) => {
    const keyword = String(req.query.keyword || '').trim()
    let rows
    if (keyword) {
      rows = db.all(
        `SELECT * FROM users WHERE nickname LIKE ? OR username LIKE ? ORDER BY id ASC LIMIT 50`,
        [`%${keyword}%`, `%${keyword}%`]
      )
    } else {
      rows = db.all('SELECT * FROM users ORDER BY id ASC')
    }
    res.json({ users: rows.map((row) => serializeUser(row)) })
  })

  router.get('/users/:id', (req, res) => {
    const row = db.get('SELECT * FROM users WHERE id = ?', [req.params.id])
    if (!row) return res.status(404).json({ error: '用户不存在' })
    res.json({ user: serializeUser(row) })
  })

  return router
}
