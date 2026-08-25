/**
 * 标签与字典常量（系统静态，不落数据库）
 * 同事类型 16 种 / 行为标签 14 种 / 小能仔情绪 27 种 / 压力源 10 种 / 人格模板 5 种
 * AI 关键词词典用于 /api/ai/extract-tags 自动识别
 */
import { MOODS as LITTLE_ENERGY_MOODS } from '../little-energy.js'

export const COLLEAGUE_TYPES = [
  { id: 'fish',         label: '摸鱼型',       emoji: '🐟' },
  { id: 'loudmouth',    label: '大嘴巴型',     emoji: '📢' },
  { id: 'invisible',    label: '隐身型',       emoji: '🥷' },
  { id: 'shark',        label: '竞争型',       emoji: '🦈' },
  { id: 'niceguy',      label: '老好人型',     emoji: '🤝' },
  { id: 'leader',       label: '领导型',       emoji: '👑' },
  { id: 'bomb',         label: '情绪炸弹型',   emoji: '🧨' },
  { id: 'techstar',     label: '技术大佬型',   emoji: '🧠' },
  { id: 'snake',        label: '表面友好型',   emoji: '🐍' },
  { id: 'flat',         label: '躺平型',       emoji: '🧱' },
  { id: 'rollking',     label: '卷王型',       emoji: '🚀' },
  { id: 'twoface',      label: '两面派',       emoji: '🎭' },
  { id: 'blamer',       label: '甩锅型',       emoji: '🧹' },
  { id: 'ghost',        label: '临时消失型',   emoji: '🏃' },
  { id: 'phoneaddict',  label: '随时打电话型', emoji: '📞' },
  { id: 'nightowl',     label: '深夜消息型',   emoji: '🌙' }
]

export const BEHAVIOR_TAGS = [
  { id: 'credit',       label: '抢功劳' },
  { id: 'shift_blame',  label: '甩锅' },
  { id: 'sudden_req',   label: '临时加需求' },
  { id: 'read_noreply', label: '已读不回' },
  { id: 'meeting_bs',   label: '会议废话' },
  { id: 'spamm_at',     label: '疯狂@人' },
  { id: 'bigcake',      label: '喜欢画大饼' },
  { id: 'push_work',    label: '工作推给别人' },
  { id: 'faceup',       label: '领导面前一个样' },
  { id: 'faceprivate',  label: '私下一个样' },
  { id: 'pua',          label: '喜欢PUA' },
  { id: 'spam_msg',     label: '消息轰炸' },
  { id: 'aftershift',   label: '下班找人' },
  { id: 'weekend_job',  label: '周末安排工作' }
]

export const MOODS = LITTLE_ENERGY_MOODS

export const STRESS_SOURCES = [
  { id: 'boss',      label: '领导' },
  { id: 'coworker',  label: '同事' },
  { id: 'client',    label: '客户' },
  { id: 'overtime',  label: '加班' },
  { id: 'meeting',   label: '会议' },
  { id: 'salary',    label: '工资' },
  { id: 'slack',     label: '摸鱼' },
  { id: 'sudden',    label: '临时需求' },
  { id: 'pua',       label: '职场PUA' },
  { id: 'other',     label: '其他' }
]

export const PERSONALITY_TEMPLATES = [
  { id: 'rational',    emoji: '🐱', label: '理智型打工人',  desc: '冷静观察职场，能用咖啡解决的问题绝不内耗' },
  { id: 'philosopher', emoji: '🐟', label: '摸鱼哲学家',     desc: '深谙摸鱼之道，工作只是生活的间歇' },
  { id: 'loner',       emoji: '🐺', label: '独狼型职场人',   desc: '专注交付，少说多做，沟通成本=0' },
  { id: 'volatile',    emoji: '🧨', label: '高压易燃型',     desc: '情绪雷达全开，看不惯就炸，老板也敢怼' },
  { id: 'island',      emoji: '🧑‍💻', label: '技术孤岛',      desc: '沉浸在自己的代码宇宙，bug 是唯一的对手' }
]

// AI 关键词词典（首版无需真正 LLM，关键字命中即推荐）
export const KEYWORD_MAP = {
  colleagueTypes: {
    'fish':         ['摸鱼', '划水', '摆烂', '躺'],
    'loudmouth':    ['大嘴巴', '八卦', '到处说', '嘴碎'],
    'invisible':    ['隐身', '找不到', '消失', '不出声'],
    'shark':        ['抢', '竞争', '抢功', '抢客户'],
    'niceguy':      ['老好人', '不敢拒绝', '都答应', '和稀泥'],
    'leader':       ['领导', '老板', '上级', '主管', '经理'],
    'bomb':         ['突然发火', '情绪化', '暴怒', '砸桌子'],
    'techstar':     ['技术', '代码', '架构', 'debug', '专业'],
    'snake':        ['表面', '笑面虎', '背后', '阴'],
    'flat':         ['躺平', '摆烂', '不上进', '无欲无求'],
    'rollking':     ['卷', '加班狂', '拼命', '内卷'],
    'twoface':      ['两面', '对人一套', '当面一套'],
    'blamer':       ['甩锅', '推卸', '不是我的'],
    'ghost':        ['找不到人', '请假', '联系不上'],
    'phoneaddict':  ['随时打电话', '语音轰炸'],
    'nightowl':     ['深夜消息', '半夜', '凌晨', '周末发消息']
  },
  behaviorTags: {
    'credit':       ['抢功劳', '抢功', '把功劳'],
    'shift_blame':  ['甩锅', '推卸责任', '不是我的错'],
    'sudden_req':   ['临时加', '突然要', '临时改'],
    'read_noreply': ['已读不回', '不理', '不回消息'],
    'meeting_bs':   ['开会', '会议', '废话', '开一下午'],
    'spamm_at':     ['疯狂@', '@所有人', '@我'],
    'bigcake':      ['画饼', '承诺', '以后'],
    'push_work':    ['推给我', '推给别人', '转给我'],
    'faceup':       ['领导面前', '老板面前'],
    'faceprivate':  ['私下一个样', '背后'],
    'pua':          ['pua', 'PUA', '否定', '打击'],
    'spam_msg':     ['消息轰炸', '狂发', '不停发'],
    'aftershift':   ['下班找', '下班开会'],
    'weekend_job':  ['周末', '休息日工作']
  },
  sentiment: {
    'happy':   ['开心', '爽', '满足', '舒服', '心情好'],
    'ok':      ['还行', '一般般', '无所谓'],
    'meh':     ['无语', '无感', '麻了'],
    'tired':   ['累', '疲惫', '乏', '想躺', '好累'],
    'rage':    ['气', '愤怒', '想辞职', '受不了', '妈的'],
    'doom':    ['崩溃', '绝望', '不想活', '撑不住', '毁灭吧']
  }
}
