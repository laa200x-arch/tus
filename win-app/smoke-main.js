/* Electron 无头 UI smoke 测试：加载真实页面 → 本地 server 登录 → 逐 Tab 截图 → 收集错误 */
console.log('SMOKE START')
const { app } = require('electron')
const path = require('path')
const fs = require('fs')

app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('no-proxy-server')

const OUT = path.join(__dirname, 'smoke-out')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT)

const errors = []
const logs = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  const { BrowserWindow } = require('electron')
  const win = new BrowserWindow({
    width: 1280, height: 860, show: false,
    webPreferences: { contextIsolation: false, nodeIntegration: false, paintWhenInitiallyHidden: true }
  })
  const wc = win.webContents
  wc.on('console-message', (e, level, message) => {
    if (level >= 2) errors.push('[console:' + level + '] ' + message)
    else logs.push(message)
  })
  wc.on('render-process-gone', (e, details) => errors.push('[crash] ' + JSON.stringify(details)))
  wc.on('did-fail-load', (e, code, desc, url) => errors.push('[load-fail] ' + code + ' ' + desc + ' ' + url))

  const waitFrame = () => wc.executeJavaScript(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`)
  const waitFor = async (fnBody, { ms = 100, max = 50 } = {}) => {
    for (let i = 0; i < max; i++) {
      const ok = await wc.executeJavaScript('(' + fnBody + ')()')
      if (ok) return true
      await sleep(ms)
    }
    return false
  }

  const indexUrl = 'file:///' + encodeURI(path.join(__dirname, 'src', 'index.html').replace(/\\/g, '/'))
  await wc.loadURL(indexUrl)
  await sleep(800)

  // 注入本地 server + 清 token
  await wc.executeJavaScript(`
    localStorage.removeItem('jiyu.token');
    localStorage.setItem('jiyu.updateShown', '2.1.3');
    window.__errs = [];
    window.addEventListener('error', (e) => window.__errs.push('JS错误: ' + e.message + ' @' + (e.error && e.error.stack ? e.error.stack.split('\\n').slice(0,3).join(' | ') : (e.filename||'') + ':' + e.lineno)));
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('Promise未捕获: ' + (e.reason && e.reason.message || e.reason) + ' @' + (e.reason && e.reason.stack ? e.reason.stack.split('\\n').slice(0,3).join(' | ') : '')));
    App.SERVER = 'http://localhost:3000';
    'injected'
  `)

  // 诊断：直接 fetch 测试
  const fetchDiag = await wc.executeJavaScript(`
    fetch('http://localhost:3000/api/tags')
      .then(r => 'FETCH_OK status=' + r.status)
      .catch(e => 'FETCH_ERR: ' + e.message)
  `)
  console.log('FETCH DIAG:', fetchDiag)

  // 登录页截图
  await wc.executeJavaScript(`switchView('login'); 'ok'`)
  await waitFrame(); await sleep(500)
  await wc.capturePage().then((img) => fs.writeFileSync(path.join(OUT, '01-login.png'), img.toPNG()))

  // 自动登录
  const loginResult = await wc.executeJavaScript(`
    (async () => {
      document.getElementById('login-username').value = 'aqing'
      document.getElementById('login-password').value = '123456'
      document.getElementById('login-submit').click()
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 250))
        const appEl = document.getElementById('app')
        if (appEl && !appEl.classList.contains('hidden') && App.state.token) return 'LOGGED_IN'
      }
      return 'LOGIN_TIMEOUT: ' + (document.getElementById('login-error') ? document.getElementById('login-error').textContent : 'no error el')
    })()
  `)
  console.log('LOGIN:', loginResult)

  const snap = async (name, file, readyFn) => {
    await wc.executeJavaScript(`switchView('${name}'); 'ok'`)
    if (readyFn) await waitFor(readyFn, { max: 60 })
    await waitFrame(); await sleep(400)
    const info = await wc.executeJavaScript(`({view: App.views.current, bodyLen: (document.querySelector('#view-container,#view,main,.content')||document.body).innerHTML.length, errs: window.__errs.length})`)
    await wc.capturePage().then((img) => fs.writeFileSync(path.join(OUT, file), img.toPNG()))
    console.log('VIEW', name, JSON.stringify(info))
    if (name === 'home') {
      const layers = await wc.executeJavaScript(`
        [...document.querySelectorAll('#home-little-energy .little-energy-layer')].map((img) => {
          const style = getComputedStyle(img)
          return { className: img.className, src: img.getAttribute('src'), naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, display: style.display, opacity: style.opacity, zIndex: style.zIndex }
        })
      `)
      console.log('LITTLE_ENERGY_LAYERS', JSON.stringify(layers))
    }
  }

  await snap('home', '02-home.png', `() => document.getElementById('home-feed') && document.getElementById('home-feed').innerText !== '加载中…'`)
  await snap('complaint', '03-complaint-feed.png', `() => document.querySelector('.complaint-card') !== null`)
  await snap('colleague', '04-colleague.png', `() => document.querySelector('[data-detailcolleague]') !== null`)
  await snap('ai', '05-ai.png', `() => document.getElementById('ai-container') && document.getElementById('ai-container').innerText !== '加载中…'`)
  await snap('company', '06-company.png')
  await snap('mine', '07-mine.png')

  // 吐槽广场子 tab：热搜榜
  await wc.executeJavaScript(`switchView('complaint'); 'ok'`)
  await waitFor(`() => document.querySelectorAll('[data-mode]').length >= 3`)
  const subTabs = await wc.executeJavaScript(`[...document.querySelectorAll('[data-mode]')].map(b => ({txt: (b.textContent||'').trim().slice(0,12), mode: b.dataset.mode}))`)
  console.log('COMPLAINT SUBTABS:', JSON.stringify(subTabs))
  await wc.executeJavaScript(`
    (async () => { [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('热搜')).click(); await new Promise(r => setTimeout(r, 1200)) })()
  `)
  await waitFrame(); await sleep(400)
  await wc.capturePage().then((img) => fs.writeFileSync(path.join(OUT, '08-complaint-hot.png'), img.toPNG()))

  // 发布吐槽弹窗（含 AI 识别）
  const composeResult = await wc.executeJavaScript(`
    (async () => {
      switchView('complaint'); await new Promise(r => setTimeout(r, 800))
      const b = document.getElementById('cp-compose') || [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('发布'))
      if (!b) return 'NO_COMPOSE_BTN'
      b.click(); await new Promise(r => setTimeout(r, 900))
      const mask = document.getElementById('modal-mask')
      const modal = document.getElementById('modal-box')
      if (mask.classList.contains('hidden')) return 'MODAL_NOT_OPEN'
      if (!modal.innerHTML) return 'MODAL_EMPTY'
      const ta = modal.querySelector('#cmp-content')
      if (!ta) return 'MODAL_NO_TEXTAREA: ' + modal.innerHTML.slice(0, 120)
      ta.value = '张三又甩锅，把活都推给别人，领导还夸他'
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise(r => setTimeout(r, 1500))
      const aiBox = modal.textContent
      return 'COMPOSE_OK aiHint=' + (aiBox.includes('甩锅') || aiBox.includes('领导') || aiBox.includes('AI'))
    })()
  `)
  console.log('COMPOSE:', composeResult)
  await waitFrame(); await sleep(300)
  await wc.capturePage().then((img) => fs.writeFileSync(path.join(OUT, '09-compose-ai.png'), img.toPNG()))

  // 关闭弹窗，同事详情（含雷达）
  const cdResult = await wc.executeJavaScript(`
    (async () => {
      const closeBtn = document.querySelector('[data-close]')
      if (closeBtn) { closeBtn.click(); await new Promise(r => setTimeout(r, 300)) }
      switchView('colleague'); await new Promise(r => setTimeout(r, 1000))
      const card = document.querySelector('[data-detailcolleague]')
      if (!card) return 'NO_COLLEAGUE_CARD'
      card.click(); await new Promise(r => setTimeout(r, 2000))
      const radar = document.querySelector('.radar-svg')
      return 'DETAIL_OK radarSvg=' + !!radar + ' ai=' + (document.getElementById('cd-ai') ? document.getElementById('cd-ai').innerHTML.length : -1)
    })()
  `)
  console.log('COLLEAGUE DETAIL:', cdResult)
  await waitFor(`() => document.querySelector('.radar-svg') !== null`, { max: 60 })
  await waitFrame(); await sleep(400)
  await wc.capturePage().then((img) => fs.writeFileSync(path.join(OUT, '10-colleague-radar.png'), img.toPNG()))

  const pageErrs = await wc.executeJavaScript('window.__errs')
  if (pageErrs && pageErrs.length) errors.push(...pageErrs.map(e => '[page] ' + e))

  console.log('\n==== SMOKE SUMMARY ====')
  console.log('ERRORS(' + errors.length + '):')
  errors.forEach((e) => console.log('  ' + e))
  console.log('LOG SAMPLE:', logs.slice(0, 10).join(' | ').slice(0, 600))
  app.exit(errors.length ? 1 : 0)
}).catch((e) => { console.error('SMOKE FAILED:', e); app.exit(1) })
