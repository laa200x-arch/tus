/* ============================================================
 * 职场那些事 Windows 版 - 视图层（登录/同事状态/消息/同事属性/我的）
 * 主题四维：同事属性 / 公司属性 / 主题 / 软件
 * ============================================================ */
'use strict'

const LE = globalThis.LittleEnergy
const { MOODS, LOOKS, normalizeMood, normalizeOutfit, resolveLook, littleEnergyAvatarHtml, littleEnergyEmojiPayload, messageOutfit, applyMoodToday, routeDataChange, littleEnergyAssetSources, loadCanvasImage, userAvatarHtml, personalityTitle, compatibleMoodPayload } = LE
function currentMoodId() { return normalizeMood(App.state.moodToday && App.state.moodToday.mood) }
function currentOutfit() { return normalizeOutfit(App.state.user && App.state.user.littleEnergyOutfit) }
function moodChoiceHtml(m, className = 'mood-choice') {
  return `<button type="button" class="${className}" data-mood="${m.id}">${littleEnergyAvatarHtml({ moodId: m.id, outfit: currentOutfit(), className: 'little-energy-sm' })}<span>${esc(m.label)}</span></button>`
}

/* ---------- 工具 ---------- */
function esc(s) {  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// v3 Skeleton 骨架屏（加载占位）
function skeletonFeed(n = 3) {
  let s = ''
  for (let i = 0; i < n; i++) {
    s += `<div class="card sk-card"><div class="row"><div class="skeleton sk-avatar"></div><div style="flex:1"><div class="skeleton sk-line w60"></div><div class="skeleton sk-line w80"></div><div class="skeleton sk-line w40"></div></div></div></div>`
  }
  return s
}
function skeletonBox(rows = 2) {
  let s = ''
  for (let i = 0; i < rows; i++) s += `<div class="skeleton sk-line w80"></div>`
  return `<div class="sk-card">${s}</div>`
}

// 同事头像：有照片显示照片，否则显示符号
function colleagueAvatarHtml(c, cls) {
  return littleEnergyAvatarHtml({ role: 'darkColleague', className: cls })
}
// 小头像（chips 用）：照片 20px 圆图 / emoji
function colleagueAvatarMini(c) {
  return littleEnergyAvatarHtml({ role: 'darkColleague', className: 'little-energy-mini' })
}


function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function mediaUrl(u) { return u ? App.SERVER + u : '' }
function avatarHtml(user, cls = 'avatar') {
  return userAvatarHtml(user, { className: cls, moodId: user && user.moodId })
}
/* 通用标签渲染（同事属性 / 主题 / 软件） */
function tagsHtml(tags, cls = 'tag') {
  if (!tags || !tags.length) return '<span class="card-sub">暂无</span>'
  return tags.map((t) => `<span class="${cls}">${esc(t)}</span>`).join(' ')
}
function toast(msg) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.remove('hidden')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => el.classList.add('hidden'), 2600)
}
function openModal(html, onMount) {
  const box = document.getElementById('modal-box')
  box.innerHTML = `<button class="modal-close" data-close title="关闭">✕</button><div class="modal-scroll">${html}</div>`
  document.getElementById('modal-mask').classList.remove('hidden')
  if (onMount) onMount(box)
}
function closeModal() { document.getElementById('modal-mask').classList.add('hidden') }

function contentHistory() {
  if (!App.views.contentHistory) App.views.contentHistory = ContentPageHistory.createContentPageHistory()
  return App.views.contentHistory
}

function setContentPage(target) {
  const history = contentHistory()
  const current = history.current()
  if (!current) history.push(target)
  else if (current.page === target.page) Object.assign(current, target)
  App.views.contentPage = target
}

function pushContentPage(target) {
  const history = contentHistory()
  if (!history.current()) history.push(App.views.contentPage || { page: 'tab', tab: App.views.current || 'home' })
  history.push(target)
  renderContentPage(target)
}

function popContentPage() {
  const target = contentHistory().pop()
  if (target) return renderContentPage(target)
  switchView('complaint')
}

function renderContentPage(target) {
  if (target.page === 'tab') return switchView(target.tab)
  if (target.page === 'complaint-feed') return renderComplaint(target.options || {})
  if (target.page === 'complaint-detail') return renderComplaintDetailPage(target.complaintID, target.focusComments)
  if (target.page === 'complaint-compose') return renderComplaintComposePage()
  if (target.page === 'profile-edit') return renderProfileEditorPage()
  if (target.page === 'version-notice') return renderVersionNoticePage()
  switchView('complaint')
}
function bindModalMask() {
  document.getElementById('modal-mask').addEventListener('click', (e) => {
    if (e.target.id === 'modal-mask') closeModal()
  })
}
function bindGlobalDelegates() {
  document.addEventListener('click', (e) => {
    const close = e.target.closest('[data-close]')
    if (close) return closeAllMasks()
    const fs = e.target.closest('[data-fullscreen]')
    if (fs) return openFullscreen(`<img src="${fs.currentSrc || fs.src}" alt="">`)
    const vid = e.target.closest('[data-video]')
    if (vid) return openFullscreen(`<video src="${vid.dataset.video}" controls autoplay></video>`)
    const au = e.target.closest('[data-audio]')
    if (au) return playAudio(au.dataset.audio)
    const loc = e.target.closest('[data-lat]')
    if (loc) {
      const lat = loc.dataset.lat
      const lng = loc.dataset.lng
      const win = window.open('', '_blank')
      if (win) win.location = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
    }
  })
  // v3 全局关闭规则：ESC 关闭所有遮罩
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllMasks()
  })
  // 消息中心抽屉：点击空白遮罩关闭
  const msgMask = document.getElementById('msg-drawer-mask')
  if (msgMask) msgMask.addEventListener('click', (e) => {
    if (e.target.id === 'msg-drawer-mask') closeAllMasks()
  })
}
function closeAllMasks() {
  const modal = document.getElementById('modal-mask')
  if (modal) modal.classList.add('hidden')
  const msg = document.getElementById('msg-drawer-mask')
  if (msg) msg.classList.add('hidden')
}
function openFullscreen(html) {
  const mask = document.createElement('div')
  mask.className = 'fullscreen-mask'
  mask.innerHTML = html + '<button class="fullscreen-close" data-close-fullscreen title="关闭">✕</button>'
  document.body.appendChild(mask)
  mask.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-fullscreen]') || e.target === mask) mask.remove()
  })
}
function compressImage(file, maxSide = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (Math.max(width, height) > maxSide) {
        const scale = maxSide / Math.max(width, height)
        width = Math.round(width * scale); height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7)
    }
    img.onerror = () => reject(new Error('图片读取失败'))
    img.src = url
  })
}

/* ---------- 登录页 ---------- */
function renderLogin() {
  const page = document.getElementById('login-page')
  page.classList.remove('hidden')
  document.getElementById('app').classList.add('hidden')
  const box = document.getElementById('saved-accounts')
  if (App.state.savedAccounts.length) {
    box.classList.remove('hidden')
    box.innerHTML = '<div style="width:100%;text-align:center;color:#737d87;font-size:11px;margin-bottom:4px">已保存账号（点击切换）</div>' +
      App.state.savedAccounts.map((a) => `
        <div class="saved-account" data-username="${esc(a.username)}">
          <span class="saved-remove" data-remove="${esc(a.username)}" title="删除">✕</span>
          <div class="saved-avatar">${avatarHtml(a, 'little-energy-saved-avatar')}</div>
          <div class="saved-name">${esc(a.nickname)}</div>
        </div>`).join('')
  } else {
    box.classList.add('hidden')
  }
}

/* ---------- 我的同事状态（原互换动态） ---------- */
const STATUS_THEMES = ['开会', '甩锅', '需求变更', '摸鱼', '请假', '团建', '加班', '绩效', '画饼', '背锅', '跨部门', '甩锅大会']
const STATUS_SOFTWARE = ['钉钉', '飞书', '企业微信', '微信', 'Excel', 'PPT', '邮件', '腾讯文档', 'OA系统', 'Zoom', 'Teams']
async function renderStatus() {
  const v = document.getElementById('view')
  v.innerHTML = `
    <div class="row" style="margin-bottom:14px">
      <span class="section-title" style="margin:0;flex:1">我的同事状态</span>
      <button class="btn btn-outline btn-sm" id="status-refresh" title="刷新">⟳ 刷新</button>
      <button class="btn btn-primary btn-sm" id="status-compose">✏️ 记一笔</button>
    </div>
    <div id="status-list"></div>`
  v.querySelector('#status-compose').addEventListener('click', showStatusCompose)
  v.querySelector('#status-refresh').addEventListener('click', () => renderStatus())
  const list = v.querySelector('#status-list')
  list.innerHTML = '<div class="empty">加载中…</div>'
  try {
    const data = await fetchStatuses()
    App.state.statuses = data.statuses
    if (!App.state.statuses.length) {
      list.innerHTML = '<div class="empty"><div class="empty-icon">🗒️</div>还没有记录<br>点击右上角「记一笔」，吐槽一下你的同事吧</div>'
      return
    }
    list.innerHTML = App.state.statuses.map((d) => `
      <div class="card feed-item">
        ${avatarHtml(d, 'avatar avatar-sm')}
        <div class="feed-body">
          <div class="feed-head">
            <span class="feed-author">${esc(d.authorName)}</span>
            <span class="card-sub">›</span>
            <span class="feed-time">${fmtTime(d.time)}</span>
          </div>
          <div class="feed-content">${esc(d.content)}</div>
          ${d.colleagueName ? `<div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px"><span class="tag tag-vip">👤 ${esc(d.colleagueName)}</span></div>` : ''}
          ${d.themeTags && d.themeTags.length ? `<div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px"><span class="card-sub">主题</span>${d.themeTags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
          ${d.softwareTags && d.softwareTags.length ? `<div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px"><span class="card-sub">软件</span>${d.softwareTags.map((t) => `<span class="tag tag-verified">${esc(t)}</span>`).join('')}</div>` : ''}
          ${d.mood ? `<div class="row" style="margin-top:6px"><span class="card-sub">心情 ${esc(d.mood)}</span></div>` : ''}
          ${String(d.userId) === String(App.state.user.id) ? `<div class="row" style="margin-top:8px"><span class="spacer"></span><button class="btn btn-danger btn-sm" data-del="${d.id}">删除</button></div>` : ''}
        </div>
      </div>`).join('')
    list.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('删除这条状态？')) return
      try {
        await deleteStatus(b.dataset.del)
        App.state.statuses = App.state.statuses.filter((x) => String(x.id) !== b.dataset.del)
        toast('已删除')
        renderStatus()
      } catch (e) { toast('删除失败：' + e.message) }
    }))
  } catch (e) {
    list.innerHTML = `<div class="empty">加载失败：${esc(e.message)}</div>`
  }
}

/* 记一笔（内容 + 关联同事 + 主题 + 软件 + 心情） */
function showStatusCompose() {
  const colleagues = App.state.colleagues || []
  openModal(`
    <div class="modal-title">记一笔 · 同事状态</div>
    <div class="form-field"><label>关联同事（选填）</label>
      <select id="st-colleague"><option value="">不指定</option>${colleagues.map((c) => `<option value="${c.id}">${esc(c.name)}（${esc(c.position || '')}）</option>`).join('')}</select>
    </div>
    <div class="form-field"><textarea id="st-content" placeholder="记录一下这位同事的状态 / 你的吐槽…"></textarea></div>
    <div class="form-field"><label>主题标签（可多选）</label>
      <div class="pet-chips" id="st-themes">${STATUS_THEMES.map((t) => `<button type="button" class="pet-chip" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    </div>
    <div class="form-field"><label>涉及软件（可多选）</label>
      <div class="pet-chips" id="st-software">${STATUS_SOFTWARE.map((t) => `<button type="button" class="pet-chip" data-s="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    </div>
    <div class="form-field"><label>心情</label>
      <div class="little-energy-mood-grid" id="st-mood">${MOODS.map((m) => moodChoiceHtml(m, 'mood-choice')).join('')}</div>
    </div>
    <div class="card-sub" style="color:#f29e4d;margin-bottom:10px">⚠️ 吐槽请遵守社区规范，请勿人身攻击、泄露隐私</div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-close>取消</button>
      <button class="btn btn-primary" id="st-submit">发布</button>
    </div>
  `, (box) => {
    let selectedMood = MOODS[0].id
    box.querySelectorAll('#st-mood .mood-choice').forEach((button) => button.addEventListener('click', () => {
      selectedMood = button.dataset.mood
      box.querySelectorAll('#st-mood .mood-choice').forEach((item) => item.classList.toggle('active', item === button))
    }))
    const themeSel = new Set()
    box.querySelectorAll('#st-themes .pet-chip').forEach((c) => c.addEventListener('click', () => {
      c.classList.toggle('active'); const t = c.dataset.t
      if (c.classList.contains('active')) themeSel.add(t); else themeSel.delete(t)
    }))
    const softSel = new Set()
    box.querySelectorAll('#st-software .pet-chip').forEach((c) => c.addEventListener('click', () => {
      c.classList.toggle('active'); const t = c.dataset.s
      if (c.classList.contains('active')) softSel.add(t); else softSel.delete(t)
    }))
    box.querySelector('#st-submit').addEventListener('click', async () => {
      const content = box.querySelector('#st-content').value.trim()
      if (!content) return toast('请输入内容')
      try {
        await postStatus({
          content,
          colleagueId: box.querySelector('#st-colleague').value || null,
          themeTags: [...themeSel],
          softwareTags: [...softSel],
          mood: compatibleMoodPayload(selectedMood)
        })
        closeModal()
        toast('✅ 已记录')
        renderStatus()
      } catch (e) { toast('发布失败：' + e.message) }
    })
  })
}

/* ---------- 同事属性（原宠物 → 同事档案） ---------- */
const COLLEAGUE_ATTRS = ['工作风格', '性格', '摸鱼指数', '甩锅倾向', '沟通风格', '靠谱度', '情商', '边界感', '执行力', '玻璃心']
const COLLEAGUE_RELATIONS = ['上级', '平级', '下级', '跨部门', '外包', '实习']

async function renderColleagues() {
  const v = document.getElementById('view')
  v.innerHTML = `
    <div class="apple-header">
      <div class="apple-title">${uiAssetImg('rowColleague', 'section-leading-asset', '')} 同事宇宙</div>
      <div class="apple-subtitle">我的同事 · 领导画像 · 关系地图</div>
    </div>
    <div class="cp-tabs" id="cu-tabs">
      <button class="active" data-cu="all">我的同事</button>
      <button data-cu="leaders">领导画像</button>
      <button data-cu="map">关系地图</button>
    </div>
    <div class="pet-section" style="margin-top:10px">
      <div class="pet-section-head">
        <span class="pet-section-title" id="cu-title">同事档案</span>
        <button class="pet-edit-btn" id="colleague-add" style="width:auto;padding:0 14px;border-radius:999px;font-weight:700">${uiAssetImg('actionAdd', 'inline-action-asset', '')} 添加</button>
      </div>
      <div id="colleague-list"></div>
    </div>
    <div class="pet-section">
      <div class="pet-section-head">
        <span class="pet-section-title">${uiAssetImg('rowCompany', 'section-leading-asset', '')} 我的公司</span>
        <button class="pet-edit-btn" id="company-add" style="width:auto;padding:0 14px;border-radius:999px;font-weight:700">${uiAssetImg('actionAdd', 'inline-action-asset', '')} 新建</button>
      </div>
      <div id="company-list"></div>
    </div>`
  v.querySelector('#colleague-add').addEventListener('click', () => showColleagueForm())
  v.querySelector('#company-add').addEventListener('click', () => showCompanyForm())
  v.querySelectorAll('#cu-tabs button').forEach((b) => b.addEventListener('click', () => {
    v.querySelectorAll('#cu-tabs button').forEach((x) => x.classList.toggle('active', x === b))
    renderColleagueSegment(b.dataset.cu)
  }))
  await Promise.all([
    fetchCompanies().then(() => renderCompanies()),
    fetchColleagues().then(() => renderColleagueSegment('all'))
  ])
}

// 同事宇宙分段渲染
function renderColleagueSegment(seg) {
  const el = document.getElementById('colleague-list')
  const title = document.getElementById('cu-title')
  if (!el || !title) return
  const all = App.state.colleagues || []
  if (seg === 'map') {
    title.textContent = '关系地图'
    return renderRelationMap(el)
  }
  if (seg === 'leaders') {
    const leaders = all.filter((c) => (c.relation || '').includes('领导') || (c.workplaceType || '').includes('领导'))
    title.textContent = `领导画像（${leaders.length}）`
    return renderColleagueCards(leaders)
  }
  title.textContent = `同事档案（${all.length}）`
  renderColleagueCards(all)
}

// 关系地图：按与我的关系分组
function renderRelationMap(el) {
  const all = App.state.colleagues || []
  if (!all.length) {
    el.innerHTML = `<div class="pet-group pet-empty"><div class="pet-empty-icon">🗺️</div><div class="pet-empty-title">还没有同事</div><div class="pet-empty-sub">添加同事后这里会按关系生成地图</div></div>`
    return
  }
  const groups = {}
  for (const c of all) {
    const rel = c.relation || '其他'
    ;(groups[rel] = groups[rel] || []).push(c)
  }
  el.innerHTML = Object.entries(groups).map(([rel, list]) => `
    <div style="margin-bottom:14px">
      <div class="pet-section-title" style="margin-bottom:8px">${esc(rel)}（${list.length}）</div>
      <div class="home-colleague-row">${list.map((c) => `
        <div class="home-colleague-chip" data-cid="${c.id}" title="${esc(c.position || '')}">
          ${colleagueAvatarMini(c)}<span>${esc(c.name)}</span>
          ${c.riskLevel ? `<span class="tag" style="font-size:10px;padding:0 6px">${esc(c.riskLevel)}</span>` : ''}
        </div>`).join('')}</div>
    </div>`).join('')
  el.querySelectorAll('.home-colleague-chip').forEach((chip) => chip.addEventListener('click', () => {
    renderColleagueDetail(chip.dataset.cid)
  }))
}

function renderColleagueCards(list) {
  const el = document.getElementById('colleague-list')
  if (!el) return
  const items = list || App.state.colleagues
  if (!items.length) {
    el.innerHTML = `
      <div class="pet-group pet-empty">
        <div class="pet-empty-icon">👥</div>
        <div class="pet-empty-title">添加你的第一位同事</div>
        <div class="pet-empty-sub">记录姓名、职位、与你的关系，AI 会自动生成关系雷达</div>
      </div>`
    return
  }
  el.innerHTML = items.map((c) => {
    const company = (App.state.companies || []).find((x) => String(x.id) === String(c.companyId))
    return `
    <div class="pet-card-main" data-detailcolleague="${c.id}" style="margin-bottom:10px">
      ${colleagueAvatarHtml(c, 'pet-card-avatar')}
      <div class="pet-card-info">
        <div class="pet-card-name">${esc(c.name)} <span class="card-sub">· ${esc(c.position || '')}</span></div>
        <div class="pet-card-meta">${esc(c.relation || '未填关系')}${company ? ' · ' + esc(company.name) : ''}${c.department ? ' · ' + esc(c.department) : ''}</div>
        ${c.attributeTags && c.attributeTags.length
          ? `<div class="pet-card-tags">${c.attributeTags.slice(0, 5).map((b) => `<span class="pet-tag">${esc(b)}</span>`).join('')}</div>`
          : ''}
      </div>
      <button class="pet-edit-btn" data-editcolleague-btn="${c.id}" title="编辑档案">✎</button>
      <span class="pet-card-chevron">›</span>
    </div>`
  }).join('')
  el.querySelectorAll('[data-detailcolleague]').forEach((card) => card.addEventListener('click', (e) => {
    if (e.target.closest('[data-editcolleague-btn]')) return
    renderColleagueDetail(card.dataset.detailcolleague)
  }))
  el.querySelectorAll('[data-editcolleague-btn]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    showColleagueForm(items.find((c) => c.id === b.dataset.editcolleagueBtn))
  }))
}

function renderCompanies() {
  const el = document.getElementById('company-list')
  if (!App.state.companies || !App.state.companies.length) {
    el.innerHTML = '<div class="card-sub">还没有公司档案，点击「＋ 新建公司」添加</div>'
    return
  }
  el.innerHTML = App.state.companies.map((c) => `
    <div class="card" data-editcompany="${c.id}" style="margin-bottom:8px;cursor:pointer">
      <div class="row">
        <div style="flex:1">
          <div class="convo-name">${esc(c.name)} <span class="card-sub">${esc(c.industry || '')}</span></div>
          <div class="card-sub">规模 ${esc(c.scale || '—')} · 加班文化 ${esc(c.overtimeCulture || '—')} · 福利 ${esc(c.welfare || '—')}${c.location ? ' · ' + esc(c.location) : ''}</div>
        </div>
        <button class="pet-edit-btn" data-delcompany="${c.id}" title="删除">🗑</button>
      </div>
    </div>`).join('')
  el.querySelectorAll('[data-editcompany]').forEach((card) => card.addEventListener('click', (e) => {
    if (e.target.closest('[data-delcompany]')) return
    showCompanyForm(App.state.companies.find((c) => c.id === card.dataset.editcompany))
  }))
  el.querySelectorAll('[data-delcompany]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (!confirm('删除这家公司？关联的同事将不再关联公司')) return
    try { await deleteCompany(b.dataset.delcompany); await fetchCompanies(); renderCompanies() } catch (err) { toast('删除失败：' + err.message) }
  }))
}

function showColleagueForm(colleague) {
  const editing = Boolean(colleague)
  const v = document.getElementById('view')
  const companies = App.state.companies || []
  const state = {
    name: colleague?.name || '',
    position: colleague?.position || '',
    department: colleague?.department || '',
    relation: colleague?.relation || '',
    attributeTags: colleague?.attributeTags || [],
    companyId: colleague?.companyId || '',
    notes: colleague?.notes || '',
    avatarUrl: colleague?.avatarUrl || '',
    quote: colleague?.quote || '',
    age: colleague?.age != null ? colleague.age : '',
    weight: colleague?.weight != null ? colleague.weight : '',
    personalityScore: colleague?.personalityScore != null ? colleague.personalityScore : '',
    workplaceType: colleague?.workplaceType || '',
    riskLevel: colleague?.riskLevel || ''
  }
  v.innerHTML = `
    <div class="pet-page">
      <div class="pet-topbar">
        <button class="pet-back-btn" id="cf-back" title="返回">←</button>
        <span class="pet-topbar-title">${editing ? '编辑同事' : '添加同事'}</span>
      </div>
      <div id="cf-body"></div>
    </div>`
  v.querySelector('#cf-back').addEventListener('click', () => renderColleagues())
  const body = v.querySelector('#cf-body')
  const renderForm = () => {
    body.innerHTML = `
      <div class="apple-header">
        <div class="apple-title">${editing ? '编辑同事' : '添加同事'}</div>
        <div class="apple-subtitle">${editing ? '更新 ' + esc(colleague.name) + ' 的档案' : '建立同事档案，吐槽有迹可循'}</div>
      </div>
      <div class="pet-section">
        <div class="pet-section-head"><span class="pet-section-title">基本信息</span></div>
        <div class="pet-group">
          <div class="pet-field"><label>形象（照片或黑化小能仔）</label>
            <div class="row" style="gap:10px;align-items:center">
              <div id="cf-avatar-preview" class="colleague-avatar-lg">${state.avatarUrl ? `<img src="${App.SERVER}${esc(state.avatarUrl)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : colleagueAvatarHtml(state, 'little-energy-colleague-preview')}</div>
              <div style="display:flex;flex-direction:column;gap:6px">
                <button class="btn btn-outline btn-sm" id="cf-avatar-pick">🖼 选照片</button>
                <input type="file" id="cf-avatar-file" accept="image/*" hidden>
                ${state.avatarUrl ? `<button class="btn btn-outline btn-sm" id="cf-avatar-clear">清除照片</button>` : ''}
              </div>
            </div>
          </div>
          <div class="pet-field"><label>姓名 / 昵称 *</label><input class="pet-input" id="cf-name" maxlength="20" value="${esc(state.name)}"></div>
          <div class="pet-field"><label>职位</label><input class="pet-input" id="cf-position" maxlength="30" value="${esc(state.position)}"></div>
          <div class="pet-field"><label>部门</label><input class="pet-input" id="cf-department" maxlength="30" value="${esc(state.department)}"></div>
          <div class="pet-field"><label>与我的关系</label>
            <div class="pet-chips" id="cf-relation">${COLLEAGUE_RELATIONS.map((r) => `<button type="button" class="pet-chip ${state.relation === r ? 'active' : ''}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
          </div>
          <div class="pet-field"><label>所属公司</label>
            <select class="pet-input" id="cf-company"><option value="">不关联公司</option>${companies.map((c) => `<option value="${c.id}" ${String(state.companyId) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__new__">➕ 新建公司…</option></select>
          </div>
        </div>
      </div>
      <div class="pet-section">
        <div class="pet-section-head"><span class="pet-section-title">画像信息（品行系统数据）</span></div>
        <div class="pet-group">
          <div class="pet-row">
            <div class="pet-field"><label>年龄</label><input class="pet-input" id="cf-age" type="number" min="16" max="80" value="${state.age}"></div>
            <div class="pet-field"><label>体重 (kg)</label><input class="pet-input" id="cf-weight" type="number" min="30" max="150" step="0.1" value="${state.weight}"></div>
          </div>
          <div class="pet-field"><label>性格指数（0-5 星）</label><input class="pet-input" id="cf-personality" type="number" min="0" max="5" step="0.1" value="${state.personalityScore}"></div>
          <div class="pet-field"><label>职场类型</label>
            <select class="pet-input" id="cf-worktype">
              <option value="">未设置</option>
              ${['控制型', '甩锅型', '老好人型', '卷王型', '躺平型', '大嘴巴型', '技术大佬型', '两面派', '摸鱼型'].map((t) => `<option value="${esc(t)}" ${state.workplaceType === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
            </select>
          </div>
          <div class="pet-field"><label>风险等级</label>
            <select class="pet-input" id="cf-risk">
              <option value="">未设置</option>
              ${['低', '中', '高'].map((r) => `<option value="${esc(r)}" ${state.riskLevel === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="pet-section">
        <div class="pet-section-head"><span class="pet-section-title">同事属性标签</span></div>
        <div class="pet-group">
          <div class="pet-chips" id="cf-attrs">${COLLEAGUE_ATTRS.map((a) => `<button type="button" class="pet-chip ${state.attributeTags.includes(a) ? 'active' : ''}" data-a="${esc(a)}">${esc(a)}</button>`).join('')}</div>
        </div>
      </div>
      <div class="pet-section">
        <div class="pet-section-head"><span class="pet-section-title">其他备注</span></div>
        <div class="pet-group">
          <div class="pet-field"><label>经典语录（他的口头禅 / 名场面）</label><input class="pet-input" id="cf-quote" maxlength="100" placeholder="例：这个需求很简单，明天上线…" value="${esc(state.quote)}"></div>
          <textarea class="pet-input" id="cf-notes" rows="4" maxlength="2000" style="resize:vertical">${esc(state.notes)}</textarea>
        </div>
      </div>
      ${editing ? `
      <div class="pet-section">
        <div class="pet-danger">
          <div class="pet-danger-title">危险区</div>
          <div class="pet-danger-sub">删除后将无法恢复该同事档案。</div>
          <button class="pet-danger-btn" id="cf-delete">删除同事</button>
        </div>
      </div>` : ''}
      <div class="pet-bottom-bar">
        <button class="pet-cta" id="cf-save">${editing ? '保存修改' : '保存同事'}</button>
      </div>`

    body.querySelector('#cf-name').addEventListener('input', (e) => { state.name = e.target.value })
    body.querySelector('#cf-position').addEventListener('input', (e) => { state.position = e.target.value })
    body.querySelector('#cf-department').addEventListener('input', (e) => { state.department = e.target.value })
    body.querySelector('#cf-notes').addEventListener('input', (e) => { state.notes = e.target.value })
    body.querySelector('#cf-quote').addEventListener('input', (e) => { state.quote = e.target.value })
    // 头像照片上传
    body.querySelector('#cf-avatar-pick').addEventListener('click', () => body.querySelector('#cf-avatar-file').click())
    body.querySelector('#cf-avatar-file').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0]
      if (!file) return
      try {
        const blob = await compressImage(file, 512)
        const url = await uploadMedia(await blob.arrayBuffer(), 'colleague-avatar.jpg', 'image/jpeg')
        state.avatarUrl = url
        const pv = body.querySelector('#cf-avatar-preview')
        pv.innerHTML = `<img src="${App.SERVER}${esc(url)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
        const clear = body.querySelector('#cf-avatar-clear')
        if (clear) clear.style.display = 'inline-block'
        toast('✅ 照片已上传，保存后生效')
      } catch (err) { toast('头像上传失败：' + err.message) }
    })
    const clearBtn = body.querySelector('#cf-avatar-clear')
    if (clearBtn) clearBtn.addEventListener('click', () => {
      state.avatarUrl = ''
      body.querySelector('#cf-avatar-preview').innerHTML = colleagueAvatarHtml(state, 'little-energy-colleague-preview')
      clearBtn.style.display = 'none'
    })
    body.querySelector('#cf-age').addEventListener('input', (e) => { state.age = e.target.value })
    body.querySelector('#cf-weight').addEventListener('input', (e) => { state.weight = e.target.value })
    body.querySelector('#cf-personality').addEventListener('input', (e) => { state.personalityScore = e.target.value })
    body.querySelector('#cf-worktype').addEventListener('change', (e) => { state.workplaceType = e.target.value })
    body.querySelector('#cf-risk').addEventListener('change', (e) => { state.riskLevel = e.target.value })
    body.querySelectorAll('#cf-relation .pet-chip').forEach((c) => c.addEventListener('click', () => {
      state.relation = c.dataset.r
      body.querySelectorAll('#cf-relation .pet-chip').forEach((x) => x.classList.toggle('active', x === c))
    }))
    body.querySelectorAll('#cf-attrs .pet-chip').forEach((c) => c.addEventListener('click', () => {
      c.classList.toggle('active')
      const a = c.dataset.a
      state.attributeTags = c.classList.contains('active') ? [...state.attributeTags, a] : state.attributeTags.filter((x) => x !== a)
    }))
    body.querySelector('#cf-company').addEventListener('change', async (e) => {
      if (e.target.value === '__new__') {
        showCompanyForm(null, (created) => { state.companyId = created.id; renderForm() })
      } else {
        state.companyId = e.target.value
      }
    })
    body.querySelector('#cf-save').addEventListener('click', async () => {
      if (!state.name.trim()) return toast('请填写姓名 / 昵称')
      const payload = {
        name: state.name.trim(),
        position: state.position.trim(),
        department: state.department.trim(),
        relation: state.relation,
        attributeTags: state.attributeTags,
        companyId: state.companyId || null,
        notes: state.notes.trim(),
        age: state.age === '' ? null : Number(state.age),
        weight: state.weight === '' ? null : Number(state.weight),
        personalityScore: state.personalityScore === '' ? null : Number(state.personalityScore),
        workplaceType: state.workplaceType || null,
        riskLevel: state.riskLevel || null,
        avatarUrl: state.avatarUrl || null,
        quote: state.quote.trim()
      }
      try {
        if (editing) await updateColleague(colleague.id, payload)
        else await addColleague(payload)
        toast(editing ? '✅ 同事档案已更新' : '✅ 同事档案已创建')
        renderColleagues()
      } catch (err) { toast('保存失败：' + err.message) }
    })
    if (editing) {
      body.querySelector('#cf-delete').addEventListener('click', async () => {
        if (!confirm(`删除同事「${colleague.name}」？删除后无法恢复`)) return
        try { await deleteColleague(colleague.id); toast('已删除'); renderColleagues() } catch (err) { toast('删除失败：' + err.message) }
      })
    }
  }
  renderForm()
}

function showCompanyForm(company, onSaved) {
  const editing = Boolean(company)
  const state = {
    name: company?.name || '',
    industry: company?.industry || '',
    scale: company?.scale || '',
    overtimeCulture: company?.overtimeCulture || '',
    welfare: company?.welfare || '',
    location: company?.location || ''
  }
  openModal(`
    <div class="modal-title">${editing ? '编辑公司' : '新建公司'}</div>
    <div class="form-field"><label>公司名 *</label><input id="cp-name" maxlength="40" value="${esc(state.name)}"></div>
    <div class="form-row">
      <div class="form-field"><label>行业</label><input id="cp-industry" value="${esc(state.industry)}"></div>
      <div class="form-field"><label>规模</label><input id="cp-scale" placeholder="如：200人 / 中厂" value="${esc(state.scale)}"></div>
    </div>
    <div class="form-row">
      <div class="form-field"><label>加班文化</label><input id="cp-ot" placeholder="如：996 / 弹性" value="${esc(state.overtimeCulture)}"></div>
      <div class="form-field"><label>福利评级</label><input id="cp-welfare" placeholder="如：一般 / 不错" value="${esc(state.welfare)}"></div>
    </div>
    <div class="form-field"><label>地点</label><input id="cp-location" value="${esc(state.location)}"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-close>取消</button>
      <button class="btn btn-primary" id="cp-submit">${editing ? '保存' : '创建'}</button>
    </div>
  `, (box) => {
    box.querySelector('#cp-submit').addEventListener('click', async () => {
      const name = box.querySelector('#cp-name').value.trim()
      if (!name) return toast('请填写公司名')
      const payload = {
        name,
        industry: box.querySelector('#cp-industry').value.trim(),
        scale: box.querySelector('#cp-scale').value.trim(),
        overtimeCulture: box.querySelector('#cp-ot').value.trim(),
        welfare: box.querySelector('#cp-welfare').value.trim(),
        location: box.querySelector('#cp-location').value.trim()
      }
      try {
        let created = null
        if (editing) { await updateCompany(company.id, payload); created = { id: company.id } }
        else created = await addCompany(payload)
        closeModal()
        toast(editing ? '✅ 公司已更新' : '✅ 公司已创建')
        if (onSaved) onSaved(created)
        else { await fetchCompanies(); renderCompanies() }
      } catch (err) { toast('保存失败：' + err.message) }
    })
  })
}

/* ---------- 我的（我的档案 + 设置） ---------- */
function renderMine() {
  const u = App.state.user
  const v = document.getElementById('view')
  v.innerHTML = `
    <div class="two-col">
      <div>
        <div class="card">
          <div class="profile-head">
            ${littleEnergyAvatarHtml({ moodId: currentMoodId(), outfit: currentOutfit(), className: 'little-energy-profile' })}
            <div class="profile-info">
              <div class="row" style="gap:8px">
                <span class="profile-name">${esc(u.userName)}</span>${uiAssetImg('badgeLevel', 'profile-level-asset', '')}
              </div>
              <div class="profile-bio">@${esc(u.username || u.userName)}</div>
            </div>
          </div>
          <div class="row" style="margin-top:14px;gap:10px">
            <button class="btn btn-primary" id="edit-profile">✏️ 编辑资料</button>
          </div>
        </div>

        <div class="card profile-asset-grid">
          <button class="profile-asset-item" id="profile-my-complaints">${uiAssetImg('profileComplaints', 'profile-asset-icon', '')}<span>我的吐槽</span></button>
          <button class="profile-asset-item">${uiAssetImg('profileFavorites', 'profile-asset-icon', '')}<span>我的收藏</span></button>
          <button class="profile-asset-item">${uiAssetImg('profilePosts', 'profile-asset-icon', '')}<span>我的动态</span></button>
          <button class="profile-asset-item" id="profile-mood-history">${uiAssetImg('profileHistory', 'profile-asset-icon', '')}<span>浏览记录</span></button>
        </div>

        <div class="card">
          <div class="row">
            <div style="flex:1">
              <div class="card-title" style="margin-bottom:2px">聊天记录同步</div>
              <div class="card-sub">不同设备登录同一账号可同步历史聊天记录</div>
            </div>
            <input type="checkbox" id="sync-toggle" ${App.state.syncHistory ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary)">
          </div>
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card-title">账户与设置</div>
          <div class="tool-row" id="tool-report">${uiAssetImg('toolReport', 'tool-icon asset-tool-icon', '')}情绪报告${uiAssetImg('actionChevron', 'tool-chevron', '')}</div>
          <div class="tool-row" id="tool-ai">${uiAssetImg('toolAI', 'tool-icon asset-tool-icon', '')}AI 洞察${uiAssetImg('actionChevron', 'tool-chevron', '')}</div>
          <div class="tool-row" id="tool-stress">${uiAssetImg('toolStress', 'tool-icon asset-tool-icon', '')}压力分析与打卡${uiAssetImg('actionChevron', 'tool-chevron', '')}</div>
          <div class="tool-row" id="tool-relationship">${uiAssetImg('toolRelationship', 'tool-icon asset-tool-icon', '')}关系雷达${uiAssetImg('actionChevron', 'tool-chevron', '')}</div>
          <div class="tool-row" id="tool-rules">${uiAssetImg('toolReport', 'tool-icon asset-tool-icon', '')}社区规范${uiAssetImg('actionChevron', 'tool-chevron', '')}</div>
          <div class="tool-row" id="tool-mystatus">${uiAssetImg('profileHistory', 'tool-icon asset-tool-icon', '')}我的状态历史${uiAssetImg('actionChevron', 'tool-chevron', '')}</div>
          <div class="tool-row" id="tool-about">${uiAssetImg('brandTuS', 'tool-icon asset-tool-icon', '')}关于职场那些事${uiAssetImg('actionChevron', 'tool-chevron', '')}</div>
          <div class="tool-row tool-logout" id="tool-logout">${uiAssetImg('navProfile', 'tool-icon asset-tool-icon', '')}退出登录${uiAssetImg('actionChevron', 'tool-chevron', '')}</div>
        </div>
      </div>
    </div>`

  v.querySelector('#edit-profile').addEventListener('click', showProfileEditor)
  v.querySelector('#profile-my-complaints').addEventListener('click', () => switchView('complaint', { mode: 'mine' }))
  v.querySelector('.profile-asset-item:nth-child(2)').addEventListener('click', () => switchView('complaint', { mode: 'favorites' }))
  v.querySelector('#profile-mood-history').addEventListener('click', showMyStatuses)
  v.querySelector('#tool-mystatus').addEventListener('click', showMyStatuses)
  v.querySelector('#tool-report').addEventListener('click', () => switchView('ai'))
  v.querySelector('#tool-ai').addEventListener('click', () => switchView('ai'))
  v.querySelector('#tool-stress').addEventListener('click', renderMoodCheckin)
  v.querySelector('#tool-relationship').addEventListener('click', () => switchView('colleague'))
  v.querySelector('#tool-rules').addEventListener('click', () => showStaticText('社区规范', rulesText()))
  v.querySelector('#tool-about').addEventListener('click', () => showStaticText('关于职场那些事', aboutText()))
  v.querySelector('#tool-logout').addEventListener('click', () => {
    if (confirm('退出当前账号？退出后可在登录页一键切换其他账号')) { logout(); switchView('login') }
  })
  v.querySelector('#sync-toggle').addEventListener('change', (e) => {
    App.state.syncHistory = e.target.checked
    localStorage.setItem('jiyu.syncHistory', App.state.syncHistory ? '1' : '0')
    toast(App.state.syncHistory ? '已开启聊天记录同步' : '已关闭聊天记录同步（仅显示新消息）')
  })
}

/* 编辑资料（账号信息，不含技能/互换） */
function showProfileEditor() {
  pushContentPage({ page: 'profile-edit' })
}

function renderProfileEditorPage() {
  const u = App.state.user
  const draft = normalizeOutfit(u.littleEnergyOutfit)
  const angles = ['front', 'left', 'back', 'right']
  let angleIndex = 0
  setContentPage({ page: 'profile-edit' })
  const v = document.getElementById('view')
  v.innerHTML = `
    <div class="row" style="margin-bottom:16px"><button class="btn btn-outline btn-sm" data-page-back>${uiAssetImg('actionBack', 'inline-action-asset', '')}返回</button><span class="section-title" style="margin:0 0 0 10px">编辑资料</span></div>
    <section class="card profile-editor-page">
    <div class="form-row">
      <div class="form-field"><label>昵称</label><input id="pe-nickname" value="${esc(u.userName)}"></div>
      <div class="form-field"><label>所在城市</label><input id="pe-location" value="${esc(u.locationLabel || '')}" placeholder="如：广州·天河"></div>
    </div>
    <div class="form-field"><label>简介</label><textarea id="pe-bio" rows="2" placeholder="介绍一下自己吧">${esc(u.bio || '')}</textarea></div>
    <div class="outfit-editor">
      <div class="card-title">小能仔换装</div>
      <div id="pe-outfit-preview" class="little-energy-turntable" aria-label="小能仔 3D 造型预览"></div>
      <div class="turntable-hint">左右拖动查看小能仔 3D 造型</div>
      <div class="outfit-group"><label>整套造型</label><div class="outfit-grid look-grid">${LOOKS.map((look) => `<button type="button" class="outfit-item look-item" data-look-id="${look.id}"><img src="../assets/little-energy/looks/${look.id}-front.png" alt=""><span>${esc(look.label)}</span></button>`).join('')}</div></div>
    </div>
    <div class="modal-actions"><button class="btn btn-outline" data-page-back>取消</button><button class="btn btn-primary" id="pe-save">💾 保存资料与造型</button></div>
    </section>`
  const box = v
  box.querySelectorAll('[data-page-back]').forEach((button) => button.addEventListener('click', popContentPage))
    const preview = box.querySelector('#pe-outfit-preview')
    const redrawOutfit = () => {
      const look = resolveLook(draft)
      preview.innerHTML = `<img src="../assets/little-energy/looks/${look.id}-${angles[angleIndex]}.png" alt="${esc(look.label)}小能仔">`
      box.querySelectorAll('.look-item').forEach((item) => item.classList.toggle('active', item.dataset.lookId === look.id))
    }
    box.querySelectorAll('.look-item').forEach((item) => item.addEventListener('click', () => {
      const look = LOOKS.find((value) => value.id === item.dataset.lookId)
      if (!look) return
      Object.assign(draft, normalizeOutfit(look.outfit))
      angleIndex = 0
      redrawOutfit()
    }))
    redrawOutfit()
    for (const look of LOOKS) for (const angle of angles) {
      const image = new Image()
      image.src = `../assets/little-energy/looks/${look.id}-${angle}.png`
    }
    let dragStart = null
    let dragStep = 0
    preview.addEventListener('pointerdown', (event) => {
      dragStart = event.clientX
      dragStep = 0
      preview.setPointerCapture?.(event.pointerId)
    })
    preview.addEventListener('pointermove', (event) => {
      if (dragStart == null) return
      const nextStep = Math.trunc((event.clientX - dragStart) / 42)
      if (!nextStep || nextStep === dragStep) return
      const distance = nextStep - dragStep
      angleIndex = (angleIndex + (distance < 0 ? 1 : angles.length - 1) + angles.length) % angles.length
      dragStep = nextStep
      redrawOutfit()
    })
    preview.addEventListener('pointerup', () => { dragStart = null; dragStep = 0 })
    preview.addEventListener('pointercancel', () => { dragStart = null; dragStep = 0 })
    box.querySelector('#pe-save').addEventListener('click', async () => {
      const nickname = box.querySelector('#pe-nickname').value.trim()
      if (!nickname) return toast('昵称不能为空')
      try {
        await updateProfile({ nickname, bio: box.querySelector('#pe-bio').value.trim(), locationLabel: box.querySelector('#pe-location').value.trim(), littleEnergyOutfit: normalizeOutfit(draft) })
        toast('✅ 资料与造型已保存'); contentHistory().reset(); switchView('mine')
      } catch (e) { toast(e.message) }
    })
}

/* 我的状态历史（原我的动态） */
function showMyStatuses() {
  const mine = (App.state.statuses || []).filter((d) => String(d.userId) === String(App.state.user.id))
  openModal(`
    <div class="modal-title">我的状态（${mine.length}）</div>
    ${mine.length
      ? mine.map((d) => `
        <div class="card" style="margin-bottom:8px">
          <div class="row">
            <span class="feed-time" style="margin-left:0">${fmtTime(d.time)}</span>
            <span class="spacer"></span>
            <button class="btn btn-danger btn-sm" data-del="${d.id}" title="删除">删除</button>
          </div>
          <div class="feed-content" style="margin-top:6px">${esc(d.content)}</div>
          ${d.colleagueName ? `<div class="row" style="margin-top:6px"><span class="tag tag-vip">👤 ${esc(d.colleagueName)}</span></div>` : ''}
          ${d.themeTags && d.themeTags.length ? `<div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px">${d.themeTags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>`).join('')
      : '<div class="empty"><div class="empty-icon">🗒️</div>你还没有记录过状态<br>去「我的同事状态」记一笔吧</div>'}
  `, (box) => {
    box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('删除这条状态？')) return
      try {
        await deleteStatus(b.dataset.del)
        App.state.statuses = App.state.statuses.filter((d) => String(d.id) !== b.dataset.del)
        toast('已删除'); closeModal(); showMyStatuses()
      } catch (e) { toast('删除失败：' + e.message) }
    }))
  })
}

/* 静态文本 */
function showStaticText(title, text) {
  openModal(`<div class="modal-title">${title}</div><div class="card-sub" style="line-height:1.9;white-space:pre-wrap">${esc(text)}</div>
    <div class="modal-actions"><button class="btn btn-primary" data-close>关闭</button></div>`)
}
function rulesText() {
  return '职场那些事社区规范\n1. 仅记录与同事/职场相关的观察，禁止人身攻击、歧视与辱骂。\n2. 请勿泄露他人真实姓名、隐私与敏感信息。\n3. 文本/图片内容自动风控过滤，违规内容将被拦截。\n4. 违规处罚：首次警告 → 二次限流 → 三次封禁。\n5. 本平台为私人记录工具，内容仅你本人可见。'
}
function aboutText() {
  return '职场那些事 —— 一个帮你记录同事与公司、按主题与软件归档职场观察的小工具。\n维度：同事属性 / 公司属性 / 主题 / 软件。\n纯本地记录，不泄露、不交易。'
}

/* ================= 消息视图（保持聊天功能，移除订单引用） ================= */
async function renderMessage() {
  const v = document.getElementById('view')
  v.innerHTML = `
    <div class="message-category-strip">
      <div class="message-category-item">${uiAssetImg('messageInteraction', 'message-category-asset', '')}<span>互动消息</span></div>
      <div class="message-category-item">${uiAssetImg('messageSystem', 'message-category-asset', '')}<span>系统通知</span></div>
      <div class="message-category-item">${uiAssetImg('messageAI', 'message-category-asset', '')}<span>AI 助手</span></div>
      <button class="message-category-item" id="message-version-notice">${uiAssetImg('messageUpdate', 'message-category-asset', '')}<span>版本通知</span></button>
    </div>
    <div class="msg-tools">
      <div class="search-box">
        <input id="user-search" placeholder="🔍 搜索好友（昵称 / 用户名）" autocomplete="off">
        <div id="user-search-res" class="search-res hidden"></div>
      </div>
      <button class="btn btn-outline btn-sm" id="mini-apps-btn" title="小程序市场">🛒 小程序</button>
    </div>
    <div class="chat-layout">
      <div class="chat-list-panel" id="convo-list"></div>
      <div class="chat-main message-reference-main" id="chat-main">
        <div class="chat-head" id="chat-head"><span class="card-sub">选择左侧会话开始聊天</span></div>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-input" id="chat-input"></div>
      </div>
    </div>`
  bindUserSearch()
  v.querySelector('#mini-apps-btn').addEventListener('click', showMiniApps)
  v.querySelector('#message-version-notice').addEventListener('click', () => pushContentPage({ page: 'version-notice' }))
  await renderConvoList()
}

function renderVersionNoticePage() {
  setContentPage({ page: 'version-notice' })
  const notice = App.state.versionNotice || JSON.parse(localStorage.getItem('jiyu.versionNotice') || 'null')
  const v = document.getElementById('view')
  v.innerHTML = `
    <div class="row" style="margin-bottom:16px"><button class="btn btn-outline btn-sm" data-page-back>${uiAssetImg('actionBack', 'inline-action-asset', '')}返回</button><span class="section-title" style="margin:0 0 0 10px">版本通知</span></div>
    <section class="card version-notice-page">
      ${uiAssetImg('messageUpdate', 'version-notice-icon', '')}
      <div><div class="card-title">${notice ? `发现新版本 ${esc(notice.current)}` : '当前已是最新版本'}</div>
      <div class="card-sub">${notice ? esc(notice.updateMessage || '') : '后续更新会在这里通知，你可自行选择下载。'}</div></div>
      ${notice?.downloadUrl ? '<button class="btn btn-primary" id="version-download">查看下载</button>' : ''}
    </section>`
  v.querySelector('[data-page-back]').addEventListener('click', popContentPage)
  v.querySelector('#version-download')?.addEventListener('click', () => window.open(notice.downloadUrl, '_blank'))
}

function bindUserSearch() {
  const input = document.getElementById('user-search')
  const res = document.getElementById('user-search-res')
  if (!input) return
  let timer = null
  input.addEventListener('input', () => {
    clearTimeout(timer)
    const kw = input.value.trim()
    if (!kw) { res.classList.add('hidden'); return }
    timer = setTimeout(async () => {
      try {
        const data = await api('/api/users?keyword=' + encodeURIComponent(kw))
        const users = (data.users || []).filter((u) => String(u.id) !== String(App.state.user.id)).slice(0, 8)
        if (!users.length) {
          res.innerHTML = '<div class="search-item card-sub" style="padding:10px">没有找到相关用户</div>'
        } else {
          res.innerHTML = users.map((u) => `
            <div class="search-item" data-uid="${u.id}">
              ${avatarHtml(u, 'avatar avatar-sm')}
              <div style="flex:1;min-width:0">
                <div class="convo-name">${esc(u.userName)}</div>
                <div class="card-sub">${esc(u.bio || u.locationLabel || '暂无简介')}</div>
              </div>
              <button class="btn btn-primary btn-sm" data-chat="${u.id}">💬 私信</button>
            </div>`).join('')
          const openChat = async (uid) => {
            res.classList.add('hidden'); input.value = ''
            try {
              const open = await api('/api/conversations/open', { method: 'POST', body: { partnerId: uid } })
              await refreshAll()
              const conv = App.state.conversations.find((c) => c.id === open.conversation.id)
              if (conv) showChat(conv)
            } catch (e) { toast('打开会话失败：' + e.message) }
          }
          res.querySelectorAll('[data-chat]').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); openChat(el.dataset.chat) }))
          res.querySelectorAll('.search-item[data-uid]').forEach((el) => el.addEventListener('click', () => openChat(el.dataset.uid)))
        }
        res.classList.remove('hidden')
      } catch (e) { /* 静默 */ }
    }, 300)
  })
  document.addEventListener('click', (e) => { if (!e.target.closest('.search-box')) res.classList.add('hidden') })
}

async function renderConvoList() {
  const list = document.getElementById('convo-list')
  if (!list) return
  try { await refreshAll() } catch (e) { /* 保留现有 */ }
  const unreadTotal = App.state.conversations.reduce((s, c) => s + (c.unreadCount || 0), 0)
  const badge = document.getElementById('msg-badge')
  if (unreadTotal > 0) { badge.textContent = unreadTotal; badge.classList.remove('hidden') } else badge.classList.add('hidden')
  const bellDot = document.getElementById('bell-dot')
  if (bellDot) bellDot.classList.toggle('hidden', unreadTotal === 0)
  if (!App.state.conversations.length) {
    list.innerHTML = '<div class="empty">暂无会话<br>发条消息开始聊天吧</div>'
    return
  }
  list.innerHTML = App.state.conversations.map((c) => `
    <div class="card convo-item" data-cid="${c.id}">
      <div class="row">
        ${avatarHtml(c.partner)}
        <div style="flex:1;min-width:0">
          <div class="row">
            <span class="convo-name">${esc(c.partner.userName)}</span>
            <span class="spacer"></span>
            <span class="convo-time">${fmtTime(c.lastTime)}</span>
          </div>
          <div class="convo-last">${esc(c.lastMessageText)}</div>
        </div>
        ${c.unreadCount > 0 ? `<span class="unread-dot">${c.unreadCount}</span>` : ''}
      </div>
    </div>`).join('')
  list.querySelectorAll('.convo-item').forEach((el) => el.addEventListener('click', () => {
    const conv = App.state.conversations.find((c) => c.id === el.dataset.cid)
    if (conv) showChat(conv)
  }))
}

async function showChat(conv) {
  App.state.activeConversation = conv.id
  conv.unreadCount = 0
  markRead(conv.id)
  renderConvoList()
  const head = document.getElementById('chat-head')
  const msgs = document.getElementById('chat-messages')
  const input = document.getElementById('chat-input')
  head.innerHTML = `<div class="message-reference-header">
    <button class="message-reference-back" id="chat-reference-back" title="返回会话">${uiAssetImg('actionBack', 'inline-action-asset', '')}</button>
    <div class="message-reference-person">${avatarHtml(conv.partner, 'little-energy-mini')}<div><strong>${esc(conv.partner.userName)}</strong><span><i></i>在线 · 同事互助中</span></div></div>
    <button class="message-reference-more" title="更多">${uiAssetImg('actionMore', 'inline-action-asset', '')}</button>
  </div>`
  head.querySelector('#chat-reference-back').addEventListener('click', () => {
    App.state.activeConversation = null
    head.innerHTML = '<span class="card-sub">选择左侧会话开始聊天</span>'
    msgs.innerHTML = ''
    input.innerHTML = ''
  })
  msgs.innerHTML = '<div class="empty">加载中…</div>'
  input.innerHTML = buildChatInput(conv)
  bindChatInput(conv)
  if (App.state.syncHistory) {
    try {
      const list = (await loadMessages(conv.id)).messages
      App.state.messages[conv.id] = list.map((m) => normalizeMessage(m, m.senderIsMe))
    } catch (e) { /* ignore */ }
  } else {
    App.state.messages[conv.id] = App.state.messages[conv.id] || []
  }
  renderMessages(conv)
}

function renderMessages(conv) {
  const msgs = document.getElementById('chat-messages')
  const list = App.state.messages[conv.id] || []
  if (!list.length) {
    msgs.innerHTML = '<div class="empty">暂无消息，发条消息聊聊吧～</div>'
    return
  }
  msgs.innerHTML =
    (App.state.hasMore[conv.id] ? '<button class="load-earlier" id="load-earlier">↑ 加载更早消息</button>' : '') +
    list.map((m) => messageHtml(m, conv)).join('')
  const btn = msgs.querySelector('#load-earlier')
  if (btn) btn.addEventListener('click', async () => {
    const list2 = (await loadMessages(conv.id, list[0].id)).messages
    const earlier = list2.map((m) => normalizeMessage(m, m.senderIsMe))
    App.state.messages[conv.id] = earlier.concat(list)
    renderMessages(conv)
  })
  msgs.scrollTop = msgs.scrollHeight
}

function messageHtml(m, conv) {
  if (m.isSystemNote) return `<div class="msg-note">${esc(m.text)}</div>`
  let media = ''
  if (m.mediaType === 'little_energy_emoji' && m.mediaUrl) media = `<div class="little-energy-message">${littleEnergyAvatarHtml({ moodId: m.mediaUrl, outfit: messageOutfit(m, conv && conv.partner && conv.partner.littleEnergyOutfit, currentOutfit()), className: 'little-energy-emoji' })}</div>`
  else if (m.mediaType === 'image' && m.mediaUrl) media = `<img class="msg-image" src="${mediaUrl(m.mediaUrl)}" data-fullscreen alt="">`
  else if (m.mediaType === 'video' && m.mediaUrl) media = `<div class="msg-media-card" data-video="${mediaUrl(m.mediaUrl)}">▶ 播放视频</div>`
  else if (m.mediaType === 'audio' && m.mediaUrl) media = `<div class="msg-media-card" data-audio="${mediaUrl(m.mediaUrl)}">🔊 语音消息</div>`
  else if (m.mediaType === 'location' && m.mediaUrl) {
    const [lat, lng] = String(m.mediaUrl).split(',').map((s) => s.trim())
    media = `<div class="msg-location-card" data-lat="${esc(lat)}" data-lng="${esc(lng)}">
      <div class="location-icon">📍</div>
      <div style="flex:1;min-width:0">
        <div class="location-name">${esc(m.text || '我的位置')}</div>
        <div class="location-meta">${esc(lat)}, ${esc(lng)} · 点击查看地图</div>
      </div>
      <span class="location-arrow">↗</span>
    </div>`
  }
  const bubble = media + (m.text && m.mediaType !== 'little_energy_emoji' ? `<div>${esc(m.text)}</div>` : '')
  const avatar = m.senderIsMe
    ? avatarHtml(App.state.user, 'little-energy-mini')
    : avatarHtml(conv && conv.partner, 'little-energy-mini')
  return `<div class="msg ${m.senderIsMe ? 'me' : 'them'}">${m.senderIsMe ? '' : avatar}<div class="msg-bubble">${bubble}</div>${m.senderIsMe ? avatar : ''}</div>`
}

function playAudio(url) { openFullscreen(`<audio src="${url}" controls autoplay style="width:60vw"></audio>`) }

function buildChatInput(conv) {
  return `
    <div class="chat-composer-shell">
    <div class="chat-tools" id="ci-tools">
      <button class="icon-btn" id="ci-location" title="发送我的位置">📍</button>
      <button class="icon-btn" id="ci-image" title="发送图片">🖼</button>
      <button class="icon-btn" id="ci-video" title="发送视频">🎬</button>
      <button class="icon-btn" id="ci-camera" title="拍照发送">📷</button>
      <button class="icon-btn" id="ci-voice" title="语音消息">🎤</button>
      <input type="file" id="ci-image-file" accept="image/*" hidden>
      <input type="file" id="ci-video-file" accept="video/*" hidden>
      <span id="ci-recording" class="recording-indicator hidden"><span class="recording-dot"></span>录音中…</span>
    </div>
    <button class="chat-composer-emoji icon-btn" id="ci-little-energy" title="小能仔 Emoji">${uiAssetImg('messageAI', 'inline-action-asset', '')}</button>
    <textarea id="ci-text" placeholder="说点什么…" rows="1"></textarea>
    <button class="chat-composer-more icon-btn" id="ci-more" title="更多发送方式">${uiAssetImg('actionAdd', 'inline-action-asset', '')}</button>
    <button class="chat-composer-send" id="ci-send" disabled>${uiAssetImg('actionSend', 'inline-action-asset light-asset', '')}</button>
    </div>
    <div id="ci-emoji-panel" class="little-energy-emoji-panel hidden">${MOODS.map((m) => moodChoiceHtml(m, 'emoji-choice')).join('')}</div>`
}

function bindChatInput(conv) {
  const text = document.getElementById('ci-text')
  const sendBtn = document.getElementById('ci-send')
  const recording = document.getElementById('ci-recording')
  const fileImage = document.getElementById('ci-image-file')
  const fileVideo = document.getElementById('ci-video-file')
  const tools = document.getElementById('ci-tools')
  text.addEventListener('input', () => { sendBtn.disabled = !text.value.trim() })
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } })
  sendBtn.addEventListener('click', send)
  document.getElementById('ci-more').addEventListener('click', () => tools.classList.toggle('expanded'))
  document.getElementById('ci-location').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('当前环境不支持定位')
    toast('正在获取位置…')
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude.toFixed(6)
      const lng = pos.coords.longitude.toFixed(6)
      try {
        const r = await sendMessageRest(conv.id, '我的位置', 'location', `${lat},${lng}`)
        if (r.blocked) return toast('发送失败')
        const list = (await loadMessages(conv.id)).messages
        App.state.messages[conv.id] = list.map((m) => normalizeMessage(m, m.senderIsMe))
        renderMessages(conv)
      } catch (e) { toast('位置发送失败：' + e.message) }
    }, () => toast('定位失败，请检查系统定位权限'), { timeout: 10000, maximumAge: 60000 })
  })
  document.getElementById('ci-image').addEventListener('click', () => fileImage.click())
  document.getElementById('ci-video').addEventListener('click', () => fileVideo.click())
  fileImage.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      sendBtn.textContent = '上传中…'
      const blob = await compressImage(file)
      const url = await uploadMedia(await blob.arrayBuffer(), 'image.jpg', 'image/jpeg')
      sendBtn.textContent = '发送'
      await sendMedia(conv, 'image', url)
    } catch (err) { sendBtn.textContent = '发送'; toast('图片发送失败：' + err.message) }
    e.target.value = ''
  })
  fileVideo.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) return toast('视频超过 50MB 限制')
    try {
      sendBtn.textContent = '上传中…'
      const url = await uploadMedia(await file.arrayBuffer(), 'video.mp4', 'video/mp4')
      sendBtn.textContent = '发送'
      await sendMedia(conv, 'video', url)
    } catch (err) { sendBtn.textContent = '发送'; toast('视频发送失败：' + err.message) }
    e.target.value = ''
  })
  document.getElementById('ci-camera').addEventListener('click', () => startCamera(conv))
  document.getElementById('ci-voice').addEventListener('click', () => toggleVoice(conv, recording))
  const emojiPanel = document.getElementById('ci-emoji-panel')
  document.querySelectorAll('#ci-little-energy').forEach((button) => button.addEventListener('click', () => emojiPanel.classList.toggle('hidden')))
  emojiPanel.querySelectorAll('.emoji-choice').forEach((button) => button.addEventListener('click', async () => {
    const payload = littleEnergyEmojiPayload(button.dataset.mood)
    if (!payload) return
    try {
      const r = await sendMessageRest(conv.id, payload.text, payload.mediaType, payload.mediaUrl)
      if (r.blocked) return showBlocked(r.warning)
      emojiPanel.classList.add('hidden')
      const list = (await loadMessages(conv.id)).messages
      App.state.messages[conv.id] = list.map((m) => normalizeMessage(m, m.senderIsMe))
      renderMessages(conv)
    } catch (err) { toast('发送失败：' + err.message) }
  }))

  async function send() {
    const content = text.value.trim()
    if (!content) return
    text.value = ''
    sendBtn.disabled = true
    const ack = await socketSend(conv.id, content, null)
    if (ack.blocked) {
      showBlocked(ack.warning)
      const list = (await loadMessages(conv.id)).messages
      App.state.messages[conv.id] = list.map((m) => normalizeMessage(m, m.senderIsMe))
      renderMessages(conv)
    } else if (!ack.ok) {
      try {
        const r = await sendMessageRest(conv.id, content, null, null, null)
        if (r.blocked) showBlocked(r.warning)
        const list = (await loadMessages(conv.id)).messages
        App.state.messages[conv.id] = list.map((m) => normalizeMessage(m, m.senderIsMe))
        renderMessages(conv)
      } catch (err) { toast('发送失败：' + err.message) }
    } else {
      const list = (await loadMessages(conv.id)).messages
      App.state.messages[conv.id] = list.map((m) => normalizeMessage(m, m.senderIsMe))
      renderMessages(conv)
    }
  }
  async function sendMedia(conv2, mediaType, url) {
    try {
      const r = await sendMessageRest(conv2.id, '', mediaType, url)
      if (r.blocked) { showBlocked(r.warning); return }
      const list = (await loadMessages(conv2.id)).messages
      App.state.messages[conv2.id] = list.map((m) => normalizeMessage(m, m.senderIsMe))
      renderMessages(conv2)
    } catch (err) { toast('发送失败：' + err.message) }
  }
  function showBlocked(warning) {
    const msgs = document.getElementById('chat-messages')
    const banner = document.createElement('div')
    banner.className = 'blocked-banner'
    banner.textContent = '⛔ ' + (warning || '内容违规，已被拦截')
    msgs.parentElement.insertBefore(banner, msgs)
    setTimeout(() => banner.remove(), 4000)
  }
}

async function startChatWithUser(u) {
  try {
    const conv = await openConversation(u.id)
    await renderMessage()
    showChat(conv)
    switchTab('message')
  } catch (e) { toast('无法创建会话：' + e.message) }
}

let recorder = null
let recorderChunks = []
async function toggleVoice(conv, indicator) {
  if (recorder && recorder.state === 'recording') { recorder.stop(); indicator.classList.add('hidden'); return }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recorder = new MediaRecorder(stream)
    recorderChunks = []
    recorder.ondataavailable = (e) => recorderChunks.push(e.data)
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(recorderChunks, { type: 'audio/webm' })
      recorder = null
      if (blob.size < 1000) return toast('录音太短')
      try {
        const url = await uploadMedia(await blob.arrayBuffer(), 'voice.webm', 'audio/webm')
        const r = await sendMessageRest(conv.id, '', 'audio', url)
        if (r.blocked) toast('内容违规')
        const list = (await loadMessages(conv.id)).messages
        App.state.messages[conv.id] = list.map((m) => normalizeMessage(m, m.senderIsMe))
        renderMessages(conv)
      } catch (err) { toast('语音发送失败：' + err.message) }
    }
    recorder.start()
    indicator.classList.remove('hidden')
  } catch (e) { toast('无法使用麦克风：' + e.message) }
}

async function startCamera(conv) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    const mask = document.createElement('div')
    mask.className = 'camera-preview'
    mask.innerHTML = `
      <video autoplay playsinline></video>
      <div class="camera-actions">
        <button class="btn btn-outline" id="cam-close">取消</button>
        <button class="btn btn-primary" id="cam-capture">📸 拍照</button>
      </div>`
    document.body.appendChild(mask)
    const video = mask.querySelector('video')
    video.srcObject = stream
    mask.querySelector('#cam-close').addEventListener('click', () => { stream.getTracks().forEach((t) => t.stop()); mask.remove() })
    mask.querySelector('#cam-capture').addEventListener('click', () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth; canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
      stream.getTracks().forEach((t) => t.stop())
      mask.innerHTML = `
        <img src="${canvas.toDataURL('image/jpeg', 0.9)}">
        <div class="camera-actions">
          <button class="btn btn-outline" id="cam-retake">重拍</button>
          <button class="btn btn-primary" id="cam-send">发送</button>
          <button class="btn btn-danger" id="cam-cancel">取消</button>
        </div>`
      mask.querySelector('#cam-retake').addEventListener('click', () => { mask.remove(); startCamera(conv) })
      mask.querySelector('#cam-cancel').addEventListener('click', () => mask.remove())
      mask.querySelector('#cam-send').addEventListener('click', async () => {
        mask.remove()
        try {
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7))
          const url = await uploadMedia(await blob.arrayBuffer(), 'photo.jpg', 'image/jpeg')
          const r = await sendMessageRest(conv.id, '', 'image', url)
          if (r.blocked) toast('内容违规')
          const list = (await loadMessages(conv.id)).messages
          App.state.messages[conv.id] = list.map((m) => normalizeMessage(m, m.senderIsMe))
          renderMessages(conv)
        } catch (err) { toast('照片发送失败：' + err.message) }
      })
    })
  } catch (e) { toast('无法使用摄像头：' + e.message) }
}

/* ================= 小程序市场 ================= */
function showMiniApps() {
  openModal(`
    <div class="modal-title">🛒 小程序市场</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <input id="ma-search" placeholder="🔍 搜索小程序（名称 / 描述 / 作者）" style="flex:1" autocomplete="off">
      <button class="btn btn-primary btn-sm" id="ma-publish">📤 发布</button>
    </div>
    <div id="ma-list"><div class="empty"><div class="empty-icon">⏳</div>加载中…</div></div>
    <div class="card-sub" style="margin-top:8px">格式：单文件自包含 HTML（内联样式/脚本，无外链）· ≤ 5MB · 沙箱运行</div>`,
    async (box) => {
      const listEl = box.querySelector('#ma-list')
      const search = box.querySelector('#ma-search')
      const render = async (kw) => {
        try {
          const data = await fetchApps(kw)
          const apps = data.apps || []
          if (!apps.length) {
            listEl.innerHTML = '<div class="empty"><div class="empty-icon">🎮</div>暂无小程序<br>点击「发布」上传你的第一个作品</div>'
            return
          }
          listEl.innerHTML = apps.map((a) => `
            <div class="card" style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
              <div style="font-size:26px">${esc(a.icon)}</div>
              <div style="flex:1;min-width:0">
                <div class="convo-name">${esc(a.name)} <span class="card-sub">v${esc(a.version)}</span></div>
                <div class="card-sub">${esc(a.description || '暂无简介')} · ${a.sizeKb}KB · ${a.downloads} 次运行</div>
                <div class="card-sub">作者：${esc(a.authorName)}</div>
              </div>
              ${String(a.userId) === String(App.state.user.id) ? `<button class="btn btn-danger btn-sm" data-del="${a.id}">删除</button>` : ''}
              <button class="btn btn-primary btn-sm" data-run="${a.id}">▶ 运行</button>
            </div>`).join('')
          listEl.querySelectorAll('[data-run]').forEach((b) => b.addEventListener('click', () => runMiniApp(b.dataset.run)))
          listEl.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
            if (!confirm('删除这个小程序？')) return
            try { await deleteApp(b.dataset.del); toast('已删除'); showMiniApps() } catch (e) { toast('删除失败：' + e.message) }
          }))
        } catch (e) { listEl.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>加载失败：${esc(e.message)}</div>` }
      }
      let timer = null
      search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => render(search.value.trim()), 300) })
      box.querySelector('#ma-publish').addEventListener('click', showMiniAppPublish)
      await render('')
    })
}

async function runMiniApp(id) {
  try {
    const data = await fetchAppDetail(id)
    const app = data.app
    if (!app || !app.htmlContent) return toast('小程序内容为空')
    openModal(`
      <div class="modal-title">▶ ${esc(app.name)} <span class="card-sub">by ${esc(app.authorName)}</span></div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <button class="btn btn-outline btn-sm" id="ma-fullscreen">⛶ 全屏</button>
        <button class="btn btn-outline btn-sm" id="ma-refresh-scores">🏆 刷新榜单</button>
      </div>
      <iframe id="ma-frame" sandbox="allow-scripts" allowfullscreen
        csp="script-src 'unsafe-inline'"
        style="width:100%;height:min(540px,60vh);border:1px solid var(--divider);border-radius:12px;background:#fff"></iframe>
      <div id="ma-scores" style="margin-top:10px"><div class="card-sub">🏆 排行榜加载中…</div></div>
      <div class="modal-actions"><button class="btn btn-outline" data-close>关闭</button></div>`)
    const frame = document.getElementById('ma-frame')
    frame.srcdoc = app.htmlContent
    renderScores(id)
    document.getElementById('ma-fullscreen').addEventListener('click', () => {
      if (frame.requestFullscreen) frame.requestFullscreen().catch(() => toast('全屏被浏览器拦截，可点击右上角 × 缩放窗口'))
    })
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'tusScore' && typeof e.data.score === 'number') submitScore(id, e.data.score)
    })
    document.getElementById('ma-refresh-scores').addEventListener('click', () => renderScores(id))
  } catch (e) { toast('加载失败：' + e.message) }
}

async function submitScore(appId, score) {
  try {
    await api(`/api/apps/${appId}/score`, { method: 'POST', body: { score, playerName: App.state.user.userName } })
    renderScores(appId)
    toast(`🏆 得分 ${score} 已上榜`)
  } catch (e) { console.error('[score] 提交失败:', e); toast('比分提交失败：' + (e.message || '网络异常')) }
}

async function renderScores(appId) {
  const el = document.getElementById('ma-scores')
  if (!el) return
  try {
    const data = await api(`/api/apps/${appId}/scores`)
    const scores = data.scores || []
    if (!scores.length) { el.innerHTML = '<div class="card-sub">🏆 暂无排行，玩一局即可上榜</div>'; return }
    el.innerHTML = `<div class="card-sub" style="margin-bottom:6px">🏆 排行榜</div>` + scores.slice(0, 10).map((s) => `
      <div class="score-row">
        <span class="score-rank">${s.rank <= 3 ? '🥇🥈🥉'[s.rank - 1] : s.rank}</span>
        <span class="score-name">${esc(s.playerName)}</span>
        <span class="spacer"></span>
        <b style="color:var(--primary)">${s.score}</b>
      </div>`).join('')
  } catch (e) { el.innerHTML = '<div class="card-sub">🏆 排行加载失败</div>' }
}

function showMiniAppPublish() {
  openModal(`
    <div class="modal-title">📤 发布小程序</div>
    <div class="field"><input id="mp-name" placeholder="小程序名称（30 字内）"></div>
    <div class="field"><input id="mp-desc" placeholder="简介（选填）"></div>
    <div class="field"><input id="mp-icon" placeholder="图标 Emoji（选填，默认 🎮）" maxlength="4"></div>
    <div class="field"><input type="file" id="mp-file" accept=".html,text/html" style="padding:6px"></div>
    <div id="mp-err" class="error-text hidden"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-close>取消</button>
      <button class="btn btn-primary" id="mp-submit">发布</button>
    </div>
    <p class="hint">格式要求：单文件自包含 HTML（CSS/JS 内联），禁止外链脚本/样式/iframe，≤ 5MB，沙箱运行</p>`,
    (box) => {
      const err = box.querySelector('#mp-err')
      box.querySelector('#mp-file').addEventListener('change', (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (!file.name.toLowerCase().endsWith('.html')) return show(err, '仅支持 .html 文件')
        if (file.size > 5 * 1024 * 1024) return show(err, '文件不能超过 5MB')
        box.querySelector('#mp-submit').dataset.file = file.name
      })
      box.querySelector('#mp-submit').addEventListener('click', async () => {
        const fileInput = box.querySelector('#mp-file')
        const file = fileInput.files[0]
        const name = box.querySelector('#mp-name').value.trim()
        if (!name) return show(err, '请输入小程序名称')
        if (!file) return show(err, '请选择 .html 文件')
        const htmlContent = await file.text()
        try {
          await publishApp({ name, description: box.querySelector('#mp-desc').value.trim(), icon: box.querySelector('#mp-icon').value.trim() || '🎮', htmlContent })
          toast('✅ 发布成功'); closeModal(); showMiniApps()
        } catch (e2) { show(err, e2.message) }
      })
    })
}

/* 新消息应用内弹窗（右下角，点击跳转会话） */
function showNewMessagePopup(msg, conv) {
  const existing = document.querySelector(`.notify-popup[data-cid="${conv.id}"]`)
  if (existing) existing.remove()
  const box = document.createElement('div')
  box.className = 'notify-popup'
  box.dataset.cid = conv.id
  box.innerHTML = `
    ${avatarHtml(conv.partner, 'avatar avatar-sm')}
    <div style="flex:1;min-width:0">
      <div class="convo-name">${esc(conv.partner.userName)}</div>
      <div class="convo-last">${esc(msg.text || (msg.mediaType === 'video' ? '[视频]' : msg.mediaType === 'audio' ? '[语音]' : '[图片]'))}</div>
    </div>
    <span class="unread-dot" style="align-self:center">新</span>`
  box.addEventListener('click', () => { box.remove(); switchView('message'); showChat(conv) })
  document.body.appendChild(box)
  setTimeout(() => box.remove(), 6000)
}

/* 注册视图入口（供 app.js 调用） */
App.views = {
  // v2
  renderHome, renderComplaint, renderAI, renderCompany, renderColleagueDetail,
  showComplaintCompose, showPublishMenu,
  renderMoodCheckin, renderMoodTrends, renderPersonalityCard, renderRelationshipRadar,
  // 保留（被消息抽屉 / 保留视图调用）
  renderStatus, renderMessage, renderColleagues, renderMine, renderLogin,
  showNewMessagePopup,
  onMessage: (cid) => { if (App.state.activeConversation === cid) renderMessages(App.state.conversations.find((c) => c.id === cid)) },
  onConversationUpdate: () => renderConvoList(),
  onNewMessage: showNewMessagePopup,
  onDataChanged: () => {
    routeDataChange(App.state.views.current, {
      status: renderStatus, colleagues: renderColleagues, home: syncHomeMood, mine: renderMine
    })
  }
}
App.views.current = 'home'

/* ============================================================
 * 职场关系操作系统 v2 —— 视图层
 * ============================================================ */

/* ---------- 字典缓存 ---------- */
async function ensureDict() {
  if (!App.state.dict) {
    try { App.state.dict = (await fetchTags()) } catch (e) { App.state.dict = { colleagueTypes: [], behaviorTags: [], moods: [], stressSources: [], personalityTemplates: [] } }
  }
  return App.state.dict
}
function getDict() { return App.state.dict || { colleagueTypes: [], behaviorTags: [], moods: [], stressSources: [], personalityTemplates: [] } }
function findById(arr, id) { return (arr || []).find((x) => x.id === id || String(x.id) === String(id)) }
function sentimentLabel(value) {
  const mood = MOODS.find((item) => item.id === normalizeMood(value))
  return mood ? mood.label : ''
}

/* ============================================================
 * 首页（桌面 Dashboard）
 * 参考图视觉系统平移：Hero + 四等宽统计卡 + 主区域两栏
 * 单一数据源：App.state.homeOverview（/api/home/overview），未就绪时回退本地状态
 * ============================================================ */

const HOME_QUICK_MOOD_FALLBACK = [
  { id: 'xnz_motivated', label: '元气', assetName: 'xnz_motivated' },
  { id: 'xnz_composed', label: '还行', assetName: 'xnz_composed' },
  { id: 'xnz_calm', label: '一般', assetName: 'xnz_calm' },
  { id: 'xnz_tired', label: '好累', assetName: 'xnz_tired' },
  { id: 'xnz_angry', label: '想辞职', assetName: 'xnz_angry' }
]

function homeGreeting() {
  const period = App.state.homeOverview && App.state.homeOverview.greetingPeriod
  if (period === 'morning') return '早上好'
  if (period === 'afternoon') return '下午好'
  if (period === 'evening') return '晚上好'
  const hour = new Date().getHours()
  return hour < 6 ? '深夜好' : hour < 12 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
}

function homeStatsData() {
  const s = App.state.homeOverview && App.state.homeOverview.stats
  return {
    moodCheckedToday: s ? s.moodCheckedToday : !!(App.state.moodToday && App.state.moodToday.checked),
    plaza: s ? s.plazaComplaintCount : (App.state.complaints || []).length,
    mine: s ? s.myComplaintCount : (App.state.myComplaints || []).length,
    colleagues: s ? s.colleagueCount : (App.state.colleagues || []).length
  }
}

function homeQuickMoods(overview) {
  const moods = overview && overview.quickMoods
  return moods && moods.length === 5 ? moods : HOME_QUICK_MOOD_FALLBACK
}

/* ---------- 首页区块渲染（各接受 overview 数据，返回确定性 HTML） ---------- */

function renderHomeHero(overview = App.state.homeOverview) {
  const u = App.state.user || {}
  const userName = (overview && overview.user && overview.user.userName) || u.userName || '打工人'
  return `
    <div class="home-dash-hero">
      <div class="home-dash-hero-text">
        <div class="home-dash-greet">${esc(homeGreeting())}，${esc(userName)}！</div>
        <div class="home-dash-sub">今天也要好好上班（和好好吐槽）</div>
        <div class="home-dash-search">
          ${uiAssetImg('actionSearch', 'home-search-icon', '')}
          <input id="home-search-input" placeholder="搜索吐槽、同事或公司…" />
        </div>
      </div>
      <div class="home-dash-hero-avatar" id="home-little-energy">
        ${uiAssetImg('homeHeroDecoration', 'home-hero-decoration', '')}
        ${littleEnergyAvatarHtml({ moodId: currentMoodId(), outfit: currentOutfit(), className: 'little-energy-dash-hero' })}
      </div>
    </div>`
}

function renderHomeMood(overview = App.state.homeOverview) {
  const today = App.state.moodToday
  const checked = !!(today && today.checked)
  const moods = homeQuickMoods(overview)
  return `
    <div class="home-dash-card home-dash-mood" id="home-mood">
      <div class="home-dash-card-head">
        <span class="home-dash-card-title">今日情绪打卡</span>
        <span class="spacer"></span>
        ${checked ? `<button class="home-dash-link" id="mood-edit" type="button">修改</button>` : ''}
      </div>
      ${checked ? `
        <div class="home-mood-checked">
          ${littleEnergyAvatarHtml({ moodId: normalizeMood(today.mood), outfit: currentOutfit(), className: 'little-energy-home' })}
          <div style="flex:1">
            <div class="home-mood-title">今天已打卡 · ${esc(today.date || '')}</div>
            <div class="card-sub">${(today.stressSources || []).map((s) => '#' + esc(s)).join(' ')}</div>
          </div>
        </div>` : `
        <div class="home-dash-mood-sub">选一个今天的心情，坚持记录，AI 会生成你的职场情绪画像</div>
        <div class="home-dash-mood-quick">
          ${moods.map((m) => `<button class="home-dash-mood-tile" data-mood="${esc(m.id)}" type="button">
            ${littleEnergyAvatarHtml({ moodId: m.id, outfit: currentOutfit(), className: 'little-energy-mood-tile' })}
            <span>${esc(m.label)}</span>
          </button>`).join('')}
        </div>
        <button class="home-dash-link" id="mood-full" type="button">完整打卡（含压力源/备注）→</button>`}
    </div>`
}

/// overview 最新吐槽摘要 → 吐槽卡片所需形状（保留点赞/共鸣/评论既有能力）
function complaintFromSummary(s) {
  return {
    id: s.id, userId: s.userId, authorName: s.authorName, avatarSymbol: s.avatarSymbol,
    littleEnergyOutfit: s.littleEnergyOutfit, isAnonymous: s.isAnonymous,
    content: s.content, colleagueName: undefined, category: undefined,
    behaviorTags: [], sentiment: s.sentiment, likeCount: s.likeCount,
    resonanceCount: s.resonanceCount, commentCount: s.commentCount,
    resonanceRate: 0, liked: false, resonated: false, time: s.time
  }
}

function renderHomeComplaint(overview = App.state.homeOverview) {
  const summary = overview && overview.latestComplaints && overview.latestComplaints[0]
  const fallback = !summary && App.state.complaints && App.state.complaints[0]
  const body = summary
    ? complaintCardHtml(complaintFromSummary(summary))
    : fallback
      ? complaintCardHtml(fallback)
      : '<div class="empty" style="padding:26px 0">广场还很安静，发第一条吐槽吧</div>'
  return `
    <div class="home-dash-card home-dash-complaint" id="home-complaint">
      <div class="home-dash-card-head">
        <span class="home-dash-card-title">最新吐槽</span>
        <span class="spacer"></span>
        <button class="home-dash-link" data-nav="plaza" type="button">进入广场 →</button>
      </div>
      <div id="home-complaint-body">${body}</div>
    </div>`
}

function renderHomePersonality(overview = App.state.homeOverview) {
  const p = overview && overview.personality
  return `
    <div class="home-dash-card home-dash-personality" data-nav="ai">
      <div class="home-dash-card-head">
        <span class="home-dash-card-title">职场人格</span>
        <span class="spacer"></span>
        <span class="home-dash-card-arrow">→</span>
      </div>
      ${p ? `
        <div class="home-dash-personality-name">${esc(personalityTitle(p.name))}</div>
        <div class="home-dash-personality-meta">已累计 ${p.totalComplaints ?? 0} 条吐槽记录</div>
        <div class="card-sub">${esc(p.summary || '完整报告在 AI 洞察中查看')}</div>` : `
        <div class="card-sub">吐槽几条后，AI 会为你生成职场人格画像</div>`}
    </div>`
}

function renderHomeColleagueSummary(overview = App.state.homeOverview) {
  const cs = overview && overview.colleagueSummary
  const count = cs ? cs.count : (App.state.colleagues || []).length
  const avg = cs && cs.averageScore != null ? Number(cs.averageScore).toFixed(1) : '—'
  const health = cs && cs.healthScore != null ? String(cs.healthScore) : '—'
  return `
    <div class="home-dash-card home-dash-colleague-summary" data-nav="colleague">
      <div class="home-dash-card-head">
        <span class="home-dash-card-title">同事概况</span>
        <span class="spacer"></span>
        <span class="home-dash-card-arrow">→</span>
      </div>
      <div class="home-dash-cs-row">
        <div class="home-dash-cs-item"><b>${count}</b><span>同事档案</span></div>
        <div class="home-dash-cs-item"><b>${avg}</b><span>平均分</span></div>
        <div class="home-dash-cs-item"><b>${health}</b><span>关系健康</span></div>
      </div>
    </div>`
}

function renderHomeQuickLinks() {
  return `
    <div class="home-dash-card home-dash-quicklinks">
      <div class="home-dash-card-head"><span class="home-dash-card-title">快捷入口</span></div>
      <div class="home-dash-ql-grid">
        <button class="home-dash-ql" data-nav="mine" type="button">${uiAssetImg('featureMyComplaints', 'home-ql-icon', '')} 我的吐槽</button>
        <button class="home-dash-ql" data-nav="colleague" type="button">${uiAssetImg('featureColleagues', 'home-ql-icon', '')} 同事档案</button>
        <button class="home-dash-ql" data-nav="ai" type="button">${uiAssetImg('messageAI', 'home-ql-icon', '')} AI 洞察</button>
        <button class="home-dash-ql" data-nav="messages" type="button">${uiAssetImg('navMessages', 'home-ql-icon', '')} 消息中心</button>
      </div>
    </div>`
}

function renderHomeStateBanner() {
  const phase = App.state.homeOverviewPhase
  const has = !!App.state.homeOverview
  if (phase === 'failed' && !has) {
    return `<div class="home-dash-state" id="home-state">
      <span style="color:var(--warning)">⚠️ 首页概览暂时不可用，已展示本地内容</span>
      <button class="home-dash-retry" id="home-retry" type="button">重试</button>
    </div>`
  }
  if (phase === 'loading' && !has) {
    return `<div class="home-dash-state" id="home-state" style="color:var(--text-2)">正在加载首页数据…</div>`
  }
  return '<div id="home-state"></div>'
}

/* ---------- 入口：首页 ---------- */
async function renderHome() {
  const v = document.getElementById('view')
  const u = App.state.user || {}
  const overview = App.state.homeOverview
  v.innerHTML = `
    <div class="home-dash">
      ${renderHomeHero(overview)}
      ${renderHomeStateBanner()}
      <div class="home-main-grid">
        <div class="home-col-left">
          ${renderHomeMood(overview)}
          ${renderHomeComplaint(overview)}
        </div>
        <aside class="home-col-right">
          ${renderHomePersonality(overview)}
          ${renderHomeColleagueSummary(overview)}
          ${renderHomeQuickLinks()}
          <div class="home-dash-card home-radar-card">
            <div class="home-dash-card-head"><span class="home-dash-card-title">📡 职场关系雷达</span></div>
            <div id="home-radar" class="home-radar"><div class="empty">加载中…</div></div>
            <div class="card-sub" style="text-align:center;margin-top:6px">基于你的同事打分</div>
          </div>
          <div class="home-dash-card home-top-card">
            <div class="home-dash-card-head"><span class="home-dash-card-title">🔥 今日热榜 TOP 3</span></div>
            <div id="home-top3" class="home-top3"><div class="empty">加载中…</div></div>
          </div>
        </aside>
      </div>
    </div>
  `
  bindHome()
  await loadHome()
}

function bindHome() {
  const v = document.getElementById('view')
  // 搜索框（接入后端全局搜索）
  const s = v.querySelector('#home-search-input')
  if (s) {
    s.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') renderSearch(s.value.trim())
    })
    s.addEventListener('focus', () => renderSearch(s.value.trim()), { once: true })
  }
  // 委托处理各内容区的导航（快捷入口 / 模块卡）
  v.addEventListener('click', (e) => {
    const navEl = e.target.closest('[data-nav]')
    if (!navEl) return
    const nav = navEl.dataset.nav
    if (nav === 'checkin') renderMoodCheckin()
    else if (nav === 'plaza') switchView('complaint')
    else if (nav === 'mine') renderComplaint({ mode: 'mine' })
    else if (nav === 'colleague') switchView('colleague')
    else if (nav === 'ai') switchView('ai')
    else if (nav === 'messages') openMessageDrawer()
  })
}

async function loadHome() {
  // 首屏单一聚合请求：一次 /api/home/overview 喂饱统计 / 打卡 / 人格 / 吐槽 / 同事概况
  await refreshHomeOverview()
  // 无论成功失败都渲染模块（overview 或本地回退），绝不让首屏停留在骨架
  applyHomeModules()
  // 二级模块：延迟非阻塞
  renderHomeRadar()
  renderHomeTop3()
}

/// 用最新状态重填各首页模块容器（并重建模块内事件）
function applyHomeModules() {
  const v = document.getElementById('view')
  if (!v) return
  const overview = App.state.homeOverview
  const setSlot = (id, html) => {
    const el = v.querySelector('#' + id)
    if (el) el.outerHTML = html
  }
  setSlot('home-state', renderHomeStateBanner())
  setSlot('home-mood', renderHomeMood(overview))
  setSlot('home-complaint', renderHomeComplaint(overview))
  applyHomeMood()
  applyHomeComplaint()
  bindHomeRetry()
}

function bindHomeRetry() {
  const v = document.getElementById('view')
  const btn = v && v.querySelector('#home-retry')
  if (btn) btn.addEventListener('click', () => {
    refreshHomeOverview({ force: true }).then(() => applyHomeModules())
  })
}

// v3 首页：我的职场人格卡（已被 renderHomePersonality 区块替代）

// v3 首页：我的同事关系（已被 renderHomeColleagueSummary 区块替代）

async function renderHomeRadar() {
  const box = document.getElementById('home-radar')
  if (!box) return
  box.innerHTML = skeletonBox(1)
  try {
    const cols = await fetchColleagues()
    const ids = (cols.colleagues || []).map((c) => c.id).slice(0, 50)
    let avg = { cooperation: 60, expertise: 60, communication: 60, support: 60, trust: 60 }
    if (ids.length) {
      const b = await batchRadar(ids)
      const sums = { cooperation: 0, expertise: 0, communication: 0, support: 0, trust: 0 }
      let n = 0
      for (const id of ids) {
        const s = b.items && b.items[id]
        if (s) { for (const k in sums) sums[k] += Number(s[k]); n++ }
      }
      if (n) for (const k in avg) avg[k] = Math.round(sums[k] / n)
    }
    box.innerHTML = `
      <svg viewBox="0 0 200 200" style="width:100%;height:auto">
        ${radarGrid()}
        ${radarPolygon([avg.cooperation, avg.expertise, avg.communication, avg.support, avg.trust], '#7c4dff')}
        ${radarLabels(['沟通', '合作', '信任', '支持', '专业'])}
      </svg>
      <div class="home-radar-health">关系健康度 <b>${Math.round((avg.cooperation + avg.expertise + avg.communication + avg.support + avg.trust) / 5)}</b> 分</div>`
  } catch (e) {
    box.innerHTML = '<div class="empty">雷达加载失败</div>'
  }
}

async function renderHomeTop3() {
  const box = document.getElementById('home-top3')
  if (!box) return
  box.innerHTML = skeletonBox(3)
  try {
    const data = await fetchTopics()
    const list = (data.topics || []).slice(0, 3)
    if (!list.length) { box.innerHTML = '<div class="empty">暂无热榜，多发点吐槽吧</div>'; return }
    box.innerHTML = list.map((t, i) => `
      <div class="home-top-item" data-cid="${t.id}">
        <span class="topic-rank-sm" style="background:${i < 3 ? '#7c4dff' : '#a8a4b8'}">${i + 1}</span>
        <span class="home-top-text">${esc(t.snippet)}</span>
        <span class="home-top-hot">${t.resonanceCount} 共鸣</span>
      </div>`).join('')
    box.querySelectorAll('.home-top-item').forEach((el) => el.addEventListener('click', () => {
      const id = el.dataset.cid
      openComplaintDetail(id)
    }))
  } catch (e) {
    box.innerHTML = '<div class="empty">热榜加载失败</div>'
  }
}

function searchDiscoverHtml() {
  const hotTerms = ['摸鱼型', '已读不回', '周末加班', '甩锅', '喜欢 PUA']
  return `
    <section class="search-discover">
      <div class="search-discover-title">热门搜索</div>
      <div class="search-hot-terms">${hotTerms.map((term) => `<button type="button" class="search-hot-term" data-search-term="${esc(term)}">${esc(term)}</button>`).join('')}</div>
      <div class="search-discover-title">快捷分类</div>
      <div class="search-category-grid">
        <button type="button" class="search-category" data-search-category="complaint">${uiAssetImg('featurePlaza', 'search-category-asset', '')}<span><b>吐槽内容</b><small>搜吐槽关键词</small></span>${uiAssetImg('actionChevron', 'search-category-chevron', '')}</button>
        <button type="button" class="search-category" data-search-category="colleague">${uiAssetImg('featureColleagues', 'search-category-asset', '')}<span><b>同事昵称</b><small>搜同事或称呼</small></span>${uiAssetImg('actionChevron', 'search-category-chevron', '')}</button>
        <button type="button" class="search-category" data-search-category="company">${uiAssetImg('rowCompany', 'search-category-asset', '')}<span><b>公司名称</b><small>搜公司或部门</small></span>${uiAssetImg('actionChevron', 'search-category-chevron', '')}</button>
        <button type="button" class="search-category" data-search-category="tag">${uiAssetImg('profileFavorites', 'search-category-asset', '')}<span><b>行为标签</b><small>搜行为或特征</small></span>${uiAssetImg('actionChevron', 'search-category-chevron', '')}</button>
      </div>
      <div class="search-discover-title">最近搜索 <button type="button" class="search-clear-history" id="search-clear-history">清空</button></div>
      <div class="search-history" id="search-history"></div>
      <div class="search-mascot">${littleEnergyAvatarHtml({ moodId: 'xnz_motivated', outfit: currentOutfit(), className: 'little-energy-search' })}<span>输入关键词，发现同频吐槽</span></div>
    </section>`
}

function recentSearches() { return Array.isArray(App.state.searchHistory) ? App.state.searchHistory : [] }

function saveRecentSearch(query) {
  const normalized = String(query || '').trim()
  if (!normalized) return
  App.state.searchHistory = [normalized, ...recentSearches().filter((item) => item !== normalized)].slice(0, 6)
}

function renderSearchHistory(target) {
  if (!target) return
  const items = recentSearches()
  target.innerHTML = items.length
    ? items.map((item) => `<button type="button" class="search-history-item" data-search-term="${esc(item)}"><span>最近</span>${esc(item)}${uiAssetImg('actionChevron', 'search-history-chevron', '')}</button>`).join('')
    : '<div class="search-history-empty">还没有搜索记录</div>'
}

// 搜索完整页：未输入时展示热词/分类/最近记录，结果与入口保持在同一视图。
async function renderSearch(q = '') {
  const query = String(q || '').trim()
  const v = document.getElementById('view')
  v.innerHTML = `
    <section class="search-page">
      <div class="search-page-head">
        <button class="btn btn-outline btn-sm" id="search-back">${uiAssetImg('actionBack', 'inline-action-asset', '')}关闭</button>
        <span class="section-title">搜索</span>
      </div>
      <form class="search-page-field" id="search-form">
        ${uiAssetImg('actionSearch', 'search-page-icon', '')}
        <input id="search-query" value="${esc(query)}" placeholder="搜索吐槽、同事、公司、标签" autocomplete="off" />
        <button type="submit">搜索</button>
      </form>
      <div id="search-body"></div>
    </section>`
  v.querySelector('#search-back').addEventListener('click', () => switchView('home'))
  const input = v.querySelector('#search-query')
  const body = v.querySelector('#search-body')
  v.querySelector('#search-form').addEventListener('submit', (event) => {
    event.preventDefault()
    renderSearch(input.value)
  })
  const bindDiscover = () => {
    body.querySelectorAll('[data-search-term]').forEach((button) => button.addEventListener('click', () => renderSearch(button.dataset.searchTerm)))
    body.querySelectorAll('[data-search-category]').forEach((button) => button.addEventListener('click', () => {
      const hint = { complaint: '吐槽', colleague: '同事', company: '公司', tag: '标签' }[button.dataset.searchCategory]
      input.placeholder = `搜索${hint}`
      input.focus()
    }))
    body.querySelector('#search-clear-history')?.addEventListener('click', () => {
      App.state.searchHistory = []
      renderSearchHistory(body.querySelector('#search-history'))
    })
  }
  if (!query) {
    body.innerHTML = searchDiscoverHtml()
    renderSearchHistory(body.querySelector('#search-history'))
    bindDiscover()
    return
  }
  body.className = 'search-results'
  body.innerHTML = '<div class="empty">搜索中…</div>'
  try {
    const r = await searchAll(query)
    saveRecentSearch(query)
    if (!r.complaints.length && !r.colleagues.length && !r.companies.length) {
      body.className = 'search-results empty'
      body.innerHTML = `${littleEnergyAvatarHtml({ moodId: 'xnz_composed', outfit: currentOutfit(), className: 'little-energy-search-empty' })}<div>没有找到与「${esc(query)}」相关的内容</div><button type="button" class="btn btn-outline btn-sm" id="search-retry">换个词试试</button>`
      body.querySelector('#search-retry').addEventListener('click', () => { input.focus(); input.select() })
      return
    }
    let html = `<div class="search-result-label">搜索「${esc(query)}」</div>`
    if (r.complaints.length) {
      html += `<div class="search-result-section">吐槽 <span>${r.complaints.length}</span></div>` +
        r.complaints.map((c) => `<button type="button" class="card search-hit search-hit-button" data-cid="${c.id}">
          <div class="complaint-content">${esc(c.snippet)}</div>
          <div class="card-sub">${c.isAnonymous ? '匿名' : ''}${c.category ? ' · ' + esc(c.category) : ''}${c.sentiment ? ' · ' + esc(sentimentLabel(c.sentiment)) : ''}</div>
        </button>`).join('')
    }
    if (r.colleagues.length) {
      html += `<div class="search-result-section">同事 <span>${r.colleagues.length}</span></div>` +
        r.colleagues.map((c) => `<button type="button" class="card search-hit search-hit-button" data-col="${c.id}">
          <div class="feed-author">${esc(c.name)}</div>
          <div class="card-sub">${esc(c.position || '')}${c.department ? ' · ' + esc(c.department) : ''}</div>
        </button>`).join('')
    }
    if (r.companies.length) {
      html += `<div class="search-result-section">公司 <span>${r.companies.length}</span></div>` +
        r.companies.map((c) => `<button type="button" class="card search-hit search-hit-button" data-com="${c.id}">
          <div class="feed-author">${esc(c.name)}</div>
          <div class="card-sub">${esc(c.industry || '')}</div>
        </button>`).join('')
    }
    body.innerHTML = html
    body.querySelectorAll('[data-cid]').forEach((el) => el.addEventListener('click', () => openComplaintDetail(el.dataset.cid)))
    body.querySelectorAll('[data-col]').forEach((el) => el.addEventListener('click', () => renderColleagueDetail(el.dataset.col)))
    body.querySelectorAll('[data-com]').forEach((el) => el.addEventListener('click', () => renderCompanyProfile ? renderCOSub('profile', { companyId: el.dataset.com }) : switchView('company')))
  } catch (e) {
    body.className = 'search-results empty'
    body.innerHTML = '搜索失败：' + esc(e.message)
  }
}

/// 刷新情绪卡容器并绑定快捷打卡（渲染逻辑在 renderHomeMood，这里是更新与交互）
function applyHomeMood() {
  const box = document.getElementById('home-mood')
  if (!box) return
  applyMoodToday(App.state, App.state.moodToday, {
    getElementById: (id) => document.getElementById(id),
    renderAvatar: (moodId) => littleEnergyAvatarHtml({ moodId, outfit: currentOutfit(), className: 'little-energy-dash-hero' })
  })
  box.querySelectorAll('.home-dash-mood-tile').forEach((b) => b.addEventListener('click', async () => {
    try {
      await checkinMood({ mood: b.dataset.mood, stressSources: [], note: '' })
      toast('✅ 已打卡')
      applyHomeMood()
    } catch (e) { toast('打卡失败：' + e.message) }
  }))
  const full = box.querySelector('#mood-full')
  if (full) full.addEventListener('click', () => renderMoodCheckin())
  const edit = box.querySelector('#mood-edit')
  if (edit) edit.addEventListener('click', () => renderMoodCheckin())
}

function syncHomeMood() {
  applyMoodToday(App.state, App.state.moodToday, {
    getElementById: (id) => document.getElementById(id),
    renderAvatar: (moodId) => littleEnergyAvatarHtml({ moodId, outfit: currentOutfit(), className: 'little-energy-dash-hero' }),
    renderMoodCard: applyHomeMood
  })
}

/// 刷新最新吐槽容器并绑定卡片交互（点赞/共鸣/评论/分享）
function applyHomeComplaint() {
  const box = document.getElementById('home-complaint-body')
  if (!box) return
  bindComplaintCardActions(box)
}

// 旧首页 feed / AI 发现模块已由最新吐槽卡 + 快捷入口替代

/* ---------- 吐槽广场 ---------- */
async function renderComplaint(opts = {}) {
  const mode = opts.mode || 'feed'  // feed | mine | topics
  const sort = opts.sort || 'hot'
  const filter = opts.filter || (sort === 'new' ? 'new' : 'recommend')
  setContentPage({ page: 'complaint-feed', options: { mode, sort, filter } })
  const v = document.getElementById('view')
  v.innerHTML = `
    <div class="row" style="margin-bottom:12px">
      <span class="section-title" style="margin:0;flex:1">🔥 吐槽广场</span>
      <button class="btn btn-primary btn-sm" id="cp-compose">✏️ 发吐槽</button>
    </div>
    <div class="cp-tabs" id="cp-tabs">
      <button class="${mode === 'feed' && filter === 'recommend' ? 'active' : ''}" data-mode="feed" data-filter="recommend">热门</button>
      <button class="${mode === 'feed' && filter === 'new' ? 'active' : ''}" data-mode="feed" data-filter="new">最新</button>
      <button class="${mode === 'feed' && filter === 'anonymous' ? 'active' : ''}" data-mode="feed" data-filter="anonymous">匿名</button>
      <button class="${mode === 'feed' && filter === 'colleague' ? 'active' : ''}" data-mode="feed" data-filter="colleague">我的同事</button>
      <button class="${mode === 'mine' ? 'active' : ''}" data-mode="mine">我的</button>
      <button class="${mode === 'favorites' ? 'active' : ''}" data-mode="favorites">收藏</button>
      <button class="${mode === 'topics' ? 'active' : ''}" data-mode="topics">热搜榜</button>
    </div>
    <div id="cp-body"></div>
  `
  v.querySelector('#cp-compose').addEventListener('click', showComplaintCompose)
  v.querySelectorAll('#cp-tabs button').forEach((b) => b.addEventListener('click', () => {
    renderComplaint({ mode: b.dataset.mode, filter: b.dataset.filter || 'recommend' })
  }))
  const body = v.querySelector('#cp-body')
  if (mode === 'topics') return loadTopics(body)
  body.innerHTML = skeletonFeed(3)
  let data
  try {
    data = mode === 'mine' ? await fetchMineComplaints()
      : mode === 'favorites' ? await fetchFavoriteComplaints()
      : await fetchFeedComplaints(sort, filter)
  } catch (e) { body.innerHTML = '<div class="empty">加载失败</div>'; return }
  const list = data.complaints || []
  if (mode === 'mine') App.state.myComplaints = list
  else if (mode === 'favorites') App.state.favoriteComplaints = list
  else App.state.complaints = list
  if (!list.length) {
    body.innerHTML = `<div class="empty"><div class="empty-icon">🔥</div>${mode === 'mine' ? '你还没有发过吐槽' : mode === 'favorites' ? '你还没有收藏吐槽' : '还没有吐槽，去发一条吧'}<br>${mode === 'favorites' ? '' : '<button class="btn btn-primary btn-sm" style="margin-top:12px" id="cp-empty-compose">立即吐槽</button>'}</div>`
    body.querySelector('#cp-empty-compose')?.addEventListener('click', showComplaintCompose)
    return
  }
  body.innerHTML = list.map((c) => complaintCardHtml(c)).join('')
  bindComplaintCardActions(body, { allowDelete: mode === 'mine' })
}

async function loadTopics(body) {
  body.innerHTML = skeletonFeed(3)
  try {
    const data = await fetchTopics()
    const list = data.topics || []
    if (!list.length) { body.innerHTML = '<div class="empty">暂无热搜，多发点吐槽吧</div>'; return }
    body.innerHTML = `
      <div class="topic-list">
        ${list.map((t, i) => `
          <div class="topic-item" data-cid="${t.id}">
            <div class="topic-rank" style="background:${i < 3 ? '#7c4dff' : '#a8a4b8'}">${i + 1}</div>
            <div class="topic-body">
              <div class="topic-text">${esc(t.snippet)}</div>
              <div class="topic-meta">${t.sentiment ? `<span>${esc(sentimentLabel(t.sentiment))}</span> · ` : ''}<span>${t.resonanceCount} 人共鸣 · ${t.likeCount} 赞</span></div>
            </div>
            <div class="topic-hot">🔥 ${t.hotScore.toFixed(0)}</div>
          </div>`).join('')}
      </div>`
    body.querySelectorAll('.topic-item').forEach((el) => el.addEventListener('click', () => {
      const id = el.dataset.cid
      openComplaintDetail(id)
    }))
  } catch (e) {
    body.innerHTML = '<div class="empty">加载失败</div>'
  }
}

async function openComplaintDetail(id) {
  pushContentPage({ page: 'complaint-detail', complaintID: id, focusComments: false })
}

async function renderComplaintDetailPage(id, focusComments = false) {
  setContentPage({ page: 'complaint-detail', complaintID: id, focusComments })
  const v = document.getElementById('view')
  v.innerHTML = `
    <div class="row" style="margin-bottom:16px">
      <button class="btn btn-outline btn-sm" data-page-back>${uiAssetImg('actionBack', 'inline-action-asset', '')}返回</button>
      <span class="section-title" style="margin:0 0 0 10px">吐槽详情</span>
    </div>
    <div id="complaint-detail-body">加载中…</div>`
  v.querySelector('[data-page-back]').addEventListener('click', popContentPage)
  try {
    const data = await fetchComplaint(id)
    const c = data.complaint
    if (!c) throw new Error('该吐槽已被删除')
    const body = v.querySelector('#complaint-detail-body')
    body.innerHTML = `${complaintCardHtml(c)}<section class="card" style="margin-top:14px"><div class="section-title">评论</div><div id="detail-comment-list" class="cmt-list">加载中…</div><div class="cmt-input-row"><input id="detail-comment-input" placeholder="说点什么…（≤300 字）" maxlength="300"><button class="btn btn-primary btn-sm" id="detail-comment-send">发送</button></div></section>`
    bindComplaintCardActions(body)
    await bindDetailComments(body, id, focusComments)
  } catch (e) {
    v.querySelector('#complaint-detail-body').innerHTML = `<div class="empty">打开失败：${esc(e.message)}</div>`
  }
}

async function bindDetailComments(root, complaintID, focusComments) {
  const list = root.querySelector('#detail-comment-list')
  const input = root.querySelector('#detail-comment-input')
  const send = root.querySelector('#detail-comment-send')
  const load = async () => {
    try {
      const response = await fetchComplaintComments(complaintID)
      const comments = response.comments || []
      list.innerHTML = comments.length ? comments.map((comment) => `<div class="cmt-item"><span class="cmt-avatar">${avatarHtml(comment, 'little-energy-comment-avatar')}</span><div class="cmt-body"><div class="cmt-head"><span class="feed-author">${esc(comment.authorName)}</span><span class="card-sub">${fmtTime(comment.time)}</span></div><div class="cmt-text">${esc(comment.content)}</div></div></div>`).join('') : '<div class="empty">还没有评论，来抢沙发～</div>'
    } catch (error) { list.innerHTML = '<div class="empty">评论加载失败</div>' }
  }
  send.addEventListener('click', async () => {
    const content = input.value.trim()
    if (!content) return
    try { await postComplaintComment(complaintID, content); input.value = ''; await load() } catch (error) { toast(error.message) }
  })
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') send.click() })
  await load()
  if (focusComments) input.focus()
}

function complaintCardHtml(c) {
  const tagHtml = (c.behaviorTags || []).map((id) => {
    const tag = getDict().behaviorTags.find((t) => t.id === id)
    return tag ? `<span class="tag tag-vip">${esc(tag.label)}</span>` : ''
  }).join(' ')
  const cat = c.category ? getDict().colleagueTypes.find((x) => x.id === c.category) : null
  const mood = c.sentiment ? MOODS.find((item) => item.id === normalizeMood(c.sentiment)) : null
  return `
    <div class="card complaint-card" data-cid="${c.id}">
      <div class="row">
        <div class="complaint-avatar">${c.isAnonymous ? uiAssetImg('avatarAnonymous', 'anonymous-avatar-asset', '') : avatarHtml(c, 'little-energy-feed-avatar')}</div>
        <div style="flex:1;min-width:0">
          <div class="feed-head">
            <span class="feed-author">${esc(c.authorName)}</span>
            <span class="card-sub">·</span>
            <span class="feed-time">${fmtTime(c.time)}</span>
            ${mood ? `<span class="card-sub">· ${esc(mood.label)}</span>` : ''}
            <span class="spacer"></span><button class="cp-more-btn cp-act-btn" data-act="more" title="更多">${uiAssetImg('actionMore', 'cp-action-icon', '')}</button>
          </div>
          ${c.colleagueName ? `<div class="card-sub" style="margin-top:2px">@ ${esc(c.colleagueName)}</div>` : ''}
          <div class="complaint-content">${esc(c.content)}</div>
          ${(cat || tagHtml) ? `<div class="row" style="margin-top:8px;flex-wrap:wrap;gap:6px">${cat ? `<span class="tag tag-verified">${cat.emoji} ${esc(cat.label)}</span>` : ''}${tagHtml}</div>` : ''}
        </div>
      </div>
      <div class="complaint-actions">
        <span class="spacer"></span>
        <button class="cp-act-btn ${c.liked ? 'active' : ''}" data-act="like">${uiAssetImg('actionLike', 'cp-action-icon', '')} <span data-lc>${c.likeCount || 0}</span></button>
        <button class="cp-act-btn ${c.favorited ? 'active' : ''}" data-act="favorite">${uiAssetImg('profileFavorites', 'cp-action-icon', '')} <span data-fc>${c.favoriteCount || 0}</span> 收藏</button>
        <button class="cp-act-btn" data-act="comment">${uiAssetImg('actionComment', 'cp-action-icon', '')} <span data-cc>${c.commentCount || 0}</span> 评论</button>
        <button class="cp-act-btn" data-act="share">${uiAssetImg('actionShare', 'cp-action-icon', '')} 分享</button>
        ${c.userId === (App.state.user ? App.state.user.id : null) ? `<button class="cp-act-btn" data-act="del" title="删除">🗑</button>` : ''}
      </div>
    </div>`
}

function bindComplaintCardActions(root, opts = {}) {
  root.querySelectorAll('.complaint-card').forEach((card) => {
    const cid = card.dataset.cid
    card.querySelectorAll('.cp-act-btn').forEach((btn) => btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const act = btn.dataset.act
      if (act === 'like') {
        try {
          const r = await toggleLikeComplaint(cid)
          btn.classList.toggle('active', r.liked)
          card.querySelector('[data-lc]').textContent = r.likeCount
        } catch (err) { toast(err.message) }
      } else if (act === 'favorite') {
        try {
          const r = await toggleFavoriteComplaint(cid)
          btn.classList.toggle('active', r.favorited)
          card.querySelector('[data-fc]').textContent = r.favoriteCount
          reconcileFavoriteComplaint(cid, r.favorited, r.favoriteCount)
        } catch (err) { toast(err.message) }
      } else if (act === 'comment') {
        pushContentPage({ page: 'complaint-detail', complaintID: cid, focusComments: true })
      } else if (act === 'share' || act === 'more') {
        const text = card.querySelector('.complaint-content')?.textContent || ''
        if (navigator.share) navigator.share({ title: '职场那些事', text }).catch(() => {})
        else navigator.clipboard.writeText(text).then(() => toast('内容已复制')).catch(() => toast('暂时无法分享'))
      } else if (act === 'del') {
        if (!confirm('删除这条吐槽？')) return
        try {
          await deleteComplaint(cid)
          toast('已删除')
          renderComplaint({ mode: App.state.views.current === 'complaint' ? 'mine' : 'feed' })
        } catch (err) { toast(err.message) }
      }
    }))
    card.addEventListener('click', (event) => {
      if (!event.target.closest('.cp-act-btn')) openComplaintDetail(cid)
    })
  })
}

function reconcileFavoriteComplaint(id, favorited, favoriteCount) {
  const update = (complaint) => complaint.id === id ? { ...complaint, favorited, favoriteCount } : complaint
  App.state.complaints = (App.state.complaints || []).map(update)
  App.state.myComplaints = (App.state.myComplaints || []).map(update)
  App.state.favoriteComplaints = (App.state.favoriteComplaints || []).map(update)
  if (favorited) {
    const source = [...App.state.complaints, ...App.state.myComplaints].find((complaint) => complaint.id === id)
    if (source && !App.state.favoriteComplaints.some((complaint) => complaint.id === id)) App.state.favoriteComplaints.unshift(source)
  } else {
    App.state.favoriteComplaints = App.state.favoriteComplaints.filter((complaint) => complaint.id !== id)
  }
}

// 评论弹窗（设计稿卡片"评论 N"）
async function showCommentPanel(cid, card) {
  openModal(`
    <div class="modal-title">💬 评论</div>
    <div id="cmt-list" class="cmt-list">加载中…</div>
    <div class="cmt-input-row">
      <input id="cmt-input" placeholder="说点什么…（≤300 字）" maxlength="300" />
      <button class="btn btn-primary btn-sm" id="cmt-send">${uiAssetImg('actionSend', 'inline-action-asset light-asset', '')}发送</button>
    </div>
  `, async (box) => {
    const list = box.querySelector('#cmt-list')
    const input = box.querySelector('#cmt-input')
    const send = box.querySelector('#cmt-send')
    const uid = App.state.user ? App.state.user.id : null
    const load = async () => {
      try {
        const r = await fetchComplaintComments(cid)
        const items = r.comments || []
        if (!items.length) { list.innerHTML = '<div class="empty">还没有评论，来抢沙发～</div>'; return }
        list.innerHTML = items.map((m) => `
          <div class="cmt-item">
            <span class="cmt-avatar">${avatarHtml(m, 'little-energy-comment-avatar')}</span>
            <div class="cmt-body">
              <div class="cmt-head"><span class="feed-author">${esc(m.authorName)}</span><span class="card-sub">${fmtTime(m.time)}</span></div>
              <div class="cmt-text">${esc(m.content)}</div>
            </div>
            ${String(m.userId) === String(uid) ? `<button class="cmt-del" data-cid="${m.id}">删除</button>` : ''}
          </div>`).join('')
        list.querySelectorAll('.cmt-del').forEach((b) => b.addEventListener('click', async () => {
          if (!confirm('删除这条评论？')) return
          try {
            await deleteComplaintComment(cid, b.dataset.cid)
            load()
            const cc = card && card.querySelector('[data-cc]')
            if (cc) cc.textContent = Math.max(0, (parseInt(cc.textContent, 10) || 0) - 1)
          } catch (err) { toast(err.message) }
        }))
      } catch (err) { list.innerHTML = '<div class="empty">评论加载失败</div>' }
    }
    send.addEventListener('click', async () => {
      const text = input.value.trim()
      if (!text) return
      try {
        await postComplaintComment(cid, text)
        input.value = ''
        load()
        const cc = card && card.querySelector('[data-cc]')
        if (cc) cc.textContent = (parseInt(cc.textContent, 10) || 0) + 1
      } catch (err) { toast(err.message) }
    })
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send.click() })
    load()
  })
}

/* ---------- 桌面快捷发布：保留侧栏与宽屏弹窗，不复制手机底栏 ---------- */
function showPublishMenu() {
  const actions = [
    ['complaint', 'publishComplaint', '发布吐槽', '吐槽一下，轻松一下'],
    ['dynamic', 'publishDynamic', '记录情绪动态', '写下此刻的职场状态'],
    ['mood', 'publishMood', '今日情绪打卡', '同步全局小能仔状态'],
    ['colleague', 'publishColleague', '新增同事档案', '补充一位同事画像']
  ]
  openModal(`
    <div class="modal-title">快捷发布</div>
    <div class="desktop-publish-grid">
      ${actions.map(([id, asset, title, subtitle]) => `<button class="desktop-publish-item" data-publish="${id}">
        ${uiAssetImg(asset, 'desktop-publish-asset', '')}
        <span><b>${title}</b><small>${subtitle}</small></span>
        ${uiAssetImg('actionChevron', 'tool-chevron', '')}
      </button>`).join('')}
    </div>`, (box) => {
    box.querySelectorAll('[data-publish]').forEach((button) => button.addEventListener('click', () => {
      const action = button.dataset.publish
      closeModal()
      if (action === 'complaint') showComplaintCompose()
      else if (action === 'dynamic') showStatusCompose()
      else if (action === 'mood') renderMoodCheckin()
      else if (action === 'colleague') showColleagueForm()
    }))
  })
}

/* ---------- 快速发布吐槽（带 AI 自动识别） ---------- */
async function showComplaintCompose() {
  pushContentPage({ page: 'complaint-compose' })
}

async function renderComplaintComposePage() {
  await ensureDict()
  const d = getDict()
  const colleagues = App.state.colleagues || []
  setContentPage({ page: 'complaint-compose' })
  const v = document.getElementById('view')
  v.innerHTML = `
    <div class="row" style="margin-bottom:16px">
      <button class="btn btn-outline btn-sm" data-page-back>${uiAssetImg('actionBack', 'inline-action-asset', '')}取消</button>
      <span class="section-title" style="margin:0 0 0 10px">发吐槽</span>
    </div>
    <section class="card complaint-compose-page">
    <div class="form-field">
      <label>同事类型</label>
      <select id="cmp-category">${d.colleagueTypes.map((t) => `<option value="${t.id}">${t.emoji} ${esc(t.label)}</option>`).join('')}</select>
    </div>
    <div class="form-field">
      <label>关联同事（选填）</label>
      <select id="cmp-colleague"><option value="">不关联</option>${colleagues.map((c) => `<option value="${c.id}">${esc(c.name)}${c.position ? '（' + esc(c.position) + '）' : ''}</option>`).join('')}</select>
    </div>
    <div class="form-field">
      <label>行为标签（可多选）</label>
      <div class="pet-chips" id="cmp-behavior">${d.behaviorTags.map((t) => `<button type="button" class="pet-chip" data-id="${t.id}">${esc(t.label)}</button>`).join('')}</div>
    </div>
    <div class="form-field">
      <label>吐槽内容</label>
      <textarea id="cmp-content" placeholder="今天想说点啥…（AI 自动识别情绪/标签）" rows="4" maxlength="1000"></textarea>
      <div id="cmp-ai-hint" class="card-sub" style="color:#7c4dff;margin-top:6px">输入时 AI 会自动识别行为标签，可手动微调</div>
    </div>
    <div class="form-field">
      <label>情绪</label>
      <div class="little-energy-mood-grid" id="cmp-mood">${MOODS.map((m) => moodChoiceHtml(m, 'mood-choice')).join('')}</div>
    </div>
    <div class="form-row">
      <label class="row"><input type="checkbox" id="cmp-anon" /> <span>匿名发布</span></label>
    </div>
    <div class="card-sub" style="color:#f29e4d;margin:8px 0">⚠️ 吐槽请遵守社区规范，请勿泄露真实姓名/公司/严重指控</div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-page-back>取消</button>
      <button class="btn btn-primary" id="cmp-submit">发布</button>
    </div>
    </section>`
  const box = v
  box.querySelectorAll('[data-page-back]').forEach((button) => button.addEventListener('click', popContentPage))
  const sel = new Set()
    box.querySelectorAll('#cmp-behavior .pet-chip').forEach((c) => c.addEventListener('click', () => {
      c.classList.toggle('active')
      if (c.classList.contains('active')) sel.add(c.dataset.id); else sel.delete(c.dataset.id)
    }))
    let aiExtracted = null
    let aiMood = null
    box.querySelector('#cmp-content').addEventListener('input', async (e) => {
      const text = e.target.value.trim()
      if (text.length < 6) return
      try {
        const r = await extractTagsAI(text)
        aiExtracted = { category: r.category, behaviorTags: r.behaviorTags, sentiment: r.sentiment }
        if (r.category) {
          const cat = box.querySelector('#cmp-category')
          cat.value = r.category
        }
        if (r.behaviorTags && r.behaviorTags.length) {
          for (const id of r.behaviorTags) {
            const chip = box.querySelector(`#cmp-behavior .pet-chip[data-id="${id}"]`)
            if (chip && !chip.classList.contains('active')) { chip.classList.add('active'); sel.add(id) }
          }
        }
        aiMood = r.sentiment
        if (r.sentiment) {
          box.querySelectorAll('#cmp-mood .mood-choice').forEach((c) => c.classList.toggle('active', c.dataset.mood === normalizeMood(r.sentiment)))
        }
        box.querySelector('#cmp-ai-hint').textContent = r.hasMatch
          ? `🤖 AI 已识别 ${[r.category && '类型', r.behaviorTags.length && r.behaviorTags.length + '个行为', r.sentiment && '情绪'].filter(Boolean).join(' / ')}`
          : 'AI 未识别到标签，会按你手工选择的发布'
      } catch (err) { /* ignore */ }
    })
    box.querySelector('#cmp-submit').addEventListener('click', async () => {
      const content = box.querySelector('#cmp-content').value.trim()
      if (!content) return toast('请填写吐槽内容')
      if (content.length > 1000) return toast('内容不能超过 1000 字')
      const mood = box.querySelector('#cmp-mood .mood-choice.active')
      const payload = {
        content,
        category: box.querySelector('#cmp-category').value,
        colleagueId: box.querySelector('#cmp-colleague').value || null,
        behaviorTags: [...sel],
        sentiment: mood ? compatibleMoodPayload(mood.dataset.mood) : null,
        isAnonymous: box.querySelector('#cmp-anon').checked,
        aiExtracted
      }
      try {
        await postComplaint(payload)
        toast('✅ 已发布')
        if (App.views.current === 'complaint' || App.views.current === 'home') {
          if (App.views.current === 'complaint') {
            contentHistory().reset()
            renderComplaint({ mode: 'feed' })
          }
          else { await refreshHomeOverview({ force: true }); switchView('home') }
        }
      } catch (err) { toast('发布失败：' + err.message) }
    })
}

/* ---------- 同事详情（含关系雷达 + AI 解读） ---------- */
async function renderColleagueDetail(colleagueId) {
  await ensureDict()
  const v = document.getElementById('view')
  const list = App.state.colleagues || []
  const c = list.find((x) => String(x.id) === String(colleagueId))
  if (!c) { renderColleagues(); return }
  const cat = c.attributeTags || []
  const profileRows = []
  if (c.age != null) profileRows.push(`年龄 ${c.age}岁`)
  if (c.weight != null) profileRows.push(`体重 ${c.weight}kg`)
  if (c.personalityScore != null) profileRows.push(`性格指数 ${'★'.repeat(Math.max(1, Math.min(5, Math.round(c.personalityScore))))}${'☆'.repeat(5 - Math.max(1, Math.min(5, Math.round(c.personalityScore))))}`)
  if (c.workplaceType) profileRows.push(`职场类型 ${esc(c.workplaceType)}`)
  if (c.riskLevel) profileRows.push(`风险等级 ${esc(c.riskLevel)}`)
  v.innerHTML = `
    <div class="row" style="margin-bottom:14px">
      <button class="btn btn-outline btn-sm" id="cd-back">← 返回</button>
      <span class="spacer"></span>
      <button class="btn btn-outline btn-sm" id="cd-edit">编辑档案</button>
    </div>
    <div class="card">
      <div class="row" style="gap:12px">
        ${colleagueAvatarHtml(c, 'colleague-avatar-lg')}
        <div style="flex:1;min-width:0">
          <div class="colleague-name-lg">${esc(c.name)}</div>
          <div class="card-sub">${esc(c.position || '')} · ${esc(c.department || '')} · ${esc(c.relation || '未填关系')}</div>
          ${cat.length ? `<div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px">${cat.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}
          ${profileRows.length ? `<div class="card-sub" style="margin-top:6px;color:#7c4dff">${profileRows.join(' · ')}</div>` : ''}
          ${c.quote ? `<div class="quote-box" style="margin-top:8px">💬 「${esc(c.quote)}」</div>` : ''}
        </div>
      </div>
    </div>

    <!-- 关系雷达 -->
    <div class="card" style="margin-top:12px">
      <div class="row"><span class="section-title" style="margin:0;flex:1">📡 关系雷达</span><span class="card-sub" id="cd-radar-edit-btn">编辑</span></div>
      <div id="cd-radar">加载中…</div>
    </div>

    <!-- 品行系统（v3 游戏化人格） -->
    <div class="card" style="margin-top:12px">
      <div class="row"><span class="section-title" style="margin:0;flex:1">🧬 品行系统</span><span class="card-sub">六维人格 · 行为预测</span></div>
      <div id="cd-persona">加载中…</div>
    </div>

    <!-- 聊天记录分析（v3 AI 职场心理分析） -->
    <div class="card" style="margin-top:12px">
      <div class="section-title">💬 聊天记录分析</div>
      <div id="cd-analysis">加载中…</div>
    </div>

    <!-- AI 解读 -->
    <div class="card" style="margin-top:12px">
      <div class="section-title">🧠 AI 同事关系解读</div>
      <div id="cd-ai">加载中…</div>
    </div>

    <!-- 关联吐槽 -->
    <div class="card" style="margin-top:12px">
      <div class="row"><span class="section-title" style="margin:0;flex:1">📝 关联吐槽</span><button class="btn btn-outline btn-sm" id="cd-add-complaint">记一笔</button></div>
      <div id="cd-list" style="margin-top:10px">加载中…</div>
    </div>
  `
  v.querySelector('#cd-back').addEventListener('click', () => renderColleagues())
  v.querySelector('#cd-edit').addEventListener('click', () => showColleagueForm(c))
  v.querySelector('#cd-radar-edit-btn').addEventListener('click', () => openRadarEditor(c))
  v.querySelector('#cd-add-complaint').addEventListener('click', () => {
    showComplaintCompose().then(() => {
      // 把关联同事预填
      setTimeout(() => {
        const sel = document.querySelector('#cmp-colleague')
        if (sel) sel.value = c.id
      }, 100)
    })
  })
  renderRelationshipRadar(c.id, 'cd-radar')
  renderPersonaCard(c.id, 'cd-persona')
  renderChatAnalysisCard('cd-analysis')
  renderCDRadarAI(c.id, 'cd-ai')
  renderCDRelatedComplaints(c.id, 'cd-list')
}

async function renderRelationshipRadar(colleagueId, mountId) {
  const box = document.getElementById(mountId)
  try {
    const r = await getRadar(colleagueId)
    const s = r.scores
    box.innerHTML = `
      <div class="radar-row">
        <svg viewBox="0 0 200 200" class="radar-svg">
          ${radarGrid()}
          ${radarPolygon([s.cooperation, s.expertise, s.communication, s.support, s.trust], '#7c4dff')}
          ${radarLabels(['合作', '专业', '沟通', '支持', '信任'])}
        </svg>
        <div class="radar-scores">
          ${[['合作', s.cooperation], ['专业', s.expertise], ['沟通', s.communication], ['支持', s.support], ['信任', s.trust]].map(([n, v]) => `
            <div class="radar-score"><span>${n}</span><span class="radar-bar"><span class="radar-bar-fill" style="width:${v}%"></span></span><span class="radar-bar-num">${Math.round(v)}</span></div>
          `).join('')}
          <div class="radar-meta">${r.scored ? '基于你打的分' : '尚未打分，显示默认 60'}</div>
        </div>
      </div>`
  } catch (e) { box.innerHTML = '<div class="empty">雷达加载失败</div>' }
}

// v3 品行系统：六维人格打分 + 行为预测
async function renderPersonaCard(colleagueId, mountId) {
  const box = document.getElementById(mountId)
  const DIMS = [
    ['eq', '情商'], ['responsibility', '责任心'], ['control', '控制欲'],
    ['execution', '执行力'], ['showmanship', '表演欲'], ['temper', '脾气']
  ]
  try {
    const [g, pr] = await Promise.all([getPersona(colleagueId), getPersonaPrediction(colleagueId)])
    const s = g.scores || {}
    box.innerHTML = `
      <div class="persona-sliders">
        ${DIMS.map(([k, label]) => `
          <div class="form-field" style="margin-bottom:6px">
            <label>${label} <span id="pv-${k}">${Math.round(s[k] || 50)}</span></label>
            <input type="range" min="0" max="100" value="${s[k] || 50}" id="ps-${k}" />
          </div>`).join('')}
      </div>
      <div class="row" style="margin:6px 0 12px">
        <span class="spacer"></span>
        <button class="btn btn-primary btn-sm" id="persona-save">保存打分</button>
      </div>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${(pr.traits || []).map((t) => `<span class="tag tag-vip">${esc(t.label)}</span>`).join('')}
        <span class="tag">风险 ${esc(pr.riskLevel || '低')}</span>
      </div>
      <div class="persona-predict">
        ${(pr.predictions || []).map((p) => `
          <div class="pred-row">
            <span class="pred-label">${esc(p.label)}</span>
            <div class="pred-bar"><div class="pred-fill" style="width:${p.probability}%;background:${p.probability >= 60 ? '#ff6b6b' : p.probability >= 40 ? '#f29e4d' : '#51cf66'}"></div></div>
            <span class="pred-num">${p.probability}%</span>
          </div>`).join('')}
      </div>
      <div class="card-sub" style="margin-top:8px">${esc(pr.disclaimer || '')}</div>`
    // 滑块实时值
    DIMS.forEach(([k]) => {
      box.querySelector('#ps-' + k).addEventListener('input', (e) => {
        box.querySelector('#pv-' + k).textContent = e.target.value
      })
    })
    box.querySelector('#persona-save').addEventListener('click', async () => {
      const scores = {}
      DIMS.forEach(([k]) => { scores[k] = Number(box.querySelector('#ps-' + k).value) })
      try {
        await postPersona(colleagueId, scores)
        toast('✅ 品行打分已保存')
        renderPersonaCard(colleagueId, mountId)
      } catch (err) { toast(err.message) }
    })
  } catch (e) {
    box.innerHTML = '<div class="empty">品行系统加载失败</div>'
  }
}

// v3 聊天记录分析（粘贴文本 → AI 分析）
function renderChatAnalysisCard(mountId) {
  const box = document.getElementById(mountId)
  box.innerHTML = `
    <div class="card-sub" style="margin-bottom:8px">粘贴你与该同事的聊天记录（每行一条消息），AI 分析沟通模式与建议</div>
    <textarea id="ca-input" rows="5" placeholder="你马上把这个改一下&#10;好，我看下&#10;你怎么又搞不定？&#10;这个不关我事…" style="width:100%"></textarea>
    <div class="row" style="margin-top:8px">
      <button class="btn btn-primary btn-sm" id="ca-run">🔍 开始分析</button>
      <button class="btn btn-outline btn-sm" id="ca-demo" style="margin-left:8px">填入示例</button>
    </div>
    <div id="ca-result" style="margin-top:12px"></div>`
  box.querySelector('#ca-run').addEventListener('click', async () => {
    const text = box.querySelector('#ca-input').value.trim()
    if (!text) return toast('请先粘贴聊天记录')
    const res = box.querySelector('#ca-result')
    res.innerHTML = '<div class="empty">分析中…</div>'
    try {
      const r = await analyzeChat({ text })
      res.innerHTML = `
        <div class="row" style="gap:14px;flex-wrap:wrap;margin-bottom:10px">
          <span class="card-sub">共 ${r.total} 条消息</span>
          ${r.avgReplyHours != null ? `<span class="card-sub">平均回复 ${r.avgReplyHours} 小时</span>` : ''}
        </div>
        <div class="card-sub" style="margin-bottom:6px">情绪分布</div>
        <div class="sentiment-bar">
          <div class="sent-pos" style="width:${r.sentiment.positive}%">积极 ${r.sentiment.positive}%</div>
          <div class="sent-neu" style="width:${r.sentiment.neutral}%">中性 ${r.sentiment.neutral}%</div>
          <div class="sent-neg" style="width:${r.sentiment.negative}%">消极 ${r.sentiment.negative}%</div>
        </div>
        ${(r.patterns || []).filter((p) => p.key !== 'balanced').length ? `
          <div class="card-sub" style="margin:10px 0 6px">沟通模式</div>
          <ul class="ca-patterns">${r.patterns.filter((p) => p.key !== 'balanced').map((p) => `<li>${esc(p.label)}（${p.count} 条，占 ${p.ratio}%）</li>`).join('')}</ul>` : ''}
        <div class="card-sub" style="margin:10px 0 6px">建议</div>
        <ul class="ca-suggestions">${r.suggestions.map((s2) => `<li>💡 ${esc(s2)}</li>`).join('')}</ul>
        <div class="card-sub" style="margin-top:8px">${esc(r.disclaimer || '')}</div>`
    } catch (err) { res.innerHTML = '<div class="empty">分析失败：' + esc(err.message) + '</div>' }
  })
  box.querySelector('#ca-demo').addEventListener('click', () => {
    box.querySelector('#ca-input').value = '你马上把这个需求改一下\n好，我看下\n你怎么又搞不定？\n你自己看看\n今晚必须给我\n收到，辛苦了\n明天再说吧\n这个不关我事\n周六加个班处理一下'
  })
}

function radarGrid() {
  // 同心五边形 5 层
  const pts = []
  for (let i = 1; i <= 4; i++) {
    const r = i * 22
    let s = ''
    for (let k = 0; k < 5; k++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * k) / 5
      const x = 100 + r * Math.cos(angle)
      const y = 100 + r * Math.sin(angle)
      s += `${k === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `
    }
    pts.push(`<path d="${s}Z" fill="none" stroke="#e8e2f5" stroke-width="1" />`)
  }
  // 5 条轴线
  const axes = []
  for (let k = 0; k < 5; k++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * k) / 5
    const x = 100 + 88 * Math.cos(angle)
    const y = 100 + 88 * Math.sin(angle)
    axes.push(`<line x1="100" y1="100" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e8e2f5" />`)
  }
  return pts.concat(axes).join('')
}

function radarPolygon(values, color) {
  const n = values.length
  let s = ''
  for (let k = 0; k < n; k++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * k) / n
    const r = (Number(values[k]) || 0) * 0.88
    const x = 100 + r * Math.cos(angle)
    const y = 100 + r * Math.sin(angle)
    s += `${k === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `
  }
  s += 'Z'
  return `<path d="${s}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="2" />`
}

function radarLabels(labels) {
  const out = []
  for (let k = 0; k < labels.length; k++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * k) / labels.length
    const x = 100 + 105 * Math.cos(angle)
    const y = 100 + 105 * Math.sin(angle)
    out.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="#5a4f72" font-size="12" font-weight="600">${esc(labels[k])}</text>`)
  }
  return out.join('')
}

function openRadarEditor(colleague) {
  getRadar(colleague.id).then((r) => {
    const s = r.scores
    openModal(`
      <div class="modal-title">📡 编辑关系雷达 · ${esc(colleague.name)}</div>
      ${['cooperation', 'expertise', 'communication', 'support', 'trust'].map((k, i) => `
        <div class="form-field">
          <label>${['合作', '专业', '沟通', '支持', '信任'][i]} <span id="rv-${k}">${Math.round(s[k])}</span></label>
          <input type="range" min="0" max="100" value="${s[k]}" id="rs-${k}" />
        </div>`).join('')}
      <div class="modal-actions">
        <button class="btn btn-outline" data-close>取消</button>
        <button class="btn btn-primary" id="rs-submit">保存</button>
      </div>
    `, (box) => {
      const keys = ['cooperation', 'expertise', 'communication', 'support', 'trust']
      keys.forEach((k) => {
        box.querySelector('#rs-' + k).addEventListener('input', (e) => {
          box.querySelector('#rv-' + k).textContent = e.target.value
        })
      })
      box.querySelector('#rs-submit').addEventListener('click', async () => {
        const scores = {}
        keys.forEach((k) => scores[k] = Number(box.querySelector('#rs-' + k).value))
        try {
          await postRadar(colleague.id, scores)
          toast('✅ 已保存雷达打分')
          closeModal()
          renderRelationshipRadar(colleague.id, 'cd-radar')
        } catch (err) { toast('保存失败：' + err.message) }
      })
    })
  })
}

async function renderCDRadarAI(colleagueId, mountId) {
  const box = document.getElementById(mountId)
  try {
    const r = await getRelationshipSummary(colleagueId)
    box.innerHTML = `
      <div class="ai-disclaimer">${esc(r.disclaimer)}</div>
      <div class="ai-row"><span class="ai-label">关系类型</span><span class="ai-value">${esc(r.relationType)}</span></div>
      <div class="ai-row"><span class="ai-label">关系健康度</span><span class="ai-value">${r.healthScore} 分</span></div>
      ${r.topBehaviors.length ? `<div class="ai-row"><span class="ai-label">高频行为</span><span class="ai-value">${r.topBehaviors.map((b) => `<span class="tag tag-vip">${esc(b)}</span>`).join(' ')}</span></div>` : ''}
      <div class="ai-row"><span class="ai-label">主要矛盾</span><span class="ai-value">${r.conflicts.map((c) => `<span class="tag">${esc(c)}</span>`).join(' ')}</span></div>
      <div class="ai-section-title">🛠 改进建议</div>
      <ul class="ai-suggestions">${r.suggestions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    `
  } catch (e) { box.innerHTML = '<div class="empty">AI 解读生成中</div>' }
}

async function renderCDRelatedComplaints(colleagueId, mountId) {
  const box = document.getElementById(mountId)
  try {
    const r = await fetchMineComplaints()
    const list = (r.complaints || []).filter((c) => String(c.colleagueId) === String(colleagueId))
    if (!list.length) { box.innerHTML = '<div class="card-sub">还没有与该同事相关的吐槽</div>'; return }
    box.innerHTML = list.map((c) => complaintCardHtml(c)).join('')
    bindComplaintCardActions(box)
  } catch (e) { box.innerHTML = '<div class="empty">加载失败</div>' }
}

/* ---------- AI 洞察主视图 ---------- */
async function renderAI() {
  await ensureDict()
  const v = document.getElementById('view')
  v.innerHTML = `
    <div class="row" style="margin-bottom:14px">
      <span class="section-title" style="margin:0;flex:1">🧠 AI 洞察</span>
    </div>
    <div class="ai-subtabs" id="ai-subtabs">
      <button class="active" data-sub="personality">我的职场人格</button>
      <button data-sub="trends">情绪趋势</button>
      <button data-sub="interpersonal">人际关系</button>
      <button data-sub="colleague">同事分析</button>
      <button data-sub="advice">职场建议</button>
    </div>
    <div id="ai-body"></div>
  `
  v.querySelectorAll('#ai-subtabs button').forEach((b) => b.addEventListener('click', () => {
    v.querySelectorAll('#ai-subtabs button').forEach((x) => x.classList.toggle('active', x === b))
    renderAISub(b.dataset.sub)
  }))
  renderAISub('personality')
}

async function renderAISub(sub) {
  const box = document.getElementById('ai-body')
  box.innerHTML = skeletonBox(3)
  try {
    if (sub === 'personality') return renderPersonalityCard(box)
    if (sub === 'trends') return renderMoodTrends(box)
    if (sub === 'interpersonal') return renderAIInterpersonal(box)
    if (sub === 'colleague') return renderAIColleague(box)
    if (sub === 'advice') return renderAIAdvice(box)
  } catch (e) { box.innerHTML = '<div class="empty">加载失败</div>' }
}

async function renderPersonalityCard(box) {
  const r = await getPersonality()
  const tpl = getDict().personalityTemplates.find((t) => t.label === r.personality) || r
  box.innerHTML = `
    <div class="personality-card">
      ${littleEnergyAvatarHtml({ moodId: currentMoodId(), outfit: currentOutfit(), className: 'little-energy-personality' })}
      <div class="personality-label-lg">${esc(personalityTitle(r.personality) || '摸鱼哲学家')}</div>
      <div class="personality-desc">${esc(tpl.desc)}</div>
      <div class="personality-stats">
        <div class="personality-stat"><div class="personality-stat-num">${r.stats.totalComplaints}</div><div class="personality-stat-label">吐槽次数</div></div>
        <div class="personality-stat"><div class="personality-stat-num">${r.stats.totalResonances}</div><div class="personality-stat-label">共鸣次数</div></div>
        <div class="personality-stat"><div class="personality-stat-num">${r.stats.emotionIndex}</div><div class="personality-stat-label">情绪指数</div></div>
        <div class="personality-stat"><div class="personality-stat-num">${r.stats.relationshipSensitivity}</div><div class="personality-stat-label">关系敏感度</div></div>
        <div class="personality-stat"><div class="personality-stat-num">${r.stats.slackScore}</div><div class="personality-stat-label">摸鱼能力</div></div>
      </div>
      <div class="personality-most">
        <div>最常吐槽：<b>${esc(r.stats.topTarget || '—')}</b></div>
        <div>最常出现：<b>${esc(r.stats.topTheme || '—')}</b></div>
        <div>最容易生气：<b>${esc(r.stats.weakestPoint || '—')}</b></div>
      </div>
      <div class="ai-disclaimer">${esc(r.disclaimer)}</div>
      <div class="row" style="margin-top:14px">
        <button class="btn btn-primary btn-sm" id="ps-share">📤 生成分享图</button>
      </div>
    </div>
  `
  box.querySelector('#ps-share').addEventListener('click', async () => {
    try {
      const canvas = await drawPersonalityShare(r, tpl)
      const dataUrl = canvas.toDataURL('image/png')
      openModal(`
        <div class="modal-title">📤 职场人格分享卡</div>
        <div style="text-align:center"><img src="${dataUrl}" style="max-width:320px;border-radius:14px;box-shadow:0 4px 20px rgba(124,77,255,.25)"></div>
        <div class="row" style="margin-top:12px;gap:8px">
          <button class="btn btn-primary" style="flex:1" id="share-download">⬇️ 保存图片</button>
          <button class="btn btn-outline" style="flex:1" id="share-copy">📋 复制图片</button>
        </div>
      `, (box2) => {
        box2.querySelector('#share-download').addEventListener('click', () => {
          const a = document.createElement('a')
          a.href = dataUrl; a.download = '职场人格-' + (r.personality || 'card') + '.png'
          a.click()
        })
        box2.querySelector('#share-copy').addEventListener('click', () => {
          canvas.toBlob(async (blob) => {
            try {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
              toast('✅ 图片已复制，去朋友圈粘贴吧')
            } catch (e) { toast('复制图片失败，请用「保存图片」') }
          })
        })
      })
    } catch (e) {
      // canvas 不可用时降级为复制文案
      navigator.clipboard.writeText(`我刚解锁了「${r.personality}」 — ${tpl.desc}\n来自职场那些事`)
        .then(() => toast('✅ 文案已复制到剪贴板'))
        .catch(() => toast('生成分享图失败'))
    }
  })
}

// 绘制职场人格分享图（canvas）
async function drawPersonalityShare(r, tpl) {
  const W = 600, H = 800
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#7c4dff'); g.addColorStop(1, '#4a24b8')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 0.12; ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(W - 50, 90, 130, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(40, H - 70, 100, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'
  ctx.font = 'bold 30px "Microsoft YaHei", sans-serif'
  ctx.fillText('我的职场人格', W / 2, 78)
  const avatarLayers = await Promise.all(littleEnergyAssetSources(currentMoodId(), currentOutfit()).map((src) => loadCanvasImage(src)))
  avatarLayers.forEach((img) => ctx.drawImage(img, W / 2 - 90, 105, 180, 180))
  ctx.font = 'bold 38px "Microsoft YaHei", sans-serif'
  ctx.fillText(personalityTitle(r.personality) || '摸鱼哲学家', W / 2, 315)
  ctx.font = '19px "Microsoft YaHei", sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  const descLines = wrapText(ctx, tpl.desc || '', W / 2, 365, W - 110)
  const stats = [
    ['吐槽次数', r.stats.totalComplaints], ['共鸣次数', r.stats.totalResonances],
    ['情绪指数', r.stats.emotionIndex], ['关系敏感度', r.stats.relationshipSensitivity], ['摸鱼能力', r.stats.slackScore]
  ]
  const startY = Math.max(440, 380 + descLines * 30)
  stats.forEach(([label, v], i) => {
    const y = startY + i * 58
    ctx.fillStyle = 'rgba(255,255,255,.16)'
    roundRect(ctx, 70, y, W - 140, 46, 23); ctx.fill()
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'
    ctx.font = 'bold 17px "Microsoft YaHei", sans-serif'
    ctx.fillText(label, 95, y + 29)
    ctx.textAlign = 'right'
    ctx.fillText(String(v), W - 95, y + 29)
    ctx.fillStyle = 'rgba(255,255,255,.28)'
    roundRect(ctx, 210, y + 36, W - 380, 6, 3); ctx.fill()
    ctx.fillStyle = '#ffd166'
    roundRect(ctx, 210, y + 36, (W - 380) * Math.min(1, (Number(v) || 0) / 100), 6, 3); ctx.fill()
  })
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.7)'
  ctx.font = '16px "Microsoft YaHei", sans-serif'
  ctx.fillText('职场那些事 · 职场关系操作系统', W / 2, H - 36)
  return canvas
}
function wrapText(ctx, text, x, y, maxWidth) {
  const lines = []
  const chars = String(text).split('')
  let line = ''
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxWidth) { lines.push(line); line = ch }
    else line += ch
  }
  if (line) lines.push(line)
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x, y + i * 28))
  return Math.min(lines.length, 3)
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

async function renderMoodTrends(box) {
  const summary = await fetchMoodSummary()
  const trends = await fetchMoodTrends(30)
  box.innerHTML = `
    <div class="card">
      <div class="row"><span class="section-title" style="margin:0;flex:1">📈 最近 30 天情绪</span></div>
      ${moodChartSvg(trends.trend)}
      <div class="mood-legend">情绪分值：积极 +3 · 平稳 0 · 低落 −3</div>
    </div>
    ${summary.insights && summary.insights.length ? `
      <div class="card" style="margin-top:12px">
        <div class="section-title">🧠 AI 总结</div>
        <ul class="home-ai-list">${summary.insights.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        ${summary.rankings && summary.rankings.length ? `<div class="rank-list">${summary.rankings.map((r, i) => `<div class="rank-item"><span class="rank-medal">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span><span class="rank-label">${esc(r.id)}</span><span class="rank-bar"><span class="rank-bar-fill" style="width:${Math.min(100, r.count * 20)}%"></span></span><span class="rank-count">${r.count} 次</span></div>`).join('')}</div>` : ''}
      </div>` : ''}
  `
}

function moodChartSvg(trend) {
  const days = trend.length
  const W = 600, H = 160, pad = 30
  const moodToY = (value) => {
    const mood = MOODS.find((item) => item.id === normalizeMood(value))
    return mood ? (3 - mood.score) / 6 : null
  }
  const colorOf = (value) => {
    const mood = MOODS.find((item) => item.id === normalizeMood(value))
    if (!mood) return '#cfd8dc'
    return mood.score > 1 ? '#7c4dff' : mood.score >= 0 ? '#75c9b7' : mood.score >= -1 ? '#ffd166' : '#ef769f'
  }
  let pts = []
  const points = trend.map((d, i) => {
    const x = pad + (W - 2 * pad) * (i / Math.max(1, days - 1))
    const yIdx = moodToY(d.mood)
    return yIdx === null ? null : { x, y: pad + (H - 2 * pad) * yIdx, mood: d.mood, i }
  }).filter(Boolean)
  let path = ''
  points.forEach((p, i) => { path += (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ' ' })
  return `
    <svg viewBox="0 0 ${W} ${H}" class="mood-svg">
      <rect x="${pad}" y="${pad}" width="${W - pad * 2}" height="${H - pad * 2}" fill="#faf9ff" rx="6" />
      ${[0, 0.25, 0.5, 0.75, 1].map((p) => {
        const y = pad + (H - 2 * pad) * p
        return `<line x1="${pad}" y1="${y.toFixed(1)}" x2="${W - pad}" y2="${y.toFixed(1)}" stroke="#eee" />`
      }).join('')}
      ${path ? `<path d="${path}" fill="none" stroke="#7c4dff" stroke-width="2" />` : ''}
      ${points.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${colorOf(p.mood)}" stroke="#fff" stroke-width="2" />`).join('')}
    </svg>
    <div class="mood-axis">${points.length ? `<span>${fmtTrendDate(trend.find((d) => d.mood)?.date)}</span><span></span><span>${fmtTrendDate(trend.slice().reverse().find((d) => d.mood)?.date)}</span>` : ''}</div>
  `
}
function fmtTrendDate(s) { return s ? s.slice(5) : '' }

async function renderAIInterpersonal(box) {
  await ensureDict()
  const colleagues = (App.state.colleagues || []).slice(0, 8)
  if (!colleagues.length) {
    box.innerHTML = `<div class="empty">还没有同事档案<br>先去「同事」页添加同事，AI 才能给关系洞察</div>`
    return
  }
  const ids = colleagues.map((c) => Number(c.id))
  const radar = (await batchRadar(ids)).items || {}
  box.innerHTML = `<div class="grid-cards">${colleagues.map((c) => {
    const r = radar[c.id] || { cooperation: 60, expertise: 60, communication: 60, support: 60, trust: 60 }
    const avg = Math.round((r.cooperation + r.expertise + r.communication + r.support + r.trust) / 5)
    return `
      <div class="grid-card" data-cid="${c.id}">
        <div class="grid-card-avatar">${littleEnergyAvatarHtml({ role: 'darkColleague', className: 'little-energy-colleague-card' })}</div>
        <div class="grid-card-name">${esc(c.name)}</div>
        <div class="grid-card-meta">${esc(c.position || '')}</div>
        <div class="grid-card-score">${avg}<span> / 100</span></div>
        <div class="grid-card-bar"><span style="width:${avg}%"></span></div>
      </div>
    `
  }).join('')}</div>`
  box.querySelectorAll('.grid-card').forEach((el) => el.addEventListener('click', () => renderColleagueDetail(el.dataset.cid)))
}

async function renderAIColleague(box) {
  await renderAIInterpersonal(box)
}

async function renderAIAdvice(box) {
  const summary = await fetchMoodSummary()
  const personality = await getPersonality()
  box.innerHTML = `
    <div class="card">
      <div class="section-title">🛠 职场建议（基于你的数据）</div>
      <ul class="home-ai-list">
        ${summary.insights && summary.insights.length ? summary.insights.map((s) => `<li>${esc(s)}</li>`).join('') : '<li>坚持每天打卡，一周后 AI 才能给出更准确的建议。</li>'}
      </ul>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="section-title">💡 通用建议</div>
      <ul class="home-ai-list">
        <li>对「临时需求」类吐槽，先书面记录需求边界，再回复「好的，我先评估时间」给自己留余地。</li>
        <li>对「甩锅」类吐槽，养成存邮件/聊天截图习惯，关键决策多用文字确认。</li>
        <li>对「会议废话」类吐槽，主动发会前议程 + 会后结论，把责任链清晰化。</li>
        <li>每天 5-10 秒打卡，长期积累就是你的「职场关系数据资产」。</li>
      </ul>
    </div>
    <div class="ai-disclaimer">${esc(personality.disclaimer)}</div>
  `
}

/* ---------- 公司画像 + 热榜 + 生态 ---------- */
async function renderCompany() {
  await ensureDict()
  const v = document.getElementById('view')
  v.innerHTML = `
    <div class="row" style="margin-bottom:14px">
      <span class="section-title" style="margin:0;flex:1">🏢 公司</span>
      <button class="btn btn-outline btn-sm" id="co-add">＋ 新建公司</button>
    </div>
    <div class="co-subtabs" id="co-subtabs">
      <button class="active" data-sub="profile">公司画像</button>
      <button data-sub="hot">公司热榜</button>
      <button data-sub="eco">职场生态</button>
    </div>
    <div id="co-body"></div>
  `
  v.querySelector('#co-add').addEventListener('click', () => showCompanyForm(null, () => renderCOSub('profile')))
  v.querySelectorAll('#co-subtabs button').forEach((b) => b.addEventListener('click', () => {
    v.querySelectorAll('#co-subtabs button').forEach((x) => x.classList.toggle('active', x === b))
    renderCOSub(b.dataset.sub)
  }))
  renderCOSub('profile')
}

async function renderCOSub(sub) {
  const box = document.getElementById('co-body')
  box.innerHTML = skeletonBox(3)
  try {
    if (sub === 'profile') return renderCompanyProfile(box)
    if (sub === 'hot') return renderCompanyHot(box)
    if (sub === 'eco') return renderCompanyEco(box)
  } catch (e) { box.innerHTML = '<div class="empty">加载失败</div>' }
}

async function renderCompanyProfile(box) {
  await fetchCompanies()
  const list = App.state.companies || []
  if (!list.length) {
    box.innerHTML = `<div class="empty"><div class="empty-icon">🏢</div>还没有公司档案<br>点击右上角新建，开始记录你的公司职场生态</div>`
    return
  }
  // 计算每家公司的"画像分数"：基于吐槽+情绪打卡
  const complaintsResp = await fetchMineComplaints().catch(() => ({ complaints: [] }))
  const myComplaints = complaintsResp.complaints || []
  box.innerHTML = list.map((c) => {
    // 仅简单 mock：基于行业 / 加班文化 / 福利 估算
    const otScore = ({ '996': 90, '大小周': 80, '加班严重': 75, '弹性': 40, '不加班': 20 }[c.overtimeCulture] ?? 60)
    const salaryScore = ({ '高': 80, '中': 60, '一般': 40 }[c.welfare] ?? 50)
    const eco = ['高强度', '高内耗', '中等', '宽松', '未知'][Math.floor(Math.random() * 5)]  // 占位
    return `
      <div class="card company-card" data-cid="${c.id}">
        <div class="row">
          <div class="company-avatar">🏢</div>
          <div style="flex:1;min-width:0">
            <div class="company-name">${esc(c.name)} <span class="card-sub">${esc(c.industry || '')}</span></div>
            <div class="card-sub">规模 ${esc(c.scale || '—')} · 加班 ${esc(c.overtimeCulture || '—')} · 福利 ${esc(c.welfare || '—')}</div>
            <div class="eco-row">
              <div class="eco-pill">🔥 加班指数 ${otScore}</div>
              <div class="eco-pill">💰 薪资 ${salaryScore}</div>
              <div class="eco-pill">📍 ${esc(c.location || '未填')}</div>
            </div>
          </div>
          <button class="pet-edit-btn" data-del="${c.id}" title="删除">🗑</button>
        </div>
      </div>
    `
  }).join('')
  box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (!confirm('删除这家公司？')) return
    try { await deleteCompany(b.dataset.del); toast('已删除'); await fetchCompanies(); renderCompanyProfile(box) } catch (err) { toast('删除失败：' + err.message) }
  }))
  box.querySelectorAll('.company-card').forEach((card) => card.addEventListener('click', (e) => {
    if (e.target.closest('[data-del]')) return
    const c = list.find((x) => x.id === card.dataset.cid)
    if (c) showCompanyForm(c)
  }))
}

async function renderCompanyHot(box) {
  // 公司热榜：按公司维度的吐槽热度。首版直接复用全局热搜榜 + 提示数据来自全用户
  try {
    const data = await fetchTopics()
    const topics = data.topics || []
    box.innerHTML = `
      <div class="card-sub" style="margin-bottom:8px">💡 全站今日吐槽热搜</div>
      <div class="topic-list">${topics.map((t, i) => `
        <div class="topic-item" data-cid="${t.id}">
          <div class="topic-rank" style="background:${i < 3 ? '#7c4dff' : '#a8a4b8'}">${i + 1}</div>
          <div class="topic-body">
            <div class="topic-text">${esc(t.snippet)}</div>
            <div class="topic-meta">${t.resonanceCount} 人共鸣 · ${t.likeCount} 赞</div>
          </div>
          <div class="topic-hot">🔥 ${t.hotScore.toFixed(0)}</div>
        </div>`).join('') || '<div class="empty">暂无</div>'}
      </div>
      <div class="card-sub" style="margin-top:12px;font-size:11px">⚠️ 数据来自全用户脱敏聚合，未公开点名任何真实个人与公司</div>
    `
    box.querySelectorAll('.topic-item').forEach((el) => el.addEventListener('click', () => openComplaintDetail(el.dataset.cid)))
  } catch (e) { box.innerHTML = '<div class="empty">加载失败</div>' }
}

async function renderCompanyEco(box) {
  await renderCompanyProfile(box)
}

/* ---------- 情绪打卡（编辑弹窗） ---------- */
async function renderMoodCheckin() {
  await ensureDict()
  const d = getDict()
  let initial = { mood: currentMoodId(), stressSources: [], note: '' }
  try { const r = await fetchMoodToday(); if (r.checked) initial = { mood: r.mood, stressSources: r.stressSources, note: r.note } } catch (e) {}
  const sources = new Set(initial.stressSources)
  openModal(`
    <div class="modal-title">${!App.state.moodToday?.checked && !initial.note ? '⏰ 今天上班感觉怎么样？' : '✏️ 编辑今日情绪'}</div>
    <div class="form-field">
      <label>情绪</label>
      <div class="mood-grid" id="mc-mood">${MOODS.map((m) => moodChoiceHtml(m)).join('')}</div>
    </div>
    <div class="form-field">
      <label>今天发生了什么？（可多选）</label>
      <div class="pet-chips" id="mc-sources">${d.stressSources.map((s) => `<button type="button" class="pet-chip" data-id="${s.id}">${esc(s.label)}</button>`).join('')}</div>
    </div>
    <div class="form-field">
      <label>备注（选填）</label>
      <textarea id="mc-note" rows="3" maxlength="500" placeholder="想多说两句…">${esc(initial.note)}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-close>取消</button>
      <button class="btn btn-primary" id="mc-submit">${initial.note ? '更新' : '打卡'}</button>
    </div>
  `, (box) => {
    let chosenMood = null
    box.querySelectorAll('#mc-mood .mood-choice').forEach((c) => c.addEventListener('click', () => {
      chosenMood = c.dataset.mood
      box.querySelectorAll('#mc-mood .mood-choice').forEach((x) => x.classList.toggle('active', x === c))
    }))
    box.querySelectorAll('#mc-sources .pet-chip').forEach((c) => c.addEventListener('click', () => {
      c.classList.toggle('active')
      if (c.classList.contains('active')) sources.add(c.dataset.id); else sources.delete(c.dataset.id)
    }))
    // 初始化默认选中
    box.querySelectorAll('#mc-mood .mood-choice').forEach((c) => {
      if (c.dataset.mood === normalizeMood(initial.mood)) { c.classList.add('active'); chosenMood = c.dataset.mood }
    })
    initial.stressSources.forEach((id) => {
      const c = box.querySelector(`#mc-sources .pet-chip[data-id="${id}"]`)
      if (c) c.classList.add('active')
    })
    box.querySelector('#mc-submit').addEventListener('click', async () => {
      if (!chosenMood) return toast('请选择今日情绪')
      try {
        await checkinMood({ mood: chosenMood, stressSources: [...sources], note: box.querySelector('#mc-note').value.trim() })
        toast('✅ 已保存')
        closeModal()
        if (App.state.views.current === 'home') loadHome()
        else if (App.state.views.current === 'ai') renderAISub('trends')
      } catch (err) { toast('保存失败：' + err.message) }
    })
  })
}
