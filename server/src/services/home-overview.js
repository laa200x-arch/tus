import { MOODS, normalizeMood, normalizeOutfit } from '../little-energy.js'

const QUICK_MOODS = [
  ['xnz_motivated', '元气'],
  ['xnz_composed', '还行'],
  ['xnz_calm', '一般'],
  ['xnz_tired', '好累'],
  ['xnz_angry', '想辞职']
]

function localDayAt(now) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function parseOutfit(value) {
  if (!value) return null
  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return null
  }
}

function parseArray(value) {
  if (!value) return []
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function optionalModule(name, fallback, load) {
  try {
    return load()
  } catch (error) {
    console.error(`[home-overview] ${name} unavailable`, error)
    return fallback
  }
}

function quickMoods() {
  return QUICK_MOODS.map(([id, label]) => {
    const mood = MOODS.find((candidate) => candidate.id === id)
    return { id, label, assetName: mood?.assetName || id }
  })
}

function displayPersonalityName(value) {
  return String(value || '').replace(/^[^\p{L}\p{N}]+/u, '').trim()
}

export function greetingPeriodAt(now) {
  const hour = now.getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

export function buildHomeOverview(db, userId, now = new Date()) {
  const user = db.get('SELECT id, nickname, little_energy_outfit FROM users WHERE id = ?', [userId])
  if (!user) throw new Error('Authenticated user was not found')

  const day = localDayAt(now)
  const moodRow = db.get(
    'SELECT mood, stress_sources, note, checkin_date FROM mood_checkins WHERE user_id = ? AND checkin_date = ?',
    [userId, day]
  )
  const complaintCounts = db.get(`
    SELECT
      (SELECT COUNT(*) FROM complaints) AS plaza_count,
      (SELECT COUNT(*) FROM complaints WHERE user_id = ?) AS my_count
  `, [userId])
  const colleagueCount = Number(db.get('SELECT COUNT(*) AS count FROM colleagues WHERE user_id = ?', [userId])?.count || 0)
  const unreadMessageCount = Number(db.get(`
    SELECT COALESCE(SUM(CASE WHEN user_a = ? THEN unread_a ELSE unread_b END), 0) AS count
    FROM conversations
    WHERE user_a = ? OR user_b = ?
  `, [userId, userId, userId])?.count || 0)

  const latestComplaints = optionalModule('latest complaints', [], () => db.all(`
    SELECT
      c.id,
      c.user_id,
      c.content,
      c.sentiment,
      c.is_anonymous,
      c.created_at,
      u.nickname AS author_name,
      u.avatar_symbol AS author_avatar,
      u.little_energy_outfit AS author_outfit,
      (SELECT COUNT(*) FROM complaint_likes WHERE complaint_id = c.id) AS like_count,
      (SELECT COUNT(*) FROM complaint_resonances WHERE complaint_id = c.id) AS resonance_count,
      (SELECT COUNT(*) FROM complaint_comments WHERE complaint_id = c.id) AS comment_count
    FROM complaints c
    JOIN users u ON u.id = c.user_id
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT 3
  `).map((row) => ({
    id: String(row.id),
    userId: row.is_anonymous ? null : String(row.user_id),
    authorName: row.is_anonymous ? '匿名用户' : row.author_name,
    avatarSymbol: row.is_anonymous ? '🎭' : (row.author_avatar || '👤'),
    littleEnergyOutfit: row.is_anonymous ? null : normalizeOutfit(parseOutfit(row.author_outfit)),
    isAnonymous: !!row.is_anonymous,
    content: row.content,
    sentiment: row.sentiment ? normalizeMood(row.sentiment) : null,
    likeCount: Number(row.like_count || 0),
    resonanceCount: Number(row.resonance_count || 0),
    commentCount: Number(row.comment_count || 0),
    time: row.created_at
  })))

  const personality = optionalModule('personality', null, () => {
    const profile = db.get(
      'SELECT personality, total_complaints FROM personality_profiles WHERE user_id = ?',
      [userId]
    )
    if (!profile) return null
    return {
      name: displayPersonalityName(profile.personality),
      totalComplaints: Number(profile.total_complaints || 0),
      summary: '完整报告在 AI 洞察中查看'
    }
  })

  const colleagueSummary = optionalModule('colleague summary', {
    count: colleagueCount,
    averageScore: null,
    healthScore: null
  }, () => {
    const radar = db.get(`
      SELECT AVG((cooperation + expertise + communication + support + trust) / 5.0) AS health_score
      FROM colleague_radar_scores
      WHERE scorer_id = ?
    `, [userId])
    const healthScore = radar?.health_score == null ? null : Math.round(Number(radar.health_score))
    return {
      count: colleagueCount,
      averageScore: healthScore == null ? null : Math.round((healthScore / 20) * 10) / 10,
      healthScore
    }
  })

  return {
    serverTime: now.toISOString(),
    greetingPeriod: greetingPeriodAt(now),
    user: {
      id: String(user.id),
      userName: user.nickname,
      littleEnergyOutfit: normalizeOutfit(parseOutfit(user.little_energy_outfit))
    },
    stats: {
      moodCheckedToday: !!moodRow,
      plazaComplaintCount: Number(complaintCounts?.plaza_count || 0),
      myComplaintCount: Number(complaintCounts?.my_count || 0),
      colleagueCount,
      unreadMessageCount
    },
    moodToday: moodRow ? {
      mood: normalizeMood(moodRow.mood),
      stressSources: parseArray(moodRow.stress_sources),
      note: moodRow.note || '',
      date: moodRow.checkin_date
    } : null,
    quickMoods: quickMoods(),
    latestComplaints,
    personality,
    colleagueSummary
  }
}
