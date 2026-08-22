/**
 * AI 职场心理分析（v3 核心壁垒·聊天记录分析）
 * - POST /api/analysis/chat  body: { text } 或 { messages: [{ sender?, text, time? }] }
 *   返回：统计 / 情绪分布 / 沟通模式 / 建议话术（本地规则引擎，无外部依赖）
 */
import { Router } from 'express'
import { requireAuth } from '../middleware.js'

const POS_WORDS = ['好', '行', 'ok', 'OK', '辛苦', '感谢', '谢谢', '没问题', '搞定', '可以', '顺利', '不错', '收到', '了解', '支持']
const NEG_WORDS = ['烦', '累', '不行', '搞不定', '怎么又', '无语', '崩溃', '难受', '生气', '讨厌', '离谱', '失望', '坑', '背锅', '加班', '催']
const COMMAND_WORDS = ['马上', '立刻', '必须', '赶紧', '尽快', '现在就要', '今天必须']
const BLAME_WORDS = ['你自己', '不关我事', '我不管', '反正', '我的问题？', '又不是我', '跟我没关系', '谁让你']
const NIGHT_HOURS = [22, 23, 0, 1, 2, 3, 4, 5, 6, 7]

export function analysisRouter(db) {
  const router = Router()

  router.post('/analysis/chat', requireAuth, (req, res) => {
    const body = req.body || {}
    let lines = []
    if (Array.isArray(body.messages)) {
      lines = body.messages.map((m) => ({
        sender: String(m.sender || '对方'),
        text: String(m.text || ''),
        time: m.time ? new Date(m.time) : null
      }))
    } else {
      lines = String(body.text || '').split(/\n+/).filter((s) => s.trim()).map((t, i) => ({
        sender: i % 2 === 0 ? '我' : '对方',
        text: t.trim(),
        time: null
      }))
    }
    if (!lines.length) return res.status(400).json({ error: '请提供聊天记录文本' })
    if (lines.length > 500) return res.status(400).json({ error: '单次最多分析 500 条消息' })

    // 统计
    const total = lines.length
    const participants = [...new Set(lines.map((l) => l.sender))].slice(0, 10)

    // 情绪分布
    let positive = 0, negative = 0
    for (const l of lines) {
      const t = l.text
      const hasPos = POS_WORDS.some((w) => t.includes(w))
      const hasNeg = NEG_WORDS.some((w) => t.includes(w))
      if (hasPos && !hasNeg) positive++
      else if (hasNeg && !hasPos) negative++
    }
    const neutral = Math.max(0, total - positive - negative)
    const pct = (n) => Math.round((n / total) * 100)

    // 沟通模式
    const patterns = []
    const cmdCount = lines.filter((l) => COMMAND_WORDS.some((w) => l.text.includes(w))).length
    const blameCount = lines.filter((l) => BLAME_WORDS.some((w) => l.text.includes(w))).length
    const nightCount = lines.filter((l) => l.time && NIGHT_HOURS.includes(l.time.getHours())).length
    const questionCount = lines.filter((l) => /[？?]/.test(l.text)).length
    if (cmdCount / total >= 0.1) patterns.push({ key: 'command', label: '命令式表达', count: cmdCount, ratio: Math.round((cmdCount / total) * 100) })
    if (blameCount > 0) patterns.push({ key: 'blame', label: '甩锅/推责倾向', count: blameCount, ratio: Math.round((blameCount / total) * 100) })
    if (nightCount > 0) patterns.push({ key: 'night', label: '深夜/清晨消息', count: nightCount, ratio: Math.round((nightCount / total) * 100) })
    if (questionCount / total >= 0.15) patterns.push({ key: 'question', label: '提问驱动沟通', count: questionCount, ratio: Math.round((questionCount / total) * 100) })
    if (!patterns.length) patterns.push({ key: 'balanced', label: '沟通模式均衡', count: 0, ratio: 0 })

    // 平均回复时长（messages 带 time 且 sender 交替时估算）
    let avgReplyHours = null
    if (lines.some((l) => l.time) && participants.length >= 2) {
      const times = lines.filter((l) => l.time).map((l) => l.time.getTime()).sort((a, b) => a - b)
      const gaps = []
      for (let i = 1; i < times.length; i++) {
        const h = (times[i] - times[i - 1]) / 3600000
        if (h > 0.01 && h < 24 * 7) gaps.push(h)
      }
      if (gaps.length) avgReplyHours = Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10
    }

    // 建议话术（规则）
    const suggestions = []
    if (pct(negative) >= 30) suggestions.push('负面情绪占比偏高，沟通前先确认目标和边界，避免情绪化回应。')
    if (patterns.some((p) => p.key === 'command')) suggestions.push('对方习惯命令式表达，建议用「为了保证效果，需要确认三个点」替代直接拒绝。')
    if (patterns.some((p) => p.key === 'blame')) suggestions.push('涉及责任问题时，用文字留痕（邮件/群记录）明确分工，减少口头扯皮。')
    if (patterns.some((p) => p.key === 'night')) suggestions.push('深夜/清晨消息较多，可设置免打扰，并在工作时段统一回复以明确边界。')
    if (avgReplyHours != null && avgReplyHours < 1) suggestions.push('对方回复效率较高，继续保持清晰、简洁的表达方式。')
    if (!suggestions.length) suggestions.push('整体沟通健康，继续保持文字确认关键事项的习惯。')

    res.json({
      total,
      participants,
      avgReplyHours,
      sentiment: { positive: pct(positive), neutral: pct(neutral), negative: pct(negative) },
      patterns,
      suggestions,
      disclaimer: '基于本地规则引擎的估算，供参考，不构成对人的定性判断。'
    })
  })

  return router
}
