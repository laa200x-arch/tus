/* Dump home view DOM to verify content exists when screenshot appears blank */
const { app } = require('electron')
app.commandLine.appendSwitch('no-sandbox'); app.commandLine.appendSwitch('disable-gpu'); app.commandLine.appendSwitch('no-proxy-server')
const path = require('path'); const fs = require('fs')
app.whenReady().then(async () => {
  const { BrowserWindow } = require('electron')
  const win = new BrowserWindow({ width: 1280, height: 860, show: false, webPreferences: { contextIsolation: false, nodeIntegration: false, paintWhenInitiallyHidden: true } })
  const wc = win.webContents
  await wc.loadURL('file:///' + encodeURI(path.join(__dirname, 'src', 'index.html').replace(/\\/g, '/')))
  await new Promise(r => setTimeout(r, 800))
  await wc.executeJavaScript(`localStorage.removeItem('jiyu.token'); App.SERVER='http://localhost:8020'; 'ok'`)
  await wc.executeJavaScript(`
    (async () => {
      document.getElementById('login-username').value = 'winapp_tester'
      document.getElementById('login-password').value = '123456'
      document.getElementById('login-submit').click()
      for (let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,250)); if(App.state.token) return 'ok' }
      return 'timeout'
    })()
  `)
  await new Promise(r => setTimeout(r, 500))
  await wc.executeJavaScript(`switchView('home'); 'ok'`)
  await new Promise(r => setTimeout(r, 3000))
  await wc.executeJavaScript(`new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)))`)
  await new Promise(r => setTimeout(r, 300))
  const html = await wc.executeJavaScript(`document.getElementById('view').innerHTML`)
  fs.writeFileSync(path.join(__dirname, 'smoke-out', 'home-dom.html'), html)
  const rect = await wc.executeJavaScript(`{const e=document.getElementById('view'); return {display:e.style.display, visibility:getComputedStyle(e).visibility, opacity:getComputedStyle(e).opacity, width:e.offsetWidth, height:e.offsetHeight, hidden:e.classList.contains('hidden'), appHidden:document.getElementById('app').classList.contains('hidden')}}`)
  console.log('VIEW RECT:', JSON.stringify(rect))
  await wc.capturePage().then(img => fs.writeFileSync(path.join(__dirname, 'smoke-out', '02-home-retry.png'), img.toPNG()))
  console.log('DUMP DONE')
  app.exit(0)
}).catch(e => { console.error(e); app.exit(1) })
