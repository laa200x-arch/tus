/**
 * 职场那些事后端入口（Node.js + Express + Socket.io + MySQL/SQLite）
 */
import express from 'express'
import cors from 'cors'
import http from 'node:http'
import path from 'node:path'
import { mkdirSync, unlinkSync } from 'node:fs'
import multer from 'multer'
import { config } from './config.js'
import { initDb, closeDb } from './db.js'
import { SQLITE_DDL, MYSQL_DDL } from './schema.js'
import { seed, ensureSampleApps, ensureSampleDomainData } from './seed.js'
import { requireAuth, serializeUser } from './middleware.js'
import { authRouter } from './routes/auth.js'
import { profileRouter } from './routes/profile.js'
import { socialRouter } from './routes/social.js'
import { chatRouter } from './routes/chat.js'
import { colleaguesRouter } from './routes/colleagues.js'
import { appsRouter } from './routes/apps.js'
import { complaintsRouter } from './routes/complaints.js'
import { moodRouter } from './routes/mood.js'
import { tagsRouter } from './routes/tags.js'
import { aiRouter } from './routes/ai.js'
import { radarRouter } from './routes/radar.js'
import { homeRouter } from './routes/home.js'
import { searchRouter } from './routes/search.js'
import { personaRouter } from './routes/persona.js'
import { analysisRouter } from './routes/analysis.js'
import { setupSocket } from './socket.js'
import { smsStatus } from './sms.js'

async function main() {
  console.log(`[tucao-server] 启动中... 数据库驱动: ${config.dbDriver}`)

  const db = await initDb()
  // 建表
  db.exec(config.dbDriver === 'mysql' ? MYSQL_DDL : SQLITE_DDL)
  // 轻量迁移：messages 表补充媒体字段
  try { db.exec('ALTER TABLE messages ADD COLUMN media_type TEXT') } catch { /* 列已存在 */ }
  try { db.exec('ALTER TABLE messages ADD COLUMN media_url TEXT') } catch { /* 列已存在 */ }
  try { db.exec('ALTER TABLE messages ADD COLUMN order_id TEXT') } catch { /* 列已存在 */ }
  // 轻量迁移：users 表补充头像 URL 列
  try { db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT') } catch { /* 列已存在 */ }
  // 轻量迁移：users 表补充手机号列（注册手机验证，一手机号一号）
  try { db.exec('ALTER TABLE users ADD COLUMN phone TEXT') } catch { /* 列已存在 */ }
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)') } catch { /* 索引已存在 */ }
  // v3 迁移：同事画像扩展列（品行系统/画像升级）
  const colleagueCols = ['age INTEGER', 'weight REAL', 'personality_score REAL', 'workplace_type TEXT', 'risk_level TEXT']
  for (const col of colleagueCols) {
    try { db.exec(`ALTER TABLE colleagues ADD COLUMN ${col}`) } catch { /* 列已存在 */ }
  }
  // 演示数据
  if (config.autoSeed) {
    await seed(db)
  }
  // 示例小程序（贪吃蛇，幂等补齐）+ 同事/公司/状态示例数据（幂等补齐）
  ensureSampleApps(db)
  ensureSampleDomainData(db)

  const app = express()
  // CORS：白名单配置化（CORS_ORIGINS）。原生客户端（无 Origin / file:// / null）始终放行；
  // 浏览器来源仅放行白名单，防第三方站点调用接口
  app.use(cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true) // 原生客户端/服务端请求
      if (origin === 'null' || origin.startsWith('file://')) return cb(null, true) // Electron 本地页面
      if (config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) return cb(null, true)
      return cb(null, false)
    }
  }))
  app.use(express.json({ limit: '5mb' }))

  // 健康检查
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'tucao-server', time: new Date().toISOString(), sms: smsStatus() })
  })

  // 版本检查（App 启动时轮询：仅当服务器 current 与客户端已提示版本不同时客户端才弹更新窗）
  app.get('/api/version', (req, res) => {
    res.json({
      current: '2.0.0',
      updateMessage: '职场那些事 v2.0.0 职场关系操作系统：吐槽广场 / 行为标签 / 情绪打卡 / 关系雷达 / AI 洞察 / 职场人格',
      downloadUrl: 'https://github.com/laa200x-arch/tus/releases'
    })
  })

  // 文件上传（聊天图片/视频，方案 2.3.3 资料传输）
  // 安全：MIME 白名单 + 扩展名白名单（拒绝 .html/.svg 等可执行内容，防存储型 XSS）
  const uploadDir = path.join(process.cwd(), 'uploads')
  mkdirSync(uploadDir, { recursive: true })
  const ALLOWED_MIME = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  ])
  const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm'])
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => {
        const ext = (path.extname(file.originalname || '').toLowerCase().slice(0, 10)) || '.jpg'
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ALLOWED_EXT.has(ext) ? ext : '.bin'}`)
      }
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB 上限（视频）
    fileFilter: (req, file, cb) => {
      // 注意：必须显式 cb(null, true) 接受；仅 cb(null) 会被 multer 视为拒绝
      const ok = ALLOWED_MIME.has(String(file.mimetype || '').toLowerCase())
      if (!ok) return cb(new Error('仅支持图片(jpg/png/gif/webp)与视频(mp4/mov/webm)'))
      cb(null, true)
    }
  })
  app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: '缺少文件' })
    // 头像等图片限制 2MB（视频仍 50MB）；超限删除已写入的文件
    const isImage = String(req.file.mimetype || '').startsWith('image/')
    if (isImage && req.file.size > 2 * 1024 * 1024) {
      try { unlinkSync(path.join(uploadDir, req.file.filename)) } catch {}
      return res.status(400).json({ error: '图片不能超过 2MB，请压缩后重试' })
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` })
  }, (err, req, res, next) => {
    res.status(400).json({ error: err.message || '上传失败' })
  })
  // 静态媒体目录：nosniff + attachment 下载头，杜绝 HTML/SVG 直接渲染执行
  app.use('/uploads', express.static(uploadDir, {
    maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Disposition', 'attachment')
      res.setHeader('Cache-Control', 'public, max-age=604800')
    }
  }))

  // 我的资料（客户端自动登录/一键切换账号使用；挂载在 /api 而非 /api/auth）
  app.get('/api/me', requireAuth, (req, res) => {
    const row = db.get('SELECT * FROM users WHERE id = ?', [req.userId])
    if (!row) return res.status(404).json({ error: '用户不存在' })
    res.json({ user: serializeUser(row, { includePhone: true }) })
  })

  // 路由
  app.use('/api/auth', authRouter(db))
  // 字典标签（公开，不需要登录；必须放在任何 requireAuth 的 router 之前，否则被截胡）
  app.use('/api', tagsRouter())
  app.use('/api', profileRouter(db))

  const httpServer = http.createServer(app)

  // 实时总线：聊天路由与 Socket 层共享 io 实例
  const chatBus = { io: null }
  const chat = chatRouter(db, chatBus)
  app.use('/api', chat.router)

  const io = setupSocket(httpServer, db, chat)
  chatBus.io = io

  // 社交路由（同事状态）
  app.use('/api', socialRouter(db, io))
  // 同事属性域（公司 / 同事档案）
  app.use('/api', colleaguesRouter(db))
  // 小程序市场
  app.use('/api', appsRouter(db))
  // 职场关系操作系统 v2
  app.use('/api', complaintsRouter(db, io))    // 吐槽广场
  app.use('/api', moodRouter(db))              // 情绪打卡
  app.use('/api', aiRouter(db))                // AI 自动识别 / 关系总结 / 人格
  app.use('/api', radarRouter(db))             // 同事关系雷达打分
  app.use('/api', homeRouter(db))              // 首页统计聚合（Dashboard 4 卡片）
  app.use('/api', searchRouter(db))            // 全局搜索（同事/公司/话题）
  app.use('/api', personaRouter(db))           // 同事品行六维 + 行为预测（v3）
  app.use('/api', analysisRouter(db))          // 聊天记录 AI 分析（v3）

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: `接口不存在: ${req.method} ${req.path}` })
  })

  // 全局错误处理（body-parser 解析错误返回 400 而非 500）
  app.use((err, req, res, next) => {
    console.error('[error]', err)
    const status = err.statusCode || err.status || 500
    const message = err.type === 'entity.parse.failed' ? '请求格式错误' : '服务器内部错误'
    res.status(status).json({ error: message })
  })

  httpServer.listen(config.port, () => {
    console.log(`[tucao-server] 已启动: http://localhost:${config.port}`)
    console.log(`[tucao-server] 健康检查: http://localhost:${config.port}/api/health`)
    const sms = smsStatus()
    console.log(
      `[tucao-server] 短信通道: ${sms.provider}${sms.configured ? '' : '（未配置完整，发送会失败/降级）'}` +
        `${sms.devFallback ? '，SMS_DEV_FALLBACK=1（失败降级 devCode，生产请置 0）' : '，SMS_DEV_FALLBACK=0（失败即报错）'}`
    )
  })

  const shutdown = () => {
    console.log('\n[tucao-server] 正在关闭...')
    try { io.close() } catch {}
    httpServer.close(() => {
      closeDb()
      process.exit(0)
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('[tucao-server] 启动失败:', err)
  process.exit(1)
})
