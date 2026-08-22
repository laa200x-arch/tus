/* ============================================================
 * 职场那些事 Windows 版 - 核心层（REST 封装 + 状态 + Socket.io）
 * 纯 JS（无 DOM 依赖），可在 Node 中直接测试
 * ============================================================ */
'use strict'

// Node 测试环境兼容（无 localStorage）
const storage = globalThis.localStorage || {
  _d: {},
  getItem(k) { return this._d[k] ?? null },
  setItem(k, v) { this._d[k] = String(v) },
  removeItem(k) { delete this._d[k] }
}

const App = {
  SERVER: 'http://43.157.17.88:8020',
  state: {
    token: storage.getItem('jiyu.token') || null,
    user: null,              // 当前用户（服务端格式）
    users: [],               // 全部用户
    conversations: [],       // 会话列表
    messages: {},            // conversationId -> [message]
    hasMore: {},             // conversationId -> bool
    statuses: [],            // 同事状态（吐槽动态）
    colleagues: [],          // 同事档案
    companies: [],           // 公司属性档案
    // === v2 职场关系操作系统 ===
    dict: null,              // 字典缓存（/api/tags）
    complaints: [],          // 吐槽 feed
    topics: [],              // 热搜榜
    myComplaints: [],        // 我的吐槽
    moodToday: null,         // 今日情绪
    moodTrends: [],          // N 天曲线
    moodSummary: null,       // AI 总结
    personality: null,       // 职场人格
    syncHistory: storage.getItem('jiyu.syncHistory') !== '0',
    syncChosen: storage.getItem('jiyu.syncChosen') === '1',
    activeConversation: null,
    savedAccounts: JSON.parse(storage.getItem('jiyu.accounts') || '[]'),
    socket: null
  },
  views: {} // 由 views.js 注册
}

/* ---------- 基础请求 ---------- */
async function api(path, { method = 'GET', body, query } = {}) {
  let url = App.SERVER + path
  if (query) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, v)
    const s = qs.toString()
    if (s) url += (url.includes('?') ? '&' : '?') + s
  }
  const headers = { 'Content-Type': 'application/json' }
  if (App.state.token) headers['Authorization'] = 'Bearer ' + App.state.token
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || ('请求失败（HTTP ' + res.status + '）'))
    err.status = res.status
    throw err
  }
  return data
}

/* ---------- 认证 ---------- */
async function login(username, password) {
  const data = await api('/api/auth/login', { method: 'POST', body: { username, password } })
  await afterLogin(data)
}
async function register(username, password, nickname, phone, code) {
  const data = await api('/api/auth/register', { method: 'POST', body: { username, password, nickname, phone, code } })
  await afterLogin(data)
}
async function loginWithSaved(account) {
  App.state.token = account.token
  storage.setItem('jiyu.token', account.token)
  try {
    const data = await api('/api/me')
    await afterLogin({ token: account.token, user: data.user })
  } catch (e) {
    if (e.status === 401) {
      App.state.token = null
      storage.removeItem('jiyu.token')
    }
    throw e
  }
}
async function autoLogin() {
  if (!App.state.token) return false
  try {
    const data = await api('/api/me')
    await afterLogin({ token: App.state.token, user: data.user })
    return true
  } catch (e) {
    if (e.status === 401) {
      App.state.token = null
      storage.removeItem('jiyu.token')
    }
    return false
  }
}
async function afterLogin({ token, user }) {
  App.state.token = token
  storage.setItem('jiyu.token', token)
  App.state.user = user
  saveAccount({ username: user.username, nickname: user.userName, avatarSymbol: user.avatarSymbol, token })
  await refreshAll()
  connectSocket()
}
function logout() {
  App.state.token = null
  storage.removeItem('jiyu.token')
  if (App.state.socket) { App.state.socket.disconnect(); App.state.socket = null }
  App.state.user = null
  App.state.users = []
  App.state.conversations = []
  App.state.messages = {}
  App.state.statuses = []
  App.state.colleagues = []
  App.state.companies = []
  // v2 清理
  App.state.complaints = []
  App.state.topics = []
  App.state.myComplaints = []
  App.state.moodToday = null
  App.state.moodTrends = []
  App.state.moodSummary = null
  App.state.personality = null
}
function saveAccount(account) {
  let list = App.state.savedAccounts.filter((a) => a.username !== account.username)
  list.unshift(account)
  App.state.savedAccounts = list
  storage.setItem('jiyu.accounts', JSON.stringify(list))
}
function removeAccount(username) {
  App.state.savedAccounts = App.state.savedAccounts.filter((a) => a.username !== username)
  storage.setItem('jiyu.accounts', JSON.stringify(App.state.savedAccounts))
}

/* ---------- 全量刷新 ---------- */
async function refreshAll() {
  const [users, convs, statuses, colleagues, companies] = await Promise.all([
    api('/api/users'), api('/api/conversations'), api('/api/statuses'),
    api('/api/colleagues'), api('/api/companies')
  ])
  App.state.users = users.users
  App.state.conversations = convs.conversations
  App.state.statuses = statuses.statuses
  App.state.colleagues = colleagues.colleagues
  App.state.companies = companies.companies
}

/* ---------- 用户 ---------- */
async function fetchUser(id) {
  const data = await api('/api/users/' + id)
  return data.user
}
async function updateProfile({ nickname, bio, locationLabel, avatarUrl } = {}) {
  const body = {}
  if (nickname !== undefined) body.nickname = nickname
  if (bio !== undefined) body.bio = bio
  if (locationLabel !== undefined) body.locationLabel = locationLabel
  if (avatarUrl !== undefined) body.avatarUrl = avatarUrl
  const data = await api('/api/me/profile', { method: 'PUT', body })
  App.state.user = data.user
  const acc = App.state.savedAccounts.find((a) => a.username === data.user.username)
  if (acc) { acc.nickname = data.user.userName; storage.setItem('jiyu.accounts', JSON.stringify(App.state.savedAccounts)) }
  if (App.state.views && App.state.views.onDataChanged) App.state.views.onDataChanged()
}

/* ---------- 同事状态（吐槽动态） ---------- */
async function fetchStatuses() {
  return api('/api/statuses')
}
async function postStatus({ content, colleagueId, themeTags, softwareTags, mood }) {
  const data = await api('/api/statuses', { method: 'POST', body: { content, colleagueId, themeTags, softwareTags, mood } })
  App.state.statuses.unshift(data.status)
  return data.status
}
async function deleteStatus(id) {
  await api('/api/statuses/' + id, { method: 'DELETE' })
  App.state.statuses = App.state.statuses.filter((x) => String(x.id) !== String(id))
}

/* ---------- 同事档案 ---------- */
async function fetchColleagues() {
  const data = await api('/api/colleagues')
  App.state.colleagues = data.colleagues
  return data
}
async function addColleague(payload) {
  const data = await api('/api/colleagues', { method: 'POST', body: payload })
  App.state.colleagues.unshift(data.colleague)
  return data.colleague
}
async function updateColleague(id, payload) {
  const data = await api('/api/colleagues/' + id, { method: 'PUT', body: payload })
  App.state.colleagues = App.state.colleagues.map((c) => (c.id === String(id) ? data.colleague : c))
  return data.colleague
}
async function deleteColleague(id) {
  await api('/api/colleagues/' + id, { method: 'DELETE' })
  App.state.colleagues = App.state.colleagues.filter((c) => String(c.id) !== String(id))
}

/* ---------- 公司属性 ---------- */
async function fetchCompanies() {
  const data = await api('/api/companies')
  App.state.companies = data.companies
  return data
}
async function addCompany(payload) {
  const data = await api('/api/companies', { method: 'POST', body: payload })
  App.state.companies.unshift(data.company)
  return data.company
}
async function updateCompany(id, payload) {
  const data = await api('/api/companies/' + id, { method: 'PUT', body: payload })
  App.state.companies = App.state.companies.map((c) => (c.id === String(id) ? data.company : c))
  return data.company
}
async function deleteCompany(id) {
  await api('/api/companies/' + id, { method: 'DELETE' })
  App.state.companies = App.state.companies.filter((c) => String(c.id) !== String(id))
}

/* ---------- 小程序市场 ---------- */
async function fetchApps(keyword) {
  return api('/api/apps' + (keyword ? '?keyword=' + encodeURIComponent(keyword) : ''))
}
async function fetchAppDetail(id) {
  return api('/api/apps/' + id)
}
async function publishApp({ name, description, icon, htmlContent }) {
  return api('/api/apps', { method: 'POST', body: { name, description, icon, htmlContent } })
}
async function deleteApp(id) {
  return api('/api/apps/' + id, { method: 'DELETE' })
}

/* ---------- 聊天（REST） ---------- */
async function openConversation(partnerId) {
  const data = await api('/api/conversations/open', { method: 'POST', body: { partnerId } })
  const conv = data.conversation
  if (!App.state.conversations.some((c) => c.id === conv.id)) App.state.conversations.unshift(conv)
  return conv
}
async function loadMessages(conversationId, before) {
  const data = await api('/api/conversations/' + conversationId + '/messages', { query: { before } })
  App.state.hasMore[conversationId] = !!data.hasMore
  return { messages: data.messages, hasMore: !!data.hasMore }
}
async function markRead(conversationId) {
  try { await api('/api/conversations/' + conversationId + '/read', { method: 'POST' }) } catch (e) { /* ignore */ }
}
async function sendMessageRest(conversationId, text, mediaType, mediaUrl, orderId) {
  return api('/api/messages', { method: 'POST', body: { conversationId, text, mediaType, mediaUrl, orderId } })
}

/* ---------- 文件上传 ---------- */
async function uploadMedia(data, fileName, mimeType) {
  const form = new FormData()
  form.append('file', new Blob([data], { type: mimeType }), fileName)
  const res = await fetch(App.SERVER + '/api/upload', {
    method: 'POST',
    headers: App.state.token ? { Authorization: 'Bearer ' + App.state.token } : {},
    body: form
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || '上传失败')
  return json.url
}

/* ---------- Socket.io 实时 ---------- */
function connectSocket() {
  if (typeof io === 'undefined') {
    console.log('[socket] 跳过（非浏览器环境）')
    return
  }
  if (App.state.socket) { App.state.socket.disconnect(); App.state.socket = null }
  const socket = io(App.SERVER, { transports: ['websocket', 'polling'], auth: { token: App.state.token } })
  socket.on('connect', () => console.log('[socket] 已连接'))
  socket.on('disconnect', () => console.log('[socket] 断开'))
  socket.on('chat:message', (msg) => {
    const conv = App.state.conversations.find((c) => c.id === msg.conversationId)
    const isMe = msg.senderId === App.state.user.id
    const list = App.state.messages[msg.conversationId] || []
    if (!list.some((m) => m.id === msg.id)) {
      App.state.messages[msg.conversationId] = [...list, normalizeMessage(msg, isMe)]
      if (App.state.views.onMessage) App.state.views.onMessage(msg.conversationId)
    }
    if (conv) {
      conv.lastMessageText = msg.text || (msg.mediaType === 'video' ? '[视频]' : msg.mediaType === 'audio' ? '[语音]' : '[图片]')
      conv.lastTime = msg.time
      if (!isMe && App.state.activeConversation !== msg.conversationId) conv.unreadCount = (conv.unreadCount || 0) + 1
      if (App.state.views.onConversationUpdate) App.state.views.onConversationUpdate()
      if (!isMe && App.state.activeConversation !== msg.conversationId) {
        // 应用内弹窗（点击跳转会话）
        if (App.state.views.onNewMessage) App.state.views.onNewMessage(msg, conv)
        // 系统桌面通知
        try { new Notification('职场那些事 · ' + conv.partner.userName + ' 发来消息', { body: msg.text || '[媒体消息]' }) } catch (e) {}
        // 任务栏闪烁提醒（通过 preload 暴露的最小 API，渲染进程无 Node 权限）
        try {
          if (window.jiyu && window.jiyu.flash) window.jiyu.flash()
        } catch (e) { /* 非 Electron 环境 */ }
      }
    }
  })
  App.state.socket = socket
}
function socketSend(conversationId, text, orderId) {
  return new Promise((resolve) => {
    const socket = App.state.socket
    if (!socket || !socket.connected) return resolve({ ok: false, blocked: false, error: '未连接' })
    socket.emit('chat:send', { conversationId, text, orderId }, (ack) => resolve(ack || {}))
  })
}
function normalizeMessage(msg, isMe) {
  return {
    id: msg.id, senderIsMe: isMe, text: msg.text || '',
    mediaType: msg.mediaType || null, mediaUrl: msg.mediaUrl || null,
    orderId: msg.orderId || null,
    time: msg.time, isSystemNote: !!msg.isSystemNote
  }
}

/* ---------- 版本检查 ---------- */
async function fetchVersion() {
  try { return await api('/api/version') } catch (e) { return null }
}

/* ============================================================
 * 职场关系操作系统 v2 —— 吐槽广场 / 情绪打卡 / AI / 关系雷达
 * ============================================================ */

/* ---------- 字典（公开，登录前可调用） ---------- */
async function fetchTags() {
  return api('/api/tags')
}

/* ---------- 吐槽广场 ---------- */
async function fetchFeedComplaints(sort = 'hot', filter = 'recommend') {
  return api('/api/complaints/feed', { query: { sort, filter } })
}
async function fetchComplaintComments(id) {
  return api('/api/complaints/' + id + '/comments')
}
async function postComplaintComment(id, content) {
  return api('/api/complaints/' + id + '/comments', { method: 'POST', body: { content } })
}
async function deleteComplaintComment(cid, commentId) {
  return api('/api/complaints/' + cid + '/comments/' + commentId, { method: 'DELETE' })
}
async function fetchMineComplaints() {
  return api('/api/complaints/mine')
}
async function fetchTopics() {
  return api('/api/complaints/topics')
}
async function postComplaint(payload) {
  return api('/api/complaints', { method: 'POST', body: payload })
}
async function deleteComplaint(id) {
  return api('/api/complaints/' + id, { method: 'DELETE' })
}
async function toggleLikeComplaint(id) {
  return api('/api/complaints/' + id + '/like', { method: 'POST' })
}
async function toggleResonateComplaint(id) {
  return api('/api/complaints/' + id + '/resonate', { method: 'POST' })
}

/* ---------- 情绪打卡 ---------- */
async function fetchMoodToday() {
  return api('/api/mood/today')
}
async function checkinMood(payload) {
  return api('/api/mood/checkin', { method: 'POST', body: payload })
}
async function fetchMoodTrends(days = 30) {
  return api('/api/mood/trends', { query: { days } })
}
async function fetchMoodSummary() {
  return api('/api/mood/summary')
}

/* ---------- AI ---------- */
async function extractTagsAI(text) {
  return api('/api/ai/extract-tags', { method: 'POST', body: { text } })
}
async function getRelationshipSummary(colleagueId) {
  return api('/api/ai/relationship/' + colleagueId)
}
async function getPersonality() {
  return api('/api/ai/personality')
}

/* ---------- 关系雷达 ---------- */
async function getRadar(colleagueId) {
  return api('/api/radar/' + colleagueId)
}
async function postRadar(colleagueId, scores) {
  return api('/api/radar/' + colleagueId, { method: 'POST', body: { scores } })
}
async function batchRadar(ids) {
  return api('/api/radar/batch', { method: 'POST', body: { ids } })
}

/* ---------- 首页统计 + 全局搜索（设计稿 Dashboard） ---------- */
async function fetchHomeStats() {
  return api('/api/home/stats')
}
async function searchAll(q) {
  return api('/api/search', { query: { q } })
}

/* ---------- v3 品行系统 + 聊天分析 ---------- */
async function getPersona(colleagueId) {
  return api('/api/persona/' + colleagueId)
}
async function postPersona(colleagueId, scores) {
  return api('/api/persona/' + colleagueId, { method: 'POST', body: { scores } })
}
async function getPersonaPrediction(colleagueId) {
  return api('/api/persona/' + colleagueId + '/prediction')
}
async function analyzeChat(payload) {
  return api('/api/analysis/chat', { method: 'POST', body: payload })
}

/* ---------- v3 消息中心 ---------- */
async function fetchNotifications() {
  return api('/api/notifications')
}

/* Node 环境导出（测试用） */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    App, api, login, register, loginWithSaved, autoLogin, logout, refreshAll,
    fetchUser, updateProfile, openConversation, loadMessages, sendMessageRest, uploadMedia,
    fetchStatuses, postStatus, deleteStatus,
    fetchColleagues, addColleague, updateColleague, deleteColleague,
    fetchCompanies, addCompany, updateCompany, deleteCompany,
    fetchApps, publishApp, deleteApp, fetchVersion,
    // v2
    fetchTags, fetchFeedComplaints, fetchMineComplaints, fetchTopics, postComplaint, deleteComplaint,
    toggleLikeComplaint, toggleResonateComplaint,
    fetchComplaintComments, postComplaintComment, deleteComplaintComment,
    fetchMoodToday, checkinMood, fetchMoodTrends, fetchMoodSummary,
    extractTagsAI, getRelationshipSummary, getPersonality,
    getRadar, postRadar, batchRadar,
    fetchHomeStats, searchAll,
    getPersona, postPersona, getPersonaPrediction, analyzeChat,
    fetchNotifications
  }
}
