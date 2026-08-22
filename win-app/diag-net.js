const { app } = require('electron')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('no-proxy-server')
app.commandLine.appendSwitch('allow-file-access-from-files')

app.whenReady().then(async () => {
  const { BrowserWindow } = require('electron')
  const win = new BrowserWindow({ width: 800, height: 600, show: false })
  const wc = win.webContents
  const errs = []
  wc.on('console-message', (e, level, msg) => { if (level >= 2) errs.push(msg) })
  await wc.loadURL('data:text/html,<h1>hi</h1>')
  const path = require('path')
  const indexUrl = 'file:///' + encodeURI(path.join(__dirname, 'src', 'index.html').replace(/\\/g, '/'))
  await wc.loadURL(indexUrl)
  const tests = await wc.executeJavaScript(`
    (async () => {
      const out = []
      const t = async (name, url) => {
        try { const r = await fetch(url, { mode: 'cors' }); out.push(name + ' OK ' + r.status) }
        catch (e) { out.push(name + ' ERR ' + e.message) }
      }
      await t('127.0.0.1:8020', 'http://127.0.0.1:8020/api/tags')
      await t('localhost:8020', 'http://localhost:8020/api/tags')
      await t('example.com', 'http://example.com/')
      return out
    })()
  `)
  console.log('FETCH TESTS:', JSON.stringify(tests))
  console.log('CONSOLE ERRS:', JSON.stringify(errs))
  app.exit(0)
})
