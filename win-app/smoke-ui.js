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
    // 支持 TUS_SERVER 环境变量指向本地服务器；默认生产地址
    const server = process.env.TUS_SERVER || 'http://43.157.17.88:8020'
    await w.loadFile(path.join(__dirname, 'src', 'index.html'), server && server !== 'http://43.157.17.88:8020' ? { query: { server } } : {})
    // 真实登录：fetch 拿 token → 写入 localStorage → reload 触发 autoLogin
    const loginOk = await w.webContents.executeJavaScript(`
      (async () => {
        try {
          const base = new URLSearchParams(location.search).get('server') || 'http://43.157.17.88:8020'
          const r = await fetch(base + '/api/auth/login', {
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
    // 等待 autoLogin 完成（成功进入首页 或 回登录页），避免竞态
    const entered = await w.webContents.executeJavaScript(`
      (async () => {
        for (let i = 0; i < 40; i++) {
          await new Promise((r) => setTimeout(r, 250))
          try {
            if (typeof App !== 'undefined' && App.state && App.state.user) return 'USER'
            if (typeof App !== 'undefined' && App.state && !App.state.token && !document.getElementById('login-page').classList.contains('hidden')) return 'LOGIN'
          } catch (e) { /* ignore */ }
        }
        return 'TIMEOUT'
      })()
    `)
    console.log('AFTER_RELOAD:', entered)
    await new Promise((r) => setTimeout(r, 1500)) // 等首页数据填充

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
    // v3 验证：首页重构 Dashboard（Hero / 四统计卡 / 情绪卡 / 最新吐槽 / 人格 / 同事概况）
    const home = await w.webContents.executeJavaScript(`
      (async () => {
        try {
          switchView('home')
          await new Promise((r) => setTimeout(r, 2500))
          const v = document.getElementById('view')
          const html = v ? v.innerHTML : ''
          return {
            hasHero: html.includes('home-dash-hero'),
            statCount: v ? v.querySelectorAll('.home-dash-stat').length : 0,
            hasMood: html.includes('home-dash-mood'),
            hasComplaint: html.includes('home-dash-complaint'),
            hasPersonality: html.includes('home-dash-personality'),
            hasColleagueSummary: html.includes('home-dash-colleague-summary'),
            hasQuickLinks: html.includes('home-dash-quicklinks'),
            noBlockingSpinner: !html.includes('home-loading-full') && !html.includes('loading-overlay'),
            hasSettled: ['loaded', 'failed'].includes(App.state.homeOverviewPhase),
            len: html.length
          }
        } catch (err) { return { err: err.message } }
      })()
    `)
    console.log('V3_HOME', JSON.stringify(home))
    // 发布入口：Windows 保留侧栏，打开四种发布动作而非复制手机底栏
    const publish = await w.webContents.executeJavaScript(`
      (async () => {
        const button = document.getElementById('sidebar-publish')
        if (!button) return { err: 'missing sidebar publish' }
        button.click()
        await new Promise((r) => setTimeout(r, 250))
        const modal = document.getElementById('modal-box')
        const mask = document.getElementById('modal-mask')
        const count = modal ? modal.querySelectorAll('[data-publish]').length : 0
        const open = !!mask && !mask.classList.contains('hidden')
        document.querySelector('#modal-box [data-close]')?.click()
        return { open, count }
      })()
    `)
    console.log('V3_PUBLISH', JSON.stringify(publish))
    // v3 验证：消息中心抽屉（tabs + 通知）
    const notif = await w.webContents.executeJavaScript(`
      (async () => {
        try {
          if (typeof openMessageDrawer === 'function') await openMessageDrawer()
          await new Promise((res) => setTimeout(res, 1500))
          const mask = document.getElementById('msg-drawer-mask')
          const body = document.getElementById('msg-drawer-body')
          const tabs = document.getElementById('msg-tabs')
          return {
            open: mask && !mask.classList.contains('hidden'),
            hasTabs: tabs ? tabs.querySelectorAll('button').length : 0,
            bodyLen: body ? body.innerHTML.length : 0,
            hasNotif: body ? body.innerHTML.includes('notif-item') : false
          }
        } catch (err) { return { err: err.message } }
      })()
    `)
    console.log('V3_NOTIF', JSON.stringify(notif))
    // 同事宇宙 + 分享图验证
    const uni = await w.webContents.executeJavaScript(`
      (async () => {
        try {
          switchView('colleague')
          await new Promise((r) => setTimeout(r, 1500))
          const v = document.getElementById('view')
          const html = v ? v.innerHTML : ''
          const tabs = v ? v.querySelectorAll('#cu-tabs button').length : 0
          let shareBtn = false
          switchView('ai')
          await new Promise((r) => setTimeout(r, 1500))
          const aiHtml = document.getElementById('view') ? document.getElementById('view').innerHTML : ''
          shareBtn = aiHtml.includes('ps-share')
          return { hasUniverse: html.includes('同事宇宙'), tabCount: tabs, hasShareBtn: shareBtn }
        } catch (err) { return { err: err.message } }
      })()
    `)
    console.log('V3_UNIVERSE', JSON.stringify(uni))
    // 同事表单：照片上传 + 经典语录
    const form = await w.webContents.executeJavaScript(`
      (async () => {
        try {
          if (typeof showColleagueForm === 'function') showColleagueForm(null)
          await new Promise((r) => setTimeout(r, 800))
          const v = document.getElementById('view')
          const html = v ? v.innerHTML : ''
          return { hasAvatarPick: html.includes('cf-avatar-pick'), hasQuote: html.includes('cf-quote') }
        } catch (err) { return { err: err.message } }
      })()
    `)
    console.log('V3_FORM', JSON.stringify(form))
    const errCount = errors.length
    console.log('CONSOLE_ERRORS:', errCount, errCount ? errors.slice(0, 5).join(' || ') : '')
    const homeOk = home && !home.err && home.hasHero && home.statCount === 4 && home.hasMood &&
      home.hasComplaint && home.hasPersonality && home.hasColleagueSummary &&
      home.noBlockingSpinner && home.hasSettled
    const publishOk = publish && !publish.err && publish.open && publish.count === 4
    console.log('SMOKE_RESULT:', results.every((r) => r && !r.err && r.htmlLen > 0) && detail && !detail.err && detail.hasPersona && homeOk && publishOk && errCount === 0 ? 'PASS' : 'FAIL')
  } catch (e) {
    console.log('SMOKE_EXEC_ERR:', e.message)
    console.log('SMOKE_RESULT: FAIL')
  }
  app.exit(0)
})
