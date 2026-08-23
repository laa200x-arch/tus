/* 同事照片头像 + 经典语录 冒烟测试（连远程 8020） */
const {
  App, login, logout,
  addColleague, updateColleague, deleteColleague, uploadMedia
} = require('./src/api.js')

let passed = 0, failed = 0
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('  ✅', name, extra) }
  else { failed++; console.log('  ❌', name, extra) }
}

async function main() {
  console.log('══════ 同事照片头像 + 经典语录 ══════\n')
  await login('aqing', '123456')
  check('登录', !!App.state.token)

  let cid = null
  try {
    // 1. 上传照片
    const fakePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    const url = await uploadMedia(fakePng, 'colleague-avatar.png', 'image/png')
    check('上传头像照片', url.startsWith('/uploads/'), url)

    // 2. 添加同事（照片 + 语录）
    const c = await addColleague({
      name: '语录测试员', position: '测试工程师',
      avatarUrl: url, quote: '这个需求很简单，明天就能上线！'
    })
    cid = c.id
    check('添加同事(照片+语录)', !!c.avatarUrl && c.quote.includes('很简单'), `quote=${c.quote}`)

    // 3. 修改语录
    const u = await updateColleague(cid, { quote: '在我这里，从来没有 Bug，只有需求调整。' })
    check('修改语录', u.quote.includes('需求调整'), u.quote)
  } catch (e) { check('同事照片/语录', false, e.message) }

  // 清理
  try { if (cid) await deleteColleague(cid) } catch (e) { /* ignore */ }

  logout()
  console.log(`\n══════ 结果：${passed} 通过 / ${failed} 失败 ══════`)
  process.exit(failed > 0 ? 1 : 0)
}
main().catch((e) => { console.error('异常:', e.message); process.exit(1) })
