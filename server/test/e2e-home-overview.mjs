// Task 7 E2E：/api/home/overview 四场景 + /api/home/stats 兼容 + 变更联动
'use strict'
import assert from 'node:assert/strict'

const BASE = process.env.TUS_SERVER || 'http://localhost:3000'
let passed = 0, failed = 0
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('  ✅', name, extra) }
  else { failed++; console.log('  ❌', name, extra) }
}

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

const REQUIRED_KEYS = ['serverTime', 'greetingPeriod', 'user', 'stats', 'moodToday', 'quickMoods', 'latestComplaints', 'personality', 'colleagueSummary']
const STATS_KEYS = ['moodCheckedToday', 'plazaComplaintCount', 'myComplaintCount', 'colleagueCount', 'unreadMessageCount']

function assertContract(ov) {
  for (const k of REQUIRED_KEYS) assert.ok(Object.hasOwn(ov, k), `missing key ${k}`)
  for (const k of STATS_KEYS) assert.ok(Object.hasOwn(ov.stats, k), `missing stats key ${k}`)
  assert.ok(['morning', 'afternoon', 'evening'].includes(ov.greetingPeriod), 'greetingPeriod valid')
  assert.ok(ov.user.littleEnergyOutfit && typeof ov.user.littleEnergyOutfit.topId === 'string', 'normalized outfit')
  assert.equal(ov.quickMoods.length, 5, 'exactly five quick moods')
  const ids = new Set(ov.quickMoods.map((m) => m.id))
  assert.equal(ids.size, 5, 'quick mood ids unique')
  assert.ok(ov.colleagueSummary && typeof ov.colleagueSummary.count === 'number', 'colleagueSummary present')
}

async function main() {
  console.log('══════ Task 7 E2E：首页聚合四场景 + 兼容性 ══════\n')

  // 1. 空账号（新注册、无任何数据）
  const un = 'e2e_empty_' + Date.now().toString(36)
  const reg = await api('/api/auth/register', { method: 'POST', body: { username: un, password: '123456', nickname: '空账号' } })
  const emptyTok = reg.token
  const emptyOv = await api('/api/home/overview', { token: emptyTok })
  assertContract(emptyOv)
  check('空账号：契约完整', true, `plaza=${emptyOv.stats.plazaComplaintCount}`)
  check('空账号：统计为零（广场计数为全局值，用户侧计数为零）', emptyOv.stats.myComplaintCount === 0 && emptyOv.stats.colleagueCount === 0 && emptyOv.stats.unreadMessageCount === 0, `plaza=${emptyOv.stats.plazaComplaintCount}`)
  check('空账号：未打卡', emptyOv.stats.moodCheckedToday === false && emptyOv.moodToday === null)
  check('空账号：latestComplaints 为数组（广场最新，全局数据）', Array.isArray(emptyOv.latestComplaints))
  check('空账号：人格为空值（0 条吐槽 → null，结构化空值）', emptyOv.personality === null, `personality=${JSON.stringify(emptyOv.personality)}`)
  check('空账号：默认穿搭', emptyOv.user.littleEnergyOutfit.topId === 'top_tshirt', JSON.stringify(emptyOv.user.littleEnergyOutfit))

  // 2. 已填充账号（aqing）
  const login = await api('/api/auth/login', { method: 'POST', body: { username: 'aqing', password: '123456' } })
  const tok = login.token
  const ov = await api('/api/home/overview', { token: tok })
  assertContract(ov)
  check('有数据账号：契约完整', true)
  check('有数据账号：统计与单项接口一致', ov.stats.myComplaintCount === (await api('/api/complaints/mine', { token: tok })).complaints.length, `my=${ov.stats.myComplaintCount}`)
  check('有数据账号：人格/同事概况非空', !!ov.personality && ov.colleagueSummary.count >= 0)

  // 3. 已打卡场景（打卡后 overview 反映）
  await api('/api/mood/checkin', { method: 'POST', body: { mood: '😮‍💨', stressSources: ['deadline'], note: 'e2e' }, token: tok })
  const ovChecked = await api('/api/home/overview', { token: tok })
  check('已打卡：moodCheckedToday=true', ovChecked.stats.moodCheckedToday === true)
  check('已打卡：moodToday 规范化为稳定 ID', ovChecked.moodToday && ovChecked.moodToday.mood === 'xnz_tired', `mood=${ovChecked.moodToday && ovChecked.moodToday.mood}`)

  // 4. 变更联动：换穿搭 → overview 反映（不重启）
  await api('/api/me/profile', { method: 'PUT', body: { littleEnergyOutfit: { topId: 'top_hoodie', bottomId: 'bottom_jeans', shoesId: 'shoes_boots', accessoryIds: ['accessory_hat'] } }, token: tok })
  const ovOutfit = await api('/api/home/overview', { token: tok })
  check('换穿搭：overview 穿搭同步', ovOutfit.user.littleEnergyOutfit.topId === 'top_hoodie' && ovOutfit.user.littleEnergyOutfit.accessoryIds[0] === 'accessory_hat', JSON.stringify(ovOutfit.user.littleEnergyOutfit))
  // 还原为种子默认穿搭（避免污染其它测试对默认穿搭 top_tshirt 的断言）
  await api('/api/me/profile', { method: 'PUT', body: { littleEnergyOutfit: { topId: 'top_tshirt', bottomId: 'bottom_slacks', shoesId: 'shoes_sneakers', accessoryIds: [] } }, token: tok })
  const ovRestored = await api('/api/home/overview', { token: tok })
  check('换穿搭：还原后 overview 一致', ovRestored.user.littleEnergyOutfit.topId === 'top_tshirt', JSON.stringify(ovRestored.user.littleEnergyOutfit))

  // 变更联动：发布吐槽 → 计数增加
  const before = (await api('/api/home/overview', { token: tok })).stats.myComplaintCount
  const post = await api('/api/complaints', { method: 'POST', body: { content: 'E2E 联动验证吐槽 ' + Date.now(), category: 'noise', behaviorTags: [], sentiment: 'xnz_tired', isAnonymous: false }, token: tok })
  const cid = post.complaint.id
  const after = (await api('/api/home/overview', { token: tok })).stats.myComplaintCount
  check('发布吐槽：myComplaintCount 联动 +1', after === before + 1, `${before} → ${after}`)
  await api('/api/complaints/' + cid, { method: 'DELETE', token: tok })
  const cleaned = (await api('/api/home/overview', { token: tok })).stats.myComplaintCount
  check('删除吐槽：计数回落', cleaned === before, `${after} → ${cleaned}`)

  // 5. /api/home/stats 兼容（旧客户端）
  const legacy = await api('/api/home/stats', { token: tok })
  check('旧 stats 接口兼容', legacy.stats && typeof legacy.stats.todayComplaints === 'number' && typeof legacy.stats.healthScore !== 'undefined', JSON.stringify(legacy.stats))

  // 6. 未认证 401
  const res = await fetch(BASE + '/api/home/overview')
  check('未认证返回 401', res.status === 401)

  // 7. 空账号无打卡时默认穿搭 + moodToday null（无副作用清理）
  check('空账号隔离（数据互不串扰）', (await api('/api/home/overview', { token: emptyTok })).stats.myComplaintCount === 0)

  console.log(`\n══════ 结果：${passed} 通过 / ${failed} 失败 ══════`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error('E2E 异常:', e.message); process.exit(1) })
