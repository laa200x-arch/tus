/**
 * 标签与字典路由（公开，无登录要求）
 * - GET /api/tags   返回所有字典（同事类型 / 行为标签 / 情绪 / 压力源 / 人格模板）
 */
import { Router } from 'express'
import {
  COLLEAGUE_TYPES,
  BEHAVIOR_TAGS,
  MOODS,
  STRESS_SOURCES,
  PERSONALITY_TEMPLATES
} from './tags-dict.js'

export function tagsRouter() {
  const router = Router()
  router.get('/tags', (req, res) => {
    res.json({
      colleagueTypes: COLLEAGUE_TYPES,
      behaviorTags: BEHAVIOR_TAGS,
      moods: MOODS,
      stressSources: STRESS_SOURCES,
      personalityTemplates: PERSONALITY_TEMPLATES
    })
  })
  return router
}
