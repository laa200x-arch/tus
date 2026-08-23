/**
 * 同事属性域（职场那些事核心数据）：
 * - 公司档案 companies CRUD
 * - 同事档案 colleagues CRUD（关联公司）
 * 均为本人私有数据（user_id 隔离）。
 */
import { Router } from 'express'
import { requireAuth } from '../middleware.js'
import { checkTextRisk } from '../risk.js'

export function colleaguesRouter(db) {
  const router = Router()
  router.use(requireAuth)
  const now = () => new Date().toISOString()

  // ---------- 公司属性 ----------
  const serializeCompany = (row) => ({
    id: String(row.id),
    name: row.name,
    industry: row.industry || '',
    scale: row.scale || '',
    overtimeCulture: row.overtime_culture || '',
    welfare: row.welfare || '',
    location: row.location || ''
  })

  router.get('/companies', (req, res) => {
    const rows = db.all('SELECT * FROM companies WHERE user_id = ? ORDER BY id DESC', [req.userId])
    res.json({ companies: rows.map(serializeCompany) })
  })

  router.post('/companies', (req, res) => {
    const { name, industry, scale, overtimeCulture, welfare, location } = req.body || {}
    if (!name || !String(name).trim()) return res.status(400).json({ error: '公司名必填' })
    const risk = checkTextRisk(String(name))
    if (risk.isIllegal) return res.status(403).json({ error: risk.warning })
    const r = db.run(
      `INSERT INTO companies (user_id, name, industry, scale, overtime_culture, welfare, location, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [req.userId, String(name).trim(),
        String(industry || '').trim(), String(scale || '').trim(),
        String(overtimeCulture || '').trim(), String(welfare || '').trim(),
        String(location || '').trim(), now()]
    )
    res.status(201).json({ company: serializeCompany(db.get('SELECT * FROM companies WHERE id = ?', [r.lastInsertRowid])) })
  })

  router.put('/companies/:id', (req, res) => {
    const row = db.get('SELECT * FROM companies WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    if (!row) return res.status(404).json({ error: '公司不存在' })
    const { name, industry, scale, overtimeCulture, welfare, location } = req.body || {}
    db.run(
      `UPDATE companies SET name = COALESCE(?, name), industry = COALESCE(?, industry), scale = COALESCE(?, scale),
        overtime_culture = COALESCE(?, overtime_culture), welfare = COALESCE(?, welfare), location = COALESCE(?, location)
       WHERE id = ?`,
      [name != null ? String(name).trim() : null,
        industry != null ? String(industry).trim() : null,
        scale != null ? String(scale).trim() : null,
        overtimeCulture != null ? String(overtimeCulture).trim() : null,
        welfare != null ? String(welfare).trim() : null,
        location != null ? String(location).trim() : null,
        row.id]
    )
    res.json({ company: serializeCompany(db.get('SELECT * FROM companies WHERE id = ?', [row.id])) })
  })

  router.delete('/companies/:id', (req, res) => {
    // 解除关联到该公司的同事（company_id 置空，不级联删除同事）
    db.run('UPDATE colleagues SET company_id = NULL WHERE user_id = ? AND company_id = ?', [req.userId, req.params.id])
    const r = db.run('DELETE FROM companies WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    if (r.changes === 0) return res.status(404).json({ error: '公司不存在' })
    res.json({ ok: true })
  })

  // ---------- 同事档案 ----------
  const serializeColleague = (row) => ({
    id: String(row.id),
    name: row.name,
    position: row.position || '',
    department: row.department || '',
    relation: row.relation || '',
    attributeTags: row.attribute_tags ? JSON.parse(row.attribute_tags) : [],
    companyId: row.company_id != null ? String(row.company_id) : null,
    notes: row.notes || '',
    avatarSymbol: row.avatar_symbol || '👤',
    // v3 画像扩展：年龄/体重/性格指数/职场类型/风险等级
    age: row.age != null ? Number(row.age) : null,
    weight: row.weight != null ? Number(row.weight) : null,
    personalityScore: row.personality_score != null ? Number(row.personality_score) : null,
    workplaceType: row.workplace_type || null,
    riskLevel: row.risk_level || null,
    // v3.1：照片头像 + 经典语录
    avatarUrl: row.avatar_url || null,
    quote: row.quote || ''
  })

  router.get('/colleagues', (req, res) => {
    const rows = db.all('SELECT * FROM colleagues WHERE user_id = ? ORDER BY id DESC', [req.userId])
    res.json({ colleagues: rows.map(serializeColleague) })
  })

  router.post('/colleagues', (req, res) => {
    const { name, position, department, relation, attributeTags, companyId, notes, avatarSymbol,
      age, weight, personalityScore, workplaceType, riskLevel, avatarUrl, quote } = req.body || {}
    if (!name || !String(name).trim()) return res.status(400).json({ error: '姓名/昵称必填' })
    const risk = checkTextRisk(String(name))
    if (risk.isIllegal) return res.status(403).json({ error: risk.warning })
    const tags = Array.isArray(attributeTags) ? attributeTags.slice(0, 30) : []
    const r = db.run(
      `INSERT INTO colleagues (user_id, name, position, department, relation, attribute_tags, company_id, notes, avatar_symbol,
        age, weight, personality_score, workplace_type, risk_level, avatar_url, quote, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.userId, String(name).trim(), String(position || '').trim(), String(department || '').trim(),
        String(relation || '').trim(), JSON.stringify(tags),
        companyId ? Number(companyId) : null, String(notes || '').trim(),
        String(avatarSymbol || '👤'),
        age != null && age !== '' ? Number(age) : null,
        weight != null && weight !== '' ? Number(weight) : null,
        personalityScore != null && personalityScore !== '' ? Number(personalityScore) : null,
        workplaceType ? String(workplaceType).slice(0, 32) : null,
        riskLevel ? String(riskLevel).slice(0, 16) : null,
        avatarUrl ? String(avatarUrl).slice(0, 255) : null,
        String(quote || '').trim().slice(0, 500),
        now()]
    )
    res.status(201).json({ colleague: serializeColleague(db.get('SELECT * FROM colleagues WHERE id = ?', [r.lastInsertRowid])) })
  })

  router.put('/colleagues/:id', (req, res) => {
    const row = db.get('SELECT * FROM colleagues WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    if (!row) return res.status(404).json({ error: '同事不存在' })
    const { name, position, department, relation, attributeTags, companyId, notes, avatarSymbol,
      age, weight, personalityScore, workplaceType, riskLevel, avatarUrl, quote } = req.body || {}
    const tags = Array.isArray(attributeTags) ? attributeTags.slice(0, 30) : row.attribute_tags ? JSON.parse(row.attribute_tags) : []
    db.run(
      `UPDATE colleagues SET name = COALESCE(?, name), position = COALESCE(?, position), department = COALESCE(?, department),
        relation = COALESCE(?, relation), attribute_tags = ?, company_id = COALESCE(?, company_id),
        notes = COALESCE(?, notes), avatar_symbol = COALESCE(?, avatar_symbol),
        age = COALESCE(?, age), weight = COALESCE(?, weight), personality_score = COALESCE(?, personality_score),
        workplace_type = COALESCE(?, workplace_type), risk_level = COALESCE(?, risk_level),
        avatar_url = COALESCE(?, avatar_url), quote = COALESCE(?, quote)
       WHERE id = ?`,
      [name != null ? String(name).trim() : null,
        position != null ? String(position).trim() : null,
        department != null ? String(department).trim() : null,
        relation != null ? String(relation).trim() : null,
        JSON.stringify(tags),
        companyId != null ? (companyId ? Number(companyId) : null) : row.company_id,
        notes != null ? String(notes).trim() : null,
        avatarSymbol != null ? String(avatarSymbol) : null,
        age != null && age !== '' ? Number(age) : null,
        weight != null && weight !== '' ? Number(weight) : null,
        personalityScore != null && personalityScore !== '' ? Number(personalityScore) : null,
        workplaceType != null ? String(workplaceType).slice(0, 32) : null,
        riskLevel != null ? String(riskLevel).slice(0, 16) : null,
        avatarUrl != null ? String(avatarUrl).slice(0, 255) : null,
        quote != null ? String(quote).trim().slice(0, 500) : null,
        row.id]
    )
    res.json({ colleague: serializeColleague(db.get('SELECT * FROM colleagues WHERE id = ?', [row.id])) })
  })

  router.delete('/colleagues/:id', (req, res) => {
    const r = db.run('DELETE FROM colleagues WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    if (r.changes === 0) return res.status(404).json({ error: '同事不存在' })
    res.json({ ok: true })
  })

  return router
}
