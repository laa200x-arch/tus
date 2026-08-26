/**
 * 职场那些事后端端到端冒烟测试
 * 运行：node test/smoke.mjs  （需先启动服务：npm start）
 * 覆盖：健康 / 鉴权 / 当前职场关系接口 / REST 与 Socket 聊天风控 / 注册手机号唯一性
 */
import { io as createClient } from 'socket.io-client'
import { api as requestApi, waitForMessages, withFixtureCleanup } from './smoke-helpers.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

let passed = 0
let failed = 0

function check(name, cond, extra = '') {
  if (cond) {
    passed++
    console.log(`  ✅ ${name}${extra ? ` — ${extra}` : ''}`)
  } else {
    failed++
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`)
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function responseObject(name, response, expectedStatus = 200) {
  const ok = response.status === expectedStatus && isObject(response.data)
  check(name, ok, `status=${response.status}`)
  return ok ? response.data : null
}

function responseArray(name, response, key, expectedStatus = 200) {
  const data = responseObject(name, response, expectedStatus)
  const value = data && Array.isArray(data[key]) ? data[key] : null
  if (!value) check(`${name} 包含 ${key} 数组`, false, `status=${response.status}`)
  return value || []
}

function hasFields(value, fields) {
  return isObject(value) && fields.every((field) => Object.hasOwn(value, field))
}

function connectSocket(socket, name) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      check(`${name} Socket 连接`, false, '超时')
      resolve(false)
    }, 5000)
    socket.once('connect', () => {
      clearTimeout(timeout)
      check(`${name} Socket 连接`, true)
      resolve(true)
    })
    socket.once('connect_error', (error) => {
      clearTimeout(timeout)
      check(`${name} Socket 连接`, false, error.message)
      resolve(false)
    })
  })
}

function socketSend(socket, payload, name) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      check(name, false, '确认超时')
      resolve(null)
    }, 5000)
    socket.emit('chat:send', payload, (ack) => {
      clearTimeout(timeout)
      resolve(ack)
    })
  })
}

async function api(path, { method = 'GET', token, body } = {}) {
  return requestApi(path, { method, token, body }, { base: BASE })
}

console.log('══════ 职场那些事后端冒烟测试 ══════\n')

// 1. 健康检查
{
  const health = await api('/api/health')
  const data = responseObject('健康检查响应', health)
  check('健康检查', data?.ok === true, `status=${health.status}`)
}

// 2. 演示账号与登录失败
let aqingToken = null
let linxiaoToken = null
let linxiaoId = null
{
  const login = await api('/api/auth/login', {
    method: 'POST', body: { username: 'aqing', password: '123456' }
  })
  const data = responseObject('登录 aqing 响应', login)
  const valid = !!data?.token && hasFields(data?.user, ['id', 'userName'])
  check('登录 aqing', valid, `status=${login.status}`)
  if (valid) aqingToken = data.token
}
{
  const login = await api('/api/auth/login', {
    method: 'POST', body: { username: 'linxiao', password: '123456' }
  })
  const data = responseObject('登录 linxiao 响应', login)
  const valid = !!data?.token && hasFields(data?.user, ['id', 'userName'])
  check('登录 linxiao', valid, `status=${login.status}`)
  if (valid) {
    linxiaoToken = data.token
    linxiaoId = data.user.id
  }
}
{
  const login = await api('/api/auth/login', {
    method: 'POST', body: { username: 'aqing', password: 'wrongpass' }
  })
  check('错误密码被拒绝', login.status === 401, `status=${login.status}`)
}

// 3. 当前标签字典（公开接口）
{
  const tags = await api('/api/tags')
  const data = responseObject('标签字典响应', tags)
  check('16 个同事类型', Array.isArray(data?.colleagueTypes) && data.colleagueTypes.length === 16)
  check('14 个行为标签', Array.isArray(data?.behaviorTags) && data.behaviorTags.length === 14)
  check('27 个当前基础情绪', Array.isArray(data?.moods) && data.moods.length === 27)
  check('10 个压力来源', Array.isArray(data?.stressSources) && data.stressSources.length === 10)
}

// 4. REST 聊天：建立会话、文本风控与正常消息
let conversationId = null
if (aqingToken && linxiaoId) {
  const opened = await api('/api/conversations/open', {
    method: 'POST', token: aqingToken, body: { partnerId: linxiaoId }
  })
  const data = responseObject('REST 聊天会话响应', opened)
  const valid = hasFields(data?.conversation, ['id', 'partner'])
  check('建立 REST 聊天会话', valid, `status=${opened.status}`)
  if (valid) conversationId = data.conversation.id
} else {
  check('建立 REST 聊天会话', false, '缺少已验证的演示账号')
}

if (aqingToken && conversationId) {
  const blocked = await api('/api/messages', {
    method: 'POST', token: aqingToken,
    body: { conversationId, text: '这个课程多少钱？' }
  })
  const data = responseObject('REST 风控消息响应', blocked, 201)
  check('REST 违禁消息被拦截', data?.blocked === true && isObject(data?.message), `status=${blocked.status}`)

  const messages = await api(`/api/conversations/${conversationId}/messages`, { token: aqingToken })
  const list = responseArray('REST 聊天记录响应', messages, 'messages')
  const last = list.at(-1)
  check('REST 拦截后追加系统提示', last?.isSystemNote === true && last?.text?.includes('违禁词') === true)

  const normal = await api('/api/messages', {
    method: 'POST', token: aqingToken,
    body: { conversationId, text: `冒烟正常 REST 聊天 ${runId}` }
  })
  const normalData = responseObject('REST 正常消息响应', normal, 201)
  check('REST 正常消息发送成功', normalData?.blocked !== true && isObject(normalData?.message), `status=${normal.status}`)
} else {
  check('REST 违禁消息被拦截', false, '缺少已验证的会话')
  check('REST 拦截后追加系统提示', false, '缺少已验证的会话')
  check('REST 正常消息发送成功', false, '缺少已验证的会话')
}

// 5. 吐槽：创建、广场、点赞、共鸣、删除
let complaintId = null
if (aqingToken) {
  await withFixtureCleanup(async () => {
    const created = await api('/api/complaints', {
      method: 'POST', token: aqingToken,
      body: {
        content: `冒烟吐槽 ${runId}`,
        category: 'leader',
        behaviorTags: ['meeting_bs'],
        sentiment: 'tired'
      }
    })
    const data = responseObject('创建吐槽响应', created, 201)
    const valid = hasFields(data?.complaint, ['id', 'content', 'likeCount', 'resonanceCount'])
    check('创建吐槽', valid, `status=${created.status}`)
    if (valid) complaintId = data.complaint.id

    if (complaintId) {
      const feed = await api('/api/complaints/feed?sort=new', { token: aqingToken })
      const complaints = responseArray('吐槽广场响应', feed, 'complaints')
      check('吐槽出现在广场', complaints.some((complaint) => complaint?.id === complaintId))

      const liked = await api(`/api/complaints/${complaintId}/like`, { method: 'POST', token: aqingToken })
      const likeData = responseObject('吐槽点赞响应', liked)
      check('点赞吐槽', likeData?.liked === true && Number.isFinite(likeData?.likeCount), `status=${liked.status}`)

      const resonated = await api(`/api/complaints/${complaintId}/resonate`, { method: 'POST', token: aqingToken })
      const resonanceData = responseObject('吐槽共鸣响应', resonated)
      check('共鸣吐槽', resonanceData?.resonated === true && Number.isFinite(resonanceData?.resonanceCount), `status=${resonated.status}`)
    } else {
      check('吐槽出现在广场', false, '创建响应缺少 complaint 对象')
      check('点赞吐槽', false, '创建响应缺少 complaint id')
      check('共鸣吐槽', false, '创建响应缺少 complaint id')
      check('删除吐槽', false, '创建响应缺少 complaint id')
    }
  }, async () => {
    if (complaintId) {
      const deleted = await api(`/api/complaints/${complaintId}`, { method: 'DELETE', token: aqingToken })
      const deleteData = responseObject('删除吐槽响应', deleted)
      check('删除吐槽', deleteData?.ok === true, `status=${deleted.status}`)
      complaintId = null
    }
  })
} else {
  check('创建吐槽', false, '缺少 aqing token')
  check('吐槽出现在广场', false, '缺少 aqing token')
  check('点赞吐槽', false, '缺少 aqing token')
  check('共鸣吐槽', false, '缺少 aqing token')
  check('删除吐槽', false, '缺少 aqing token')
}

// 6. 情绪：同日 upsert、今日和趋势
if (aqingToken) {
  const first = await api('/api/mood/checkin', {
    method: 'POST', token: aqingToken,
    body: { mood: 'xnz_composed', stressSources: ['meeting'], note: `第一次打卡 ${runId}` }
  })
  const firstData = responseObject('首次情绪打卡响应', first)
  check('首次情绪打卡', firstData?.ok === true && typeof firstData?.date === 'string', `status=${first.status}`)

  const secondNote = `同日更新 ${runId}`
  const second = await api('/api/mood/checkin', {
    method: 'POST', token: aqingToken,
    body: { mood: 'xnz_happy', stressSources: ['coworker'], note: secondNote }
  })
  const secondData = responseObject('同日情绪更新响应', second)
  check('同日情绪打卡 upsert', secondData?.ok === true && secondData?.mood === 'xnz_happy' && secondData?.note === secondNote,
    `status=${second.status}`)

  const today = await api('/api/mood/today', { token: aqingToken })
  const todayData = responseObject('今日情绪响应', today)
  check('今日情绪反映 upsert', todayData?.checked === true && todayData?.mood === 'xnz_happy' && todayData?.note === secondNote,
    `status=${today.status}`)

  const trends = await api('/api/mood/trends?days=7', { token: aqingToken })
  const trend = responseArray('情绪趋势响应', trends, 'trend')
  check('情绪趋势包含今日更新', trend.some((item) => item?.date === todayData?.date && item?.mood === 'xnz_happy'))
} else {
  check('首次情绪打卡', false, '缺少 aqing token')
  check('同日情绪打卡 upsert', false, '缺少 aqing token')
  check('今日情绪反映 upsert', false, '缺少 aqing token')
  check('情绪趋势包含今日更新', false, '缺少 aqing token')
}

// 7. 同事、关系雷达、关系总结和清理
let colleagueId = null
if (aqingToken) {
  await withFixtureCleanup(async () => {
    const created = await api('/api/colleagues', {
      method: 'POST', token: aqingToken,
      body: { name: `冒烟同事 ${runId}`, position: '工程师', relation: '同组', attributeTags: ['techstar'] }
    })
    const data = responseObject('创建同事响应', created, 201)
    const valid = hasFields(data?.colleague, ['id', 'name', 'attributeTags'])
    check('创建同事', valid, `status=${created.status}`)
    if (valid) colleagueId = data.colleague.id

    if (colleagueId) {
      const scores = { cooperation: 81, expertise: 82, communication: 83, support: 84, trust: 85 }
      const posted = await api(`/api/radar/${colleagueId}`, {
        method: 'POST', token: aqingToken, body: { scores }
      })
      const postData = responseObject('关系雷达提交响应', posted)
      check('提交关系雷达', postData?.ok === true && hasFields(postData?.scores, Object.keys(scores)), `status=${posted.status}`)

      const fetched = await api(`/api/radar/${colleagueId}`, { token: aqingToken })
      const getData = responseObject('关系雷达查询响应', fetched)
      check('读取关系雷达', getData?.scored === true && getData?.scores?.trust === scores.trust, `status=${fetched.status}`)

      const relationship = await api(`/api/ai/relationship/${colleagueId}`, { token: aqingToken })
      const relationshipData = responseObject('关系总结响应', relationship)
      check('关系总结文档形状', hasFields(relationshipData, [
        'colleagueId', 'colleagueName', 'radar', 'healthScore', 'relationType',
        'conflicts', 'topBehaviors', 'suggestions', 'disclaimer'
      ]) && Array.isArray(relationshipData?.conflicts) && Array.isArray(relationshipData?.suggestions), `status=${relationship.status}`)
    } else {
      check('提交关系雷达', false, '创建响应缺少 colleague id')
      check('读取关系雷达', false, '创建响应缺少 colleague id')
      check('关系总结文档形状', false, '创建响应缺少 colleague id')
      check('删除同事', false, '创建响应缺少 colleague id')
    }
  }, async () => {
    if (colleagueId) {
      const deleted = await api(`/api/colleagues/${colleagueId}`, { method: 'DELETE', token: aqingToken })
      const deleteData = responseObject('删除同事响应', deleted)
      check('删除同事', deleteData?.ok === true, `status=${deleted.status}`)
      colleagueId = null
    }
  })
} else {
  check('创建同事', false, '缺少 aqing token')
  check('提交关系雷达', false, '缺少 aqing token')
  check('读取关系雷达', false, '缺少 aqing token')
  check('关系总结文档形状', false, '缺少 aqing token')
  check('删除同事', false, '缺少 aqing token')
}

// 8. 首页统计和职场人格的文档形状
if (aqingToken) {
  const home = await api('/api/home/stats', { token: aqingToken })
  const homeData = responseObject('首页统计响应', home)
  check('首页统计文档形状', hasFields(homeData?.stats, [
    'todayComplaints', 'myResonances', 'myLikes', 'avgColleagueScore',
    'colleagueCount', 'healthScore', 'moodDays'
  ]), `status=${home.status}`)

  const personality = await api('/api/ai/personality', { token: aqingToken })
  const personalityData = responseObject('职场人格响应', personality)
  check('职场人格文档形状', hasFields(personalityData, ['personality', 'emoji', 'desc', 'stats', 'disclaimer']) &&
    hasFields(personalityData?.stats, [
      'totalComplaints', 'totalResonances', 'topTarget', 'topTheme', 'weakestPoint',
      'emotionIndex', 'relationshipSensitivity', 'slackScore'
    ]), `status=${personality.status}`)
} else {
  check('首页统计文档形状', false, '缺少 aqing token')
  check('职场人格文档形状', false, '缺少 aqing token')
}

// 9. Socket.io 实时消息与风控
if (aqingToken && linxiaoToken && conversationId) {
  const s1 = createClient(BASE, { forceNew: true, auth: { token: aqingToken } })
  const s2 = createClient(BASE, { forceNew: true, auth: { token: linxiaoToken } })
  const received = []
  const linReceived = []
  s1.on('chat:message', (message) => received.push(message))
  s2.on('chat:message', (message) => linReceived.push(message))

  const [s1Connected, s2Connected] = await Promise.all([
    connectSocket(s1, 'aqing'),
    connectSocket(s2, 'linxiao')
  ])

  if (s1Connected && s2Connected) {
    const socketText = `通过 Socket 发送的实时消息 ${runId}`
    const normalReceipts = waitForMessages(
      received, linReceived, (message) => message?.text === socketText
    )
    const normalAck = await socketSend(s1, { conversationId, text: socketText }, 'Socket 正常消息确认')
    check('Socket 消息发送成功', normalAck?.ok === true, '收到确认')
    const normalReceived = await normalReceipts
    check('双方实时收到消息', normalReceived, normalReceived ? '' : '等待接收超时')

    const emojiPayload = {
      conversationId,
      text: '',
      mediaType: 'little_energy_emoji',
      mediaUrl: 'xnz_happy'
    }
    const emojiReceipts = waitForMessages(
      received,
      linReceived,
      (message) => message?.mediaType === 'little_energy_emoji' &&
        message?.mediaUrl === 'xnz_happy' && message?.text === '[小能仔·开心]'
    )
    const emojiAck = await socketSend(s1, emojiPayload, 'Socket 小能仔 Emoji 消息确认')
    check('Socket 小能仔 Emoji 消息发送成功',
      emojiAck?.ok === true &&
        emojiAck?.message?.mediaType === 'little_energy_emoji' &&
        emojiAck?.message?.mediaUrl === 'xnz_happy' &&
        emojiAck?.message?.text === '[小能仔·开心]',
      '收到规范化确认'
    )
    const emojiReceived = await emojiReceipts
    check('双方实时收到相同小能仔 Emoji 消息', emojiReceived, emojiReceived ? '' : '等待接收超时')

    const conversationsAfterEmoji = await api('/api/conversations', { token: aqingToken })
    const conversationAfterEmoji = responseArray('Socket Emoji 后会话列表响应', conversationsAfterEmoji, 'conversations')
      .find((conversation) => conversation?.id === String(conversationId))
    check('Socket Emoji 更新会话末条文本', conversationAfterEmoji?.lastMessageText === '[小能仔·开心]')

    const broadcastsBeforeInvalidEmoji = received.length + linReceived.length
    const invalidEmojiAck = await socketSend(s1, {
      conversationId,
      text: '',
      mediaType: 'little_energy_emoji',
      mediaUrl: '../bad.png'
    }, 'Socket 无效小能仔 Emoji 确认')
    check('Socket 无效小能仔 Emoji 被拒绝', invalidEmojiAck?.ok === false && invalidEmojiAck?.status === 400)
    await new Promise((resolve) => setTimeout(resolve, 150))
    check('Socket 无效小能仔 Emoji 不广播', received.length + linReceived.length === broadcastsBeforeInvalidEmoji)

    const blockedReceipts = waitForMessages(
      received, linReceived, (message) => message?.text?.includes('已被平台风控拦截')
    )
    const blockedAck = await socketSend(s1, { conversationId, text: '私下转账给你' }, 'Socket 违禁消息确认')
    check('Socket 违禁消息被拦截', blockedAck?.blocked === true, '收到确认')
    const blockedReceived = await blockedReceipts
    check('双方收到拦截系统提示', blockedReceived, blockedReceived ? '' : '等待接收超时')
  } else {
    check('Socket 消息发送成功', false, 'Socket 未连接')
    check('双方实时收到消息', false, 'Socket 未连接')
    check('Socket 小能仔 Emoji 消息发送成功', false, 'Socket 未连接')
    check('双方实时收到相同小能仔 Emoji 消息', false, 'Socket 未连接')
    check('Socket Emoji 更新会话末条文本', false, 'Socket 未连接')
    check('Socket 无效小能仔 Emoji 被拒绝', false, 'Socket 未连接')
    check('Socket 无效小能仔 Emoji 不广播', false, 'Socket 未连接')
    check('Socket 违禁消息被拦截', false, 'Socket 未连接')
    check('双方收到拦截系统提示', false, 'Socket 未连接')
  }
  s1.close()
  s2.close()
} else {
  check('Socket 消息发送成功', false, '缺少已验证的账号或会话')
  check('双方实时收到消息', false, '缺少已验证的账号或会话')
  check('Socket 小能仔 Emoji 消息发送成功', false, '缺少已验证的账号或会话')
  check('双方实时收到相同小能仔 Emoji 消息', false, '缺少已验证的账号或会话')
  check('Socket Emoji 更新会话末条文本', false, '缺少已验证的账号或会话')
  check('Socket 无效小能仔 Emoji 被拒绝', false, '缺少已验证的账号或会话')
  check('Socket 无效小能仔 Emoji 不广播', false, '缺少已验证的账号或会话')
  check('Socket 违禁消息被拦截', false, '缺少已验证的账号或会话')
  check('双方收到拦截系统提示', false, '缺少已验证的账号或会话')
}

// 10. 注册：手机号选填、手机号唯一、用户名唯一
{
  const usernameA = `smokeuser${runId.replace(/\W/g, '')}a`
  const noPhone = await api('/api/auth/register', {
    method: 'POST', body: { username: usernameA, password: '123456', nickname: '冒烟无手机' }
  })
  const noPhoneData = responseObject('无手机号注册响应', noPhone, 201)
  check('不带手机号注册成功', !!noPhoneData?.token, `status=${noPhone.status}`)

  const usernameB = `smokeuser${runId.replace(/\W/g, '')}b`
  const phone = `13${String(Math.floor(1e9 + Math.random() * 9e9)).slice(-9)}`
  const codeResponse = await api('/api/auth/phone/send-code', { method: 'POST', body: { phone } })
  const codeData = responseObject('注册验证码响应', codeResponse, 201)
  const code = typeof codeData?.devCode === 'string' ? codeData.devCode : null
  check('发送注册验证码', !!code, `status=${codeResponse.status}`)

  if (code) {
    const registered = await api('/api/auth/register', {
      method: 'POST',
      body: { username: usernameB, password: '123456', nickname: '冒烟测试', phone, code }
    })
    const registeredData = responseObject('手机号注册响应', registered, 201)
    check('带手机号注册成功', !!registeredData?.token && registeredData?.user?.phone === phone, `status=${registered.status}`)

    const duplicatePhone = await api('/api/auth/register', {
      method: 'POST',
      body: { username: `${usernameB}x`, password: '123456', nickname: '重复', phone, code }
    })
    check('同一手机号二次注册被拒绝', duplicatePhone.status === 409, `status=${duplicatePhone.status}`)

    const phoneB = `13${String(Math.floor(1e9 + Math.random() * 9e9)).slice(-9)}`
    const codeBResponse = await api('/api/auth/phone/send-code', { method: 'POST', body: { phone: phoneB } })
    const codeBData = responseObject('重复用户名验证码响应', codeBResponse, 201)
    const codeB = typeof codeBData?.devCode === 'string' ? codeBData.devCode : null
    if (codeB) {
      const duplicateUsername = await api('/api/auth/register', {
        method: 'POST',
        body: { username: usernameB, password: '123456', nickname: '重复', phone: phoneB, code: codeB }
      })
      check('重复用户名被拒绝', duplicateUsername.status === 409, `status=${duplicateUsername.status}`)
    } else {
      check('重复用户名被拒绝', false, '验证码响应缺少 devCode')
    }
  } else {
    check('带手机号注册成功', false, '验证码响应缺少 devCode')
    check('同一手机号二次注册被拒绝', false, '验证码响应缺少 devCode')
    check('重复用户名被拒绝', false, '验证码响应缺少 devCode')
  }
}

console.log(`\n══════ 结果：${passed} 通过 / ${failed} 失败 ══════`)
process.exit(failed > 0 ? 1 : 0)
