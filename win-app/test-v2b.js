/* 设计稿对齐 v2.1 新接口冒烟：feed 筛选 / 评论 / 首页统计 / 全局搜索 */
const {
  App, login, logout, fetchTags,
  fetchFeedComplaints, postComplaint, deleteComplaint,
  fetchComplaintComments, postComplaintComment, deleteComplaintComment,
  fetchHomeStats, searchAll, addColleague
} = require('./src/api.js')

let passed = 0, failed = 0
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('  ✅', name, extra) }
  else { failed++; console.log('  ❌', name, extra) }
}

async function main() {
  console.log('══════ v2.1 设计稿对齐接口冒烟 ══════\n')
  await login('aqing', '123456')
  check('登录', !!App.state.token)

  // 1. feed 筛选
  try {
    const rec = await fetchFeedComplaints('hot', 'recommend')
    check('feed 推荐', Array.isArray(rec.complaints), `${rec.complaints.length} 条`)
    const anon = await fetchFeedComplaints('hot', 'anonymous')
    check('feed 匿名筛选', Array.isArray(anon.complaints) && anon.complaints.every((c) => c.isAnonymous), `${anon.complaints.length} 条全匿名`)
    const col = await fetchFeedComplaints('hot', 'colleague')
    check('feed 我的同事筛选', Array.isArray(col.complaints), `${col.complaints.length} 条`)
    if (rec.complaints.length) {
      const c = rec.complaints[0]
      check('卡片含共鸣率/评论数', typeof c.resonanceRate === 'number' && typeof c.commentCount === 'number', `rate=${c.resonanceRate}% comments=${c.commentCount}`)
    }
  } catch (e) { check('feed 筛选', false, e.message) }

  // 2. 评论全链路
  let cid = null
  try {
    const p = await postComplaint({ content: '评论测试吐槽：这周又被安排了三场无效会议。', category: 'meeting', behaviorTags: [], sentiment: '😮‍💨', isAnonymous: false })
    cid = p.complaint.id
    const r1 = await postComplaintComment(cid, '太真实了，我们也是')
    check('发表评论', !!r1.comment && !!r1.comment.id, r1.comment.authorName)
    const r2 = await postComplaintComment(cid, '会议终结者')
    const list = await fetchComplaintComments(cid)
    check('评论列表', Array.isArray(list.comments) && list.comments.length === 2, `${list.comments.length} 条`)
    const del = await deleteComplaintComment(cid, r1.comment.id)
    const list2 = await fetchComplaintComments(cid)
    check('删除评论', del.ok === true && list2.comments.length === 1, `剩 ${list2.comments.length} 条`)
    const feed2 = await fetchFeedComplaints('hot', 'recommend')
    const mine2 = feed2.complaints.find((x) => String(x.id) === String(cid))
    check('feed 评论数刷新', mine2 && mine2.commentCount === 1, `commentCount=${mine2 && mine2.commentCount}`)
  } catch (e) { check('评论全链路', false, e.message) }

  // 3. 首页统计
  try {
    const { stats } = await fetchHomeStats()
    check('首页统计', typeof stats.todayComplaints === 'number' && typeof stats.myResonances === 'number' && typeof stats.healthScore !== 'undefined',
      JSON.stringify(stats))
  } catch (e) { check('首页统计', false, e.message) }

  // 4. 全局搜索
  try {
    await addColleague({ name: '搜索测试员', relation: '同事', attributeTags: [] }).catch(() => {})
    const r = await searchAll('会议')
    check('搜索返回三组', Array.isArray(r.complaints) && Array.isArray(r.colleagues) && Array.isArray(r.companies), `吐槽${r.complaints.length}/同事${r.colleagues.length}/公司${r.companies.length}`)
    const r2 = await searchAll('')
    check('空搜索', r2.complaints.length === 0)
  } catch (e) { check('全局搜索', false, e.message) }

  // 清理
  try { if (cid) await deleteComplaint(cid) } catch (e) { /* ignore */ }

  logout()
  console.log(`\n══════ 结果：${passed} 通过 / ${failed} 失败 ══════`)
  process.exit(failed > 0 ? 1 : 0)
}
main().catch((e) => { console.error('异常:', e.message); process.exit(1) })
