/* 首页聚合快照回归测试（VM 浏览器顺序加载，不依赖真实服务器）
 * 运行：node test-home-overview.js
 * 覆盖：
 *   1. 按打包 HTML 的真实脚本顺序加载 little-energy.js + api.js
 *   2. 一次 /api/home/overview 请求喂饱首屏各模块（统计/打卡/人格/吐槽/同事概况）
 *   3. moodToday 与穿搭经既有 Little Energy 状态/规范化同步
 *   4. 完整 / 空 / 延迟 / 失败 / 超时响应；过期响应不覆盖新数据；loading 必被清除
 */
'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

/* ---------- 打包顺序契约 ---------- */
const html = fs.readFileSync('./src/index.html', 'utf8')
const scriptOrder = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1])
assert.deepEqual(
  scriptOrder,
  [
    '../node_modules/socket.io-client/dist/socket.io.min.js',
    'ui-assets.js', 'little-energy.js', 'page-history.js', 'api.js', 'views.js', 'app.js'
  ],
  'index.html 必须以打包顺序加载脚本（socket.io → ui-assets → little-energy → page-history → api → views → app）'
)

/* ---------- 概览夹具（与服务端契约一致） ---------- */
function makeOverview(overrides = {}) {
  const base = {
    serverTime: '2026-08-27T12:11:00.000Z',
    greetingPeriod: 'afternoon',
    user: {
      id: '1',
      userName: '阿青',
      littleEnergyOutfit: { topId: 'top_tshirt', bottomId: 'bottom_slacks', shoesId: 'shoes_sneakers', accessoryIds: [] }
    },
    stats: {
      moodCheckedToday: true,
      plazaComplaintCount: 5,
      myComplaintCount: 2,
      colleagueCount: 3,
      unreadMessageCount: 1
    },
    moodToday: { mood: 'xnz_happy', stressSources: ['coworker'], note: '今天还行', date: '2026-08-27' },
    quickMoods: [
      { id: 'xnz_motivated', label: '元气', assetName: 'xnz_motivated' },
      { id: 'xnz_composed', label: '还行', assetName: 'xnz_composed' },
      { id: 'xnz_calm', label: '一般', assetName: 'xnz_calm' },
      { id: 'xnz_tired', label: '好累', assetName: 'xnz_tired' },
      { id: 'xnz_angry', label: '想辞职', assetName: 'xnz_angry' }
    ],
    latestComplaints: [{
      id: '5', userId: null, authorName: '匿名用户', avatarSymbol: '🎭',
      littleEnergyOutfit: null, isAnonymous: true,
      content: '测试吐槽', sentiment: 'xnz_happy',
      likeCount: 1, resonanceCount: 1, commentCount: 0, time: '2026-08-21T18:52:34.745Z'
    }],
    personality: { name: '摸鱼哲学家', totalComplaints: 0, summary: '完整报告在 AI 洞察中查看' },
    colleagueSummary: { count: 3, averageScore: 3.8, healthScore: 76 }
  }
  return Object.assign({}, base, JSON.parse(JSON.stringify(overrides)))
}

/* ---------- VM 环境：按打包顺序加载脚本 + 可编程 fetch ---------- */
function deferredFetch() {
  const pending = []
  const impl = (url, opts) => new Promise((resolve, reject) => {
    pending.push({ url: String(url), opts, resolve, reject })
  })
  return { impl, pending }
}

function okResponse(body) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
}

function createApp(fetchImpl, timers = { setTimeout, clearTimeout }) {
  const ctx = vm.createContext({
    console,
    fetch: fetchImpl,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    URLSearchParams,
    FormData,
    Blob
  })
  ctx.globalThis = ctx
  vm.runInContext(fs.readFileSync('./src/little-energy.js', 'utf8'), ctx, { filename: 'little-energy.js' })
  vm.runInContext(fs.readFileSync('./src/api.js', 'utf8'), ctx, { filename: 'api.js' })
  const run = (code) => vm.runInContext(code, ctx)
  const state = run('App.state')
  const LittleEnergy = ctx.LittleEnergy
  // 模拟已登录用户（供穿搭同步）
  run("App.state.token = 't'; App.state.user = { id: '1', userName: '阿青', littleEnergyOutfit: null }")
  return { ctx, run, state, LittleEnergy }
}

let passed = 0
let failed = 0
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('  ✅', name, extra) }
  else { failed++; console.log('  ❌', name, extra) }
}

async function main() {
  console.log('══════ 首页聚合快照回归（VM 浏览器顺序）══════\n')

  /* 1. 完整响应：一次请求喂饱首屏 + 情绪/穿搭同步进全局状态 */
  {
    const overview = makeOverview()
    const requests = []
    const app = createApp((url) => {
      requests.push(String(url))
      return okResponse(overview)
    })
    const refreshed = await app.run('refreshHomeOverview()')
    check('overview 加载成功', app.state.homeOverviewPhase === 'loaded')
    check('返回聚合快照', !!refreshed && refreshed.stats.plazaComplaintCount === 5)

    // 一次 /api/home/overview 请求即覆盖首屏所有模块的数据源
    check('仅发一次 overview 请求', requests.filter((u) => u.includes('/api/home/overview')).length === 1)
    const ov = app.state.homeOverview
    check('统计卡数据就绪', ov.stats.moodCheckedToday === true && ov.stats.colleagueCount === 3)
    check('五个快捷情绪', Array.isArray(ov.quickMoods) && ov.quickMoods.length === 5)
    check('最新吐槽就绪', ov.latestComplaints.length === 1 && ov.latestComplaints[0].id === '5')
    check('人格摘要就绪', !!ov.personality && ov.personality.name === '摸鱼哲学家')
    check('同事概况就绪', ov.colleagueSummary.count === 3 && ov.colleagueSummary.healthScore === 76)

    // 情绪经 Little Energy 规范化进入全局 moodToday（沿用既有形状）
    check('moodToday 已同步', app.state.moodToday && app.state.moodToday.checked === true)
    check('mood 为稳定 ID', app.state.moodToday.mood === 'xnz_happy' &&
      app.LittleEnergy.normalizeMood(app.state.moodToday.mood) === 'xnz_happy')
    // 穿搭进入当前用户对象（Little Energy 头像直接消费）
    check('穿搭已同步', app.state.user.littleEnergyOutfit &&
      app.LittleEnergy.normalizeOutfit(app.state.user.littleEnergyOutfit).topId === 'top_tshirt')
  }

  /* 2. 空状态响应：结构化空值，不缺字段，不阻塞进入 */
  {
    const app = createApp(() => okResponse(makeOverview({
      stats: { moodCheckedToday: false, plazaComplaintCount: 0, myComplaintCount: 0, colleagueCount: 0, unreadMessageCount: 0 },
      moodToday: null,
      latestComplaints: [],
      personality: null,
      colleagueSummary: { count: 0, averageScore: null, healthScore: null }
    })))
    await app.run('refreshHomeOverview()')
    check('空状态加载成功', app.state.homeOverviewPhase === 'loaded')
    check('未打卡 moodToday', app.state.moodToday && app.state.moodToday.checked === false && app.state.moodToday.mood === null)
    check('空统计/吐槽/人格', app.state.homeOverview.stats.moodCheckedToday === false &&
      app.state.homeOverview.latestComplaints.length === 0 && app.state.homeOverview.personality === null)
    check('缺省穿搭被规范化', app.LittleEnergy.normalizeOutfit(app.state.homeOverview.user.littleEnergyOutfit).topId === 'top_tshirt')
  }

  /* 3. 失败保留缓存 + 重试成功；loading 必被清除 */
  {
    let mode = 'fail'
    const app = createApp(() => {
      if (mode === 'fail') return Promise.reject(new Error('网络错误'))
      return okResponse(makeOverview({ personality: { name: '重试人格', totalComplaints: 9, summary: 'x' } }))
    })
    await app.run('refreshHomeOverview()')
    check('首次失败进入 failed', app.state.homeOverviewPhase === 'failed')
    check('失败不清除 loading', app.state.homeOverviewPhase !== 'loading')
    check('失败保留空缓存', app.state.homeOverview === null)

    mode = 'ok'
    await app.run('refreshHomeOverview()')
    check('重试成功', app.state.homeOverviewPhase === 'loaded')
    check('重试获得新数据', app.state.homeOverview.personality.name === '重试人格')

    // 缓存存在时非强制刷新不发请求
    const before = app.run('refreshHomeOverview()')
    check('非强制复用缓存', app.state.homeOverviewPhase === 'loaded' && !!before)
  }

  /* 4. 过期响应不得覆盖新数据（先到的新响应赢） */
  {
    const d = deferredFetch()
    const app = createApp(d.impl)
    const first = app.run('refreshHomeOverview({ force: true })')
    const second = app.run('refreshHomeOverview({ force: true })')
    assert.equal(d.pending.length, 2, '两次强制刷新并发发出两个请求')
    // 先回新请求（index 1），再回旧请求（index 0）
    d.pending[1].resolve({ ok: true, status: 200, json: () => Promise.resolve(makeOverview({ stats: { moodCheckedToday: true, plazaComplaintCount: 99, myComplaintCount: 1, colleagueCount: 2, unreadMessageCount: 0 } })) })
    await second
    d.pending[0].resolve({ ok: true, status: 200, json: () => Promise.resolve(makeOverview({ stats: { moodCheckedToday: true, plazaComplaintCount: 1, myComplaintCount: 1, colleagueCount: 2, unreadMessageCount: 0 } })) })
    await first
    check('旧响应被丢弃', app.state.homeOverview.stats.plazaComplaintCount === 99)
    check('过期失败不改变阶段', app.state.homeOverviewPhase === 'loaded')
  }

  /* 5. 超时：loading 必被清除，阶段进入 failed */
  {
    const never = new Promise(() => {}) // 永不返回 → 触发 withTimeout
    const timers = { setTimeout: (fn) => { queueMicrotask(fn); return 1 }, clearTimeout: () => {} }
    const app = createApp(() => never, timers)
    const result = await app.run('refreshHomeOverview({ force: true })')
    check('超时返回 null', result === null)
    check('超时后阶段 failed', app.state.homeOverviewPhase === 'failed')
    check('超时后 loading 已清除', app.state.homeOverviewPhase !== 'loading')
  }

  /* 6. 打卡后立即刷新聚合（写接口成功路径的校准钩子） */
  {
    const d = deferredFetch()
    const app = createApp(d.impl)
    // 打卡接口先返回
    app.run("App.state.token = 't'")
    const checkinPromise = app.run("checkinMood({ mood: 'xnz_angry', stressSources: [], note: '' })")
    assert.equal(d.pending.length, 1)
    d.pending[0].resolve({ ok: true, status: 200, json: () => Promise.resolve({ checked: true, date: '2026-08-27', mood: 'xnz_angry', stressSources: [], note: '', createdAt: null }) })
    await checkinPromise
    check('打卡后触发 overview 刷新', d.pending.length >= 2 &&
      String(d.pending[1].url).includes('/api/home/overview'))
    // 打卡立即生效于全局状态
    check('打卡立即更新 moodToday', app.state.moodToday && app.state.moodToday.mood === 'xnz_angry')
  }

  /* 7. 登出清空快照并作废在途请求 */
  {
    const app = createApp(() => okResponse(makeOverview()))
    await app.run('refreshHomeOverview()')
    check('登出前已加载', app.state.homeOverviewPhase === 'loaded')
    app.run('logout()')
    check('登出清空快照', app.state.homeOverview === null && app.state.homeOverviewPhase === 'idle')
  }

  console.log(`\n══════ 结果：${passed} 通过 / ${failed} 失败 ══════`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error('测试异常:', e); process.exit(1) })
