import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { SQLITE_DDL } from '../src/schema.js'
import { buildHomeOverview, greetingPeriodAt } from '../src/services/home-overview.js'

const now = new Date(2026, 7, 27, 14, 30, 0)
const today = '2026-08-27'

function createDb() {
  const database = new DatabaseSync(':memory:')
  database.exec(SQLITE_DDL)
  return {
    run(sql, params = []) {
      const result = database.prepare(sql).run(...params)
      return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.changes }
    },
    get(sql, params = []) {
      return database.prepare(sql).get(...params) ?? null
    },
    all(sql, params = []) {
      return database.prepare(sql).all(...params)
    },
    close() {
      database.close()
    }
  }
}

function insertUser(db, {
  id,
  username,
  nickname,
  outfit = null
}) {
  db.run(`
    INSERT INTO users (id, username, password_hash, nickname, little_energy_outfit, created_at)
    VALUES (?, ?, 'hash', ?, ?, ?)
  `, [id, username, nickname, outfit, now.toISOString()])
}

function assertOverviewKeys(overview) {
  assert.deepEqual(Object.keys(overview).sort(), [
    'colleagueSummary',
    'greetingPeriod',
    'latestComplaints',
    'moodToday',
    'personality',
    'quickMoods',
    'serverTime',
    'stats',
    'user'
  ])
  assert.deepEqual(Object.keys(overview.stats).sort(), [
    'colleagueCount',
    'moodCheckedToday',
    'myComplaintCount',
    'plazaComplaintCount',
    'unreadMessageCount'
  ])
}

// This test catches a service that omits required empty-state keys or returns a raw/null outfit.
{
  const db = createDb()
  try {
    insertUser(db, { id: 1, username: 'empty', nickname: '空用户' })

    const overview = buildHomeOverview(db, 1, now)

    assertOverviewKeys(overview)
    assert.equal(overview.serverTime, now.toISOString())
    assert.equal(overview.greetingPeriod, 'afternoon')
    assert.deepEqual(overview.user, {
      id: '1',
      userName: '空用户',
      littleEnergyOutfit: {
        topId: 'top_tshirt',
        bottomId: 'bottom_slacks',
        shoesId: 'shoes_sneakers',
        accessoryIds: []
      }
    })
    assert.deepEqual(overview.stats, {
      moodCheckedToday: false,
      plazaComplaintCount: 0,
      myComplaintCount: 0,
      colleagueCount: 0,
      unreadMessageCount: 0
    })
    assert.equal(overview.moodToday, null)
    assert.equal(overview.latestComplaints.length, 0)
    assert.equal(overview.personality, null)
    assert.deepEqual(overview.colleagueSummary, {
      count: 0,
      averageScore: null,
      healthScore: null
    })
  } finally {
    db.close()
  }
}

// This test catches aggregate regressions in normalization, user-scoped counts, and summary modules.
{
  const db = createDb()
  try {
    insertUser(db, {
      id: 1,
      username: 'aqing',
      nickname: '阿青',
      outfit: JSON.stringify({
        topId: 'top_hoodie',
        bottomId: 'bottom_jeans',
        shoesId: 'shoes_canvas',
        accessoryIds: ['accessory_headphones']
      })
    })
    insertUser(db, { id: 2, username: 'anonymous', nickname: '匿名作者' })
    db.run(`
      INSERT INTO mood_checkins (user_id, mood, stress_sources, note, checkin_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [1, '😮‍💨', JSON.stringify(['meeting']), '会议太长', today, now.toISOString()])
    db.run(`
      INSERT INTO complaints (id, user_id, content, sentiment, is_anonymous, hot_score, created_at)
      VALUES (1, 1, '我的最新吐槽', 'xnz_angry', 0, 9, '2026-08-27T12:00:00.000Z')
    `)
    db.run(`
      INSERT INTO complaints (id, user_id, content, sentiment, is_anonymous, hot_score, created_at)
      VALUES (2, 2, '匿名最新吐槽', '😄', 1, 12, '2026-08-27T13:00:00.000Z')
    `)
    db.run("INSERT INTO complaint_likes (complaint_id, user_id, created_at) VALUES (2, 1, '2026-08-27T13:01:00.000Z')")
    db.run("INSERT INTO complaint_resonances (complaint_id, user_id, created_at) VALUES (2, 1, '2026-08-27T13:02:00.000Z')")
    db.run("INSERT INTO complaint_comments (complaint_id, user_id, content, created_at) VALUES (2, 1, '收到', '2026-08-27T13:03:00.000Z')")
    db.run(`
      INSERT INTO conversations (id, user_a, user_b, last_message_text, last_time, unread_a, unread_b)
      VALUES (1, 1, 2, '未读消息', '2026-08-27T13:04:00.000Z', 3, 0)
    `)
    db.run(`
      INSERT INTO conversations (id, user_a, user_b, last_message_text, last_time, unread_a, unread_b)
      VALUES (2, 2, 1, '另一条未读消息', '2026-08-27T13:05:00.000Z', 0, 2)
    `)
    db.run(`
      INSERT INTO colleagues (id, user_id, name, position, created_at)
      VALUES (1, 1, '小林', '工程师', ?)
    `, [now.toISOString()])
    db.run(`
      INSERT INTO colleague_radar_scores (colleague_id, scorer_id, cooperation, expertise, communication, support, trust, created_at)
      VALUES (1, 1, 80, 80, 80, 80, 80, ?)
    `, [now.toISOString()])
    db.run(`
      INSERT INTO personality_profiles (user_id, personality, total_complaints, total_resonances, updated_at)
      VALUES (1, '🐟 摸鱼哲学家', 1, 4, ?)
    `, [now.toISOString()])

    const overview = buildHomeOverview(db, 1, now)

    assertOverviewKeys(overview)
    assert.deepEqual(overview.stats, {
      moodCheckedToday: true,
      plazaComplaintCount: 2,
      myComplaintCount: 1,
      colleagueCount: 1,
      unreadMessageCount: 5
    })
    assert.deepEqual(overview.moodToday, {
      mood: 'xnz_tired',
      stressSources: ['meeting'],
      note: '会议太长',
      date: today
    })
    assert.deepEqual(overview.quickMoods, [
      { id: 'xnz_motivated', label: '元气', assetName: 'xnz_motivated' },
      { id: 'xnz_composed', label: '还行', assetName: 'xnz_composed' },
      { id: 'xnz_calm', label: '一般', assetName: 'xnz_calm' },
      { id: 'xnz_tired', label: '好累', assetName: 'xnz_tired' },
      { id: 'xnz_angry', label: '想辞职', assetName: 'xnz_angry' }
    ])
    assert.deepEqual(overview.latestComplaints, [
      {
        id: '2',
        userId: null,
        authorName: '匿名用户',
        avatarSymbol: '🎭',
        littleEnergyOutfit: null,
        isAnonymous: true,
        content: '匿名最新吐槽',
        sentiment: 'xnz_happy',
        likeCount: 1,
        resonanceCount: 1,
        commentCount: 1,
        time: '2026-08-27T13:00:00.000Z'
      },
      {
        id: '1',
        userId: '1',
        authorName: '阿青',
        avatarSymbol: 'person.fill',
        littleEnergyOutfit: {
          topId: 'top_hoodie',
          bottomId: 'bottom_jeans',
          shoesId: 'shoes_canvas',
          accessoryIds: ['accessory_headphones']
        },
        isAnonymous: false,
        content: '我的最新吐槽',
        sentiment: 'xnz_angry',
        likeCount: 0,
        resonanceCount: 0,
        commentCount: 0,
        time: '2026-08-27T12:00:00.000Z'
      }
    ])
    assert.deepEqual(overview.personality, {
      name: '摸鱼哲学家',
      totalComplaints: 1,
      summary: '完整报告在 AI 洞察中查看'
    })
    assert.deepEqual(overview.colleagueSummary, {
      count: 1,
      averageScore: 4,
      healthScore: 80
    })
  } finally {
    db.close()
  }
}

assert.equal(greetingPeriodAt(new Date(2026, 7, 27, 11, 59)), 'morning')
assert.equal(greetingPeriodAt(new Date(2026, 7, 27, 12, 0)), 'afternoon')
assert.equal(greetingPeriodAt(new Date(2026, 7, 27, 18, 0)), 'evening')

console.log('Home overview service contract passed.')
