/* win-app api.js 端到端验证（本地 server，字段契约与 views.js 消费方式一致） */
'use strict'
const path = require('path')
const M = require(path.join(__dirname, 'src', 'api.js'))
const App = M.App
// 本地验证可用 TUS_SERVER 指向本地服务器；默认走生产地址
App.SERVER = process.env.TUS_SERVER || 'http://43.157.17.88:8020'

const OK = (name, cond, extra = '') => {
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : ''))
  if (!cond) process.exitCode = 1
}

;(async () => {
  // 1. 注册/登录（register 签名: username, password, nickname, phone, code）
  const UN = 'winapp_tester'
  try { await M.register(UN, '123456', 'WinApp测试员') } catch (e) {
    await M.login(UN, '123456')
  }
  OK('login/register', !!(App.state.token && App.state.user), 'username=' + (App.state.user && App.state.user.username))

  // 2. 字典
  const dict = await M.fetchTags()
  App.state.dict = dict
  OK('fetchTags', dict.colleagueTypes.length === 16 && dict.behaviorTags.length === 14 && dict.moods.length === 27 && dict.stressSources.length === 10,
    `types=${dict.colleagueTypes.length} tags=${dict.behaviorTags.length} moods=${dict.moods.length} stress=${dict.stressSources.length}`)

  // 3. AI 标签识别
  const ai = await M.extractTagsAI('张三又甩锅，把活都推给别人，领导还夸他')
  OK('extractTagsAI', ai.category === 'leader' && ai.behaviorTags.includes('shift_blame') && ai.behaviorTags.includes('push_work') && ai.hasMatch === true,
    `category=${ai.category} tags=${JSON.stringify(ai.behaviorTags)} sentiment=${ai.sentiment}`)

  // 4. 发吐槽（响应 { complaint: {...} }）
  const posted = await M.postComplaint({
    content: '测试吐槽：隔壁工位天天外放短视频，真的会谢 🙃',
    category: 'noise',
    behaviorTags: ['noise'],
    sentiment: 'annoyed',
    isAnonymous: true
  })
  const cid = posted.complaint && posted.complaint.id
  OK('postComplaint', !!cid, `id=${cid} likeCount=${posted.complaint.likeCount} author=${posted.complaint.authorName}`)

  // 5. 点赞/共鸣 toggle（响应 { liked, likeCount } / { resonated, resonanceCount }）
  const like1 = await M.toggleLikeComplaint(cid)
  OK('toggleLike(on)', like1.liked === true && like1.likeCount === 1, `liked=${like1.liked} likeCount=${like1.likeCount}`)
  const res1 = await M.toggleResonateComplaint(cid, 'same_here')
  OK('toggleResonate(on)', res1.resonated === true && res1.resonanceCount === 1, `resonated=${res1.resonated} resonanceCount=${res1.resonanceCount}`)

  // 6. feed + 热搜榜 + 我的吐槽
  const feed = await M.fetchFeedComplaints({ sort: 'hot' })
  OK('fetchFeedComplaints(hot)', Array.isArray(feed.complaints) && feed.complaints.some(c => String(c.id) === String(cid)), `feed=${feed.complaints.length}`)
  const feedNew = await M.fetchFeedComplaints({ sort: 'new' })
  OK('fetchFeedComplaints(new)', Array.isArray(feedNew.complaints) && feedNew.complaints.length > 0, `feed=${feedNew.complaints.length}`)
  const topics = await M.fetchTopics()
  OK('fetchTopics', Array.isArray(topics.topics), `topics=${topics.topics.length} top=${topics.topics[0] && topics.topics[0].snippet}`)
  const mine = await M.fetchMineComplaints()
  OK('fetchMineComplaints', mine.complaints.some(c => String(c.id) === String(cid)), `mine=${mine.complaints.length}`)

  // 7. 情绪打卡（稳定小能仔 ID，兼容旧 Emoji 输入）
  const today = await M.fetchMoodToday()
  const ck = await M.checkinMood({ mood: 'xnz_tired', stressSources: ['deadline', 'meeting'], note: 'win-app 测试打卡' })
  OK('checkinMood(upsert)', ck.ok === true && ck.mood === 'xnz_tired', `mood=${ck.mood} stress=${ck.stressSources.length}`)
  const ck2 = await M.checkinMood({ mood: 'xnz_calm', stressSources: ['deadline'] })
  OK('checkinMood(re-upsert same day)', ck2.mood === 'xnz_calm', 'mood=' + ck2.mood)
  const legacyCk = await M.checkinMood({ mood: '😐', stressSources: ['deadline'] })
  OK('checkinMood(legacy emoji normalized)', legacyCk.mood === 'xnz_calm', 'mood=' + legacyCk.mood)
  const t2 = await M.fetchMoodToday()
  OK('fetchMoodToday(reflects upsert)', t2.checked === true && t2.mood === 'xnz_calm', 'mood=' + t2.mood)
  const trends = await M.fetchMoodTrends(30)
  OK('fetchMoodTrends', Array.isArray(trends.trend) && trends.trend.length === 30 && trends.trend.some(d => d.mood === 'xnz_calm'), `points=${trends.trend.length}`)
  const summary = await M.fetchMoodSummary()
  OK('fetchMoodSummary', Array.isArray(summary.insights) && Array.isArray(summary.rankings),
    `totalDays=${summary.totalDays} topStress=${summary.rankings[0] && summary.rankings[0].id}`)

  // 8. 同事档案 + 关系雷达（GET { scored, scores } / POST { ok, scores } / batch { items }）
  // addColleague 返回 colleague 对象本身
  const col = await M.addColleague({ name: '雷达测试同事' + Math.floor(Math.random() * 90 + 10), relation: 'teammate', attributeTags: ['fish'] })
  const colId = col.id
  OK('addColleague', !!colId, `id=${colId} name=${col.name}`)
  const r1 = await M.postRadar(colId, { cooperation: 70, expertise: 85, communication: 60, support: 50, trust: 40 })
  OK('postRadar', r1.ok === true && r1.scores.trust === 40, `trust=${r1.scores.trust} coop=${r1.scores.cooperation}`)
  const g = await M.getRadar(colId)
  OK('getRadar', g.scored === true && g.scores.cooperation === 70, `scored=${g.scored} coop=${g.scores.cooperation}`)
  const rel = await M.getRelationshipSummary(colId)
  OK('getRelationshipSummary', !!rel.relationType && Array.isArray(rel.suggestions) && typeof rel.healthScore === 'number',
    `type=${rel.relationType} health=${rel.healthScore} baseOn=${rel.baseOn}`)
  const batch = await M.batchRadar([colId])
  OK('batchRadar', batch.items && batch.items[colId] && batch.items[colId].cooperation === 70, 'batch keys=' + Object.keys(batch.items).length)

  // 9. 职场人格（{ personality, emoji, desc, stats, disclaimer }）
  const p = await M.getPersonality()
  OK('getPersonality', !!p.personality && p.stats && typeof p.stats.emotionIndex === 'number', `personality=${p.personality} emoji=${p.emoji}`)

  // 10. 删除吐槽
  const del = await M.deleteComplaint(cid)
  OK('deleteComplaint', del.ok === true)
  const mine2 = await M.fetchMineComplaints()
  OK('deleteComplaint(effective)', !mine2.complaints.some(c => String(c.id) === String(cid)))

  // 11. logout 清理（dict 为公共字典常量，保留是合理设计）
  M.logout()
  OK('logout clears v2 state', App.state.token === null && App.state.user === null && App.state.complaints.length === 0 && App.state.personality === null && App.state.moodTrends.length === 0)

  console.log('\nDONE')
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
