/* v3 品行系统 + 聊天分析 冒烟测试（连远程 8020） */
const {
  App, login, logout,
  addColleague, updateColleague, deleteColleague,
  getPersona, postPersona, getPersonaPrediction, analyzeChat
} = require('./src/api.js')

let passed = 0, failed = 0
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('  ✅', name, extra) }
  else { failed++; console.log('  ❌', name, extra) }
}

async function main() {
  console.log('══════ v3 品行系统 + 聊天分析 ══════\n')
  await login('aqing', '123456')
  check('登录', !!App.state.token)

  // 1. 同事画像扩展字段
  let cid = null
  try {
    const c = await addColleague({
      name: '品行测试员', position: '产品经理', relation: '同事',
      age: 28, weight: 72, personalityScore: 4.2,
      workplaceType: '控制型', riskLevel: '中'
    })
    cid = c.id
    check('添加同事(画像字段)', c.age === 28 && c.workplaceType === '控制型' && c.riskLevel === '中', `age=${c.age} type=${c.workplaceType}`)
    const u = await updateColleague(cid, { age: 29, personalityScore: 3.8 })
    check('修改同事画像', u.age === 29 && u.personalityScore === 3.8, `age=${u.age} score=${u.personalityScore}`)
  } catch (e) { check('同事画像', false, e.message) }

  // 2. 品行六维
  try {
    const g0 = await getPersona(cid)
    check('品行默认', g0.scored === false && g0.scores.eq === 50, `eq=${g0.scores.eq}`)
    const p = await postPersona(cid, { eq: 40, responsibility: 30, control: 78, execution: 60, showmanship: 70, temper: 65 })
    check('提交六维', p.ok === true && p.scores.control === 78)
    const g1 = await getPersona(cid)
    check('品行读取', g1.scored === true && g1.scores.temper === 65)
  } catch (e) { check('品行六维', false, e.message) }

  // 3. 行为预测
  try {
    const pr = await getPersonaPrediction(cid)
    check('人格标签', Array.isArray(pr.traits) && pr.traits.length > 0, pr.traits.map((t) => t.label).join(','))
    check('行为预测', Array.isArray(pr.predictions) && pr.predictions.length > 0, pr.predictions.map((x) => `${x.label}=${x.probability}%`).join(' '))
    check('含免责声明', typeof pr.disclaimer === 'string' && pr.disclaimer.includes('估算'))
  } catch (e) { check('行为预测', false, e.message) }

  // 4. 聊天分析（文本模式）
  try {
    const r = await analyzeChat({
      text: '你马上把这个改一下\n好，我看下\n你怎么又搞不定？\n你自己看看\n今晚必须给我\n收到，辛苦了\n明天再说吧\n这个需求不关我事'
    })
    check('聊天分析统计', r.total === 8 && Array.isArray(r.participants), `total=${r.total} participants=${r.participants.length}`)
    check('情绪分布', typeof r.sentiment.positive === 'number' && r.sentiment.negative >= 0, `积极${r.sentiment.positive}% 消极${r.sentiment.negative}% 中性${r.sentiment.neutral}%`)
    check('模式识别', Array.isArray(r.patterns) && r.patterns.some((p) => p.key === 'command'), r.patterns.map((p) => p.label).join(','))
    check('建议话术', Array.isArray(r.suggestions) && r.suggestions.length > 0, r.suggestions[0].slice(0, 24))
  } catch (e) { check('聊天分析', false, e.message) }

  // 5. 聊天分析（messages 带时间模式 → 深夜识别）
  try {
    const r2 = await analyzeChat({
      messages: [
        { sender: '我', text: '需求文档发你了', time: '2026-08-20T23:30:00Z' },
        { sender: '他', text: '马上处理', time: '2026-08-21T00:10:00Z' },
        { sender: '他', text: '这个你自己改', time: '2026-08-21T08:00:00Z' }
      ]
    })
    check('夜间消息识别', r2.patterns.some((p) => p.key === 'night') && r2.patterns.some((p) => p.key === 'blame'), r2.patterns.map((p) => p.label).join(','))
    check('平均回复时长', r2.avgReplyHours != null, `${r2.avgReplyHours} 小时`)
  } catch (e) { check('夜间模式', false, e.message) }

  // 清理
  try { if (cid) await deleteColleague(cid) } catch (e) { /* ignore */ }

  logout()
  console.log(`\n══════ 结果：${passed} 通过 / ${failed} 失败 ══════`)
  process.exit(failed > 0 ? 1 : 0)
}
main().catch((e) => { console.error('异常:', e.message); process.exit(1) })
