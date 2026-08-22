// Electron 无头 UI 冒烟：登录 → 依次切换全部 Tab → 收集渲染 JS 错误
const { app, BrowserWindow } = require('electron')
const path = require('path')

app.whenReady().then(async () => {
  const errors = []
  const w = new BrowserWindow({
    show: false, width: 1400, height: 900,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  })
  w.webContents.on('console-message', (e, level, message) => { if (level >= 3) errors.push(message) })
  w.webContents.on('render-process-gone', (e, d) => errors.push('render-gone: ' + d.reason))

  try {
    await w.loadFile(path.join(__dirname, 'src', 'index.html'))
    // 真实登录：fetch 拿 token → 写入 localStorage → reload 触发 autoLogin
    const loginOk = await w.webContents.executeJavaScript(`
      (async () => {
        try {
          const r = await fetch('http://43.157.17.88:8020/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'aqing', password: '123456' })
          })
          const d = await r.json()
          if (d.token) {
            localStorage.setItem('jiyu.token', d.token)
            localStorage.setItem('jiyu.accounts', JSON.stringify([{ username: 'aqing', nickname: '阿青' }]))
            return true
          }
          return false
        } catch (err) { return 'ERR:' + err.message }
      })()
    `)
    console.log('LOGIN_SET:', loginOk)
    if (loginOk !== true) { console.log('SMOKE_RESULT: FAIL login'); app.exit(1); return }

    await w.webContents.executeJavaScript(`location.reload()`)
    await new Promise((r) => setTimeout(r, 3500)) // 等 autoLogin + 首页加载

    // 依次切换各 Tab，每个等 1.2s
    const tabs = ['home', 'complaint', 'colleague', 'ai', 'company', 'mine']
    const results = []
    for (const t of tabs) {
      const r = await w.webContents.executeJavaScript(`
        (async () => {
          try {
            if (typeof switchView !== 'function') return 'NO_SWITCH_VIEW'
            switchView('${t}')
            await new Promise((res) => setTimeout(res, 1200))
            const v = document.getElementById('view')
            return { tab: '${t}', htmlLen: v ? v.innerHTML.length : -1, text: v ? v.textContent.slice(0, 60).replace(/\\s+/g, ' ') : '' }
          } catch (err) { return { tab: '${t}', err: err.message } }
        })()
      `)
      results.push(r)
      console.log('TAB', JSON.stringify(r))
    }
    // v3 验证：进入第一个同事详情（品行系统 + 聊天分析渲染）
    const detail = await w.webContents.executeJavaScript(`
      (async () => {
        try {
          if (typeof renderColleagueDetail === 'function' && App.state.colleagues && App.state.colleagues[0]) {
            renderColleagueDetail(App.state.colleagues[0].id)
          }
          await new Promise((res) => setTimeout(res, 1800))
          const v = document.getElementById('view')
          const html = v ? v.innerHTML : ''
          return { hasPersona: html.includes('品行系统'), hasAnalysis: html.includes('聊天记录分析'), len: html.length }
        } catch (err) { return { err: err.message } }
      })()
    `)
    console.log('V3_DETAIL', JSON.stringify(detail))
    const errCount = errors.length
    console.log('CONSOLE_ERRORS:', errCount, errCount ? errors.slice(0, 5).join(' || ') : '')
    console.log('SMOKE_RESULT:', results.every((r) => r && !r.err && r.htmlLen > 0) && detail && !detail.err && detail.hasPersona && errCount === 0 ? 'PASS' : 'FAIL')
  } catch (e) {
    console.log('SMOKE_EXEC_ERR:', e.message)
    console.log('SMOKE_RESULT: FAIL')
  }
  app.exit(0)
})
