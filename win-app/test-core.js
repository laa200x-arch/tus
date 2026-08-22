/* 吐槽同事 Windows 版 - 核心逻辑测试（Node 直连服务器）
 * 运行：node test-core.js
 * 依赖：服务器已启动且 SERVER 指向可达地址（见 src/api.js App.SERVER）
 */
const {
  App, api, login, logout, refreshAll, fetchUser, updateProfile,
  openConversation, loadMessages, sendMessageRest, uploadMedia,
  fetchStatuses, postStatus, deleteStatus,
  fetchColleagues, addColleague, updateColleague, deleteColleague,
  fetchCompanies, addCompany, updateCompany, deleteCompany,
  fetchVersion
} = require('./src/api.js')

let passed = 0, failed = 0
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('  ✅', name, extra) }
  else { failed++; console.log('  ❌', name, extra) }
}

async function main() {
  console.log('══════ 吐槽同事 Windows 版核心逻辑测试 ══════\n')
  console.log('SERVER =', App.SERVER, '\n')

  // 1. 登录
  try {
    await login('aqing', '123456')
    check('登录 aqing', !!App.state.token, `user=${App.state.user && App.state.user.userName}`)
  } catch (e) { check('登录 aqing', false, e.message) }

  // 2. 全量数据（新四维模型）
  try {
    await refreshAll()
    check('用户列表', App.state.users.length > 0, `${App.state.users.length} 位`)
    check('会话列表', Array.isArray(App.state.conversations))
    check('同事状态(statuses)', Array.isArray(App.state.statuses), `${App.state.statuses.length} 条`)
    check('同事档案(colleagues)', Array.isArray(App.state.colleagues), `${App.state.colleagues.length} 位`)
    check('公司属性(companies)', Array.isArray(App.state.companies), `${App.state.companies.length} 家`)
  } catch (e) { check('全量刷新', false, e.message) }

  // 3. 用户资料
  try {
    const u = await fetchUser(App.state.users[1].id)
    check('用户资料', !!u.userName, u.userName)
  } catch (e) { check('用户资料', false, e.message) }

  // 4. 发布吐槽（合规 + 违规拦截）
  let statusId = null
  try {
    const s = await postStatus({
      content: 'Windows 版测试吐槽：隔壁组又改需求了 🤬',
      colleagueId: App.state.colleagues[0] && App.state.colleagues[0].id,
      themeTags: ['需求变更'], softwareTags: ['Jira'], mood: '无奈'
    })
    statusId = s.id
    check('发布合规吐槽', !!s.id, `status ${s.id}`)
  } catch (e) { check('发布合规吐槽', false, e.message) }
  try {
    await postStatus({ content: '承接剪辑收费 50 元', themeTags: [], softwareTags: [], mood: '开心' })
    check('违规吐槽被拦截', false)
  } catch (e) {
    check('违规吐槽被拦截', /金钱|交易|收费|违规/.test(e.message), e.message.slice(0, 30))
  }

  // 5. 拉取吐槽列表
  try {
    const list = await fetchStatuses()
    check('拉取吐槽列表', Array.isArray(list.statuses) && list.statuses.length > 0, `${list.statuses.length} 条`)
  } catch (e) { check('拉取吐槽列表', false, e.message) }

  // 6. 同事档案增删改
  let colleagueId = null
  try {
    const c = await addColleague({
      name: '测试同事', relation: '同事', companyName: '测试公司',
      attrs: ['加班狂'], notes: '测试备注'
    })
    colleagueId = c.id
    check('添加同事档案', !!c.id, c.name)
    const u = await updateColleague(c.id, { name: '测试同事改', notes: '改后备注' })
    check('修改同事档案', u.name === '测试同事改', u.name)
  } catch (e) { check('同事档案增改', false, e.message) }

  // 7. 公司属性增删改
  let companyId = null
  try {
    const co = await addCompany({ name: '测试公司', industry: '互联网' })
    companyId = co.id
    check('添加公司属性', !!co.id, co.name)
    const u = await updateCompany(co.id, { industry: '改后行业' })
    check('修改公司属性', u.industry === '改后行业', u.industry)
  } catch (e) { check('公司属性增改', false, e.message) }

  // 8. 会话与消息（与林晓）
  try {
    const linxiao = App.state.users.find((u) => u.userName === '林晓') || App.state.users[1]
    const conv = await openConversation(linxiao.id)
    check('打开会话', !!conv.id, `会话 ${conv.id} · ${conv.partner && conv.partner.userName}`)
    const { messages: msgs, hasMore } = await loadMessages(conv.id)
    check('历史消息', Array.isArray(msgs), `${msgs.length} 条 · hasMore=${hasMore}`)
    const r = await sendMessageRest(conv.id, 'Windows 版测试消息 ' + Date.now())
    check('发送文本消息', !r.blocked)
    const r2 = await sendMessageRest(conv.id, '多少钱')
    check('违禁词拦截', r2.blocked === true, r2.warning ? r2.warning.slice(0, 24) + '…' : '')
  } catch (e) { check('会话/消息', false, e.message) }

  // 9. 上传媒体
  try {
    const fakePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    const url = await uploadMedia(fakePng, 'test.png', 'image/png')
    check('上传媒体', url.startsWith('/uploads/'), url)
  } catch (e) { check('上传媒体', false, e.message) }

  // 10. 版本接口
  try {
    const v = await fetchVersion()
    check('版本接口', !!v.current, v.current)
  } catch (e) { check('版本接口', false, e.message) }

  // 11. 更新头像
  try {
    const fakePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    const url = await uploadMedia(fakePng, 'avatar-test.png', 'image/png')
    await updateProfile({ avatarUrl: url })
    check('更新头像', App.state.user.avatarUrl === url, url)
  } catch (e) { check('更新头像', false, e.message) }

  // 12. 我的吐槽历史（发布 → 过滤 → 删除）
  try {
    const content = '吐槽历史测试 ' + Date.now()
    const created = await postStatus({ content, themeTags: [], softwareTags: [], mood: '开心' })
    await refreshAll()
    const mine = App.state.statuses.filter((s) => String(s.userId) === String(App.state.user.id) && s.content === content)
    check('我的吐槽历史', mine.length === 1, `共 ${App.state.statuses.filter(s => String(s.userId) === String(App.state.user.id)).length} 条`)
    await deleteStatus(created.id)
    await refreshAll()
    const after = App.state.statuses.filter((s) => s.id === created.id)
    check('删除吐槽', after.length === 0)
  } catch (e) { check('我的吐槽历史', false, e.message) }

  // 13. 清理：删除测试同事与公司
  try {
    if (colleagueId) await deleteColleague(colleagueId)
    if (companyId) await deleteCompany(companyId)
    const afterC = await fetchColleagues()
    const afterCo = await fetchCompanies()
    check('清理测试数据', !afterC.colleagues.some(c => c.id === colleagueId) && !afterCo.companies.some(c => c.id === companyId))
  } catch (e) { check('清理测试数据', false, e.message) }

  // 14. 删除前面第 4 步发的测试吐槽（若有）
  try {
    if (statusId) {
      await deleteStatus(statusId)
      check('删除初始测试吐槽', true)
    }
  } catch (e) { check('删除初始测试吐槽', false, e.message) }

  logout()
  console.log(`\n══════ 结果：${passed} 通过 / ${failed} 失败 ══════`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error('测试异常:', e); process.exit(1) })
