/**
 * 数据库结构（职场那些事：同事属性 / 公司属性 / 主题 / 软件 四维模型）
 * 用户数据 / 同事档案 / 公司档案 / 同事状态（吐槽动态）/ 聊天 / 小程序
 * 提供 sqlite 与 mysql 两套 DDL，逻辑表结构一致。
 */

export const SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar_symbol TEXT NOT NULL DEFAULT 'person.fill',
  avatar_url TEXT,
  little_energy_outfit TEXT,
  phone TEXT,
  bio TEXT NOT NULL DEFAULT '',
  location_label TEXT NOT NULL DEFAULT '',
  distance_km REAL,
  credit_score REAL NOT NULL DEFAULT 80,
  verification TEXT NOT NULL DEFAULT 'none',
  is_exposure_vip INTEGER NOT NULL DEFAULT 0,
  exposure_until TEXT,
  violation_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS phone_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'register',
  used INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  scale TEXT NOT NULL DEFAULT '',
  overtime_culture TEXT NOT NULL DEFAULT '',
  welfare TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS colleagues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  relation TEXT NOT NULL DEFAULT '',
  attribute_tags TEXT,
  company_id INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  avatar_symbol TEXT NOT NULL DEFAULT '👤',
  age INTEGER,
  weight REAL,
  personality_score REAL,
  workplace_type TEXT,
  risk_level TEXT,
  avatar_url TEXT,
  quote TEXT,
  created_at TEXT NOT NULL
);

-- 同事品行六维人格（用户对同事打分：情商/责任心/控制欲/执行力/表演欲/脾气）
CREATE TABLE IF NOT EXISTS colleague_persona_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colleague_id INTEGER NOT NULL,
  scorer_id INTEGER NOT NULL,
  eq REAL NOT NULL DEFAULT 50,
  responsibility REAL NOT NULL DEFAULT 50,
  control REAL NOT NULL DEFAULT 50,
  execution REAL NOT NULL DEFAULT 50,
  showmanship REAL NOT NULL DEFAULT 50,
  temper REAL NOT NULL DEFAULT 50,
  created_at TEXT NOT NULL,
  UNIQUE (colleague_id, scorer_id)
);

CREATE TABLE IF NOT EXISTS colleague_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  colleague_id INTEGER,
  content TEXT NOT NULL,
  theme_tags TEXT,
  software_tags TEXT,
  mood TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a INTEGER NOT NULL,
  user_b INTEGER NOT NULL,
  last_message_text TEXT NOT NULL DEFAULT '',
  last_time TEXT NOT NULL,
  unread_a INTEGER NOT NULL DEFAULT 0,
  unread_b INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  media_type TEXT,
  media_url TEXT,
  order_id TEXT,
  is_system_note INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '🎮',
  html_content TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  size_kb INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  user_id INTEGER,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- ====================================================================
-- 职场关系操作系统 v2：吐槽广场 + 情绪打卡 + 关系雷达 + 职场人格
-- ====================================================================

-- 吐槽（含分类标签、行为标签、情绪、AI 标签、热度）
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  colleague_id INTEGER,
  category TEXT,                -- 同事类型（16 选 1：摸鱼型/大嘴巴型/...）
  behavior_tags TEXT,           -- 行为标签 JSON 数组（抢功劳/甩锅/...）
  sentiment TEXT,               -- 情绪 😄/🙂/😐/😮‍💨/😡/💀
  is_anonymous INTEGER NOT NULL DEFAULT 0,   -- 0 公开 / 1 匿名
  ai_extracted TEXT,            -- AI 自动识别的标签/关键词 JSON
  hot_score REAL NOT NULL DEFAULT 0,         -- 热度 = 共鸣数*3 + 点赞 + 时间衰减
  created_at TEXT NOT NULL
);

-- 点赞（一用户对一吐槽只能点赞一次）
CREATE TABLE IF NOT EXISTS complaint_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (complaint_id, user_id)
);

-- 共鸣（同上，唯一）
CREATE TABLE IF NOT EXISTS complaint_resonances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (complaint_id, user_id)
);

-- 吐槽评论（设计稿卡片：评论数 + 评论列表）
CREATE TABLE IF NOT EXISTS complaint_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 每日情绪打卡（一用户一天一次）
CREATE TABLE IF NOT EXISTS mood_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mood TEXT NOT NULL,           -- 😄 元气 / 🙂 还行 / 😐 一般 / 😮‍💨 好累 / 😡 想辞职 / 💀 不想活了
  stress_sources TEXT,          -- 压力源 JSON 数组（领导/同事/客户/加班/会议/工资/摸鱼/临时需求/职场PUA/其他）
  note TEXT NOT NULL DEFAULT '',-- 备注 ≤500 字
  checkin_date TEXT NOT NULL,   -- YYYY-MM-DD
  created_at TEXT NOT NULL,
  UNIQUE (user_id, checkin_date)
);

-- 同事关系雷达打分（5 维度，用户对同事）
CREATE TABLE IF NOT EXISTS colleague_radar_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colleague_id INTEGER NOT NULL,
  scorer_id INTEGER NOT NULL,
  cooperation REAL NOT NULL,    -- 合作 0-100
  expertise REAL NOT NULL,      -- 专业 0-100
  communication REAL NOT NULL, -- 沟通 0-100
  support REAL NOT NULL,       -- 支持 0-100
  trust REAL NOT NULL,          -- 信任 0-100
  created_at TEXT NOT NULL,
  UNIQUE (colleague_id, scorer_id)
);

-- 职场人格（每个用户一条）
CREATE TABLE IF NOT EXISTS personality_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  personality TEXT NOT NULL,    -- 🐱理智型 / 🐟摸鱼哲学家 / 🐺独狼型 / 🧨高压易燃型 / 🧑‍💻技术孤岛
  total_complaints INTEGER NOT NULL DEFAULT 0,
  total_resonances INTEGER NOT NULL DEFAULT 0,
  top_target TEXT,              -- 最常吐槽对象
  top_theme TEXT,               -- 最常出现主题
  weakest_point TEXT,           -- 最容易生气点
  emotion_index INTEGER NOT NULL DEFAULT 50,          -- 情绪指数 0-100
  relationship_sensitivity INTEGER NOT NULL DEFAULT 50,-- 关系敏感度 0-100
  slack_score INTEGER NOT NULL DEFAULT 50,             -- 摸鱼能力 0-100
  updated_at TEXT NOT NULL
);
`

export const MYSQL_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(64) NOT NULL,
  avatar_symbol VARCHAR(64) NOT NULL DEFAULT 'person.fill',
  avatar_url VARCHAR(255) NULL,
  little_energy_outfit TEXT NULL,
  phone VARCHAR(20) NULL,
  bio VARCHAR(500) NOT NULL DEFAULT '',
  location_label VARCHAR(128) NOT NULL DEFAULT '',
  distance_km DOUBLE NULL,
  credit_score DOUBLE NOT NULL DEFAULT 80,
  verification VARCHAR(16) NOT NULL DEFAULT 'none',
  is_exposure_vip TINYINT(1) NOT NULL DEFAULT 0,
  exposure_until DATETIME NULL,
  violation_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS phone_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(8) NOT NULL,
  purpose VARCHAR(16) NOT NULL DEFAULT 'register',
  used TINYINT(1) NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(64) NOT NULL,
  industry VARCHAR(64) NOT NULL DEFAULT '',
  scale VARCHAR(64) NOT NULL DEFAULT '',
  overtime_culture VARCHAR(64) NOT NULL DEFAULT '',
  welfare VARCHAR(64) NOT NULL DEFAULT '',
  location VARCHAR(128) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS colleagues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(64) NOT NULL,
  position VARCHAR(64) NOT NULL DEFAULT '',
  department VARCHAR(64) NOT NULL DEFAULT '',
  relation VARCHAR(16) NOT NULL DEFAULT '',
  attribute_tags TEXT NULL,
  company_id INT NULL,
  notes VARCHAR(2000) NOT NULL DEFAULT '',
  avatar_symbol VARCHAR(16) NOT NULL DEFAULT '👤',
  age INT NULL,
  weight DOUBLE NULL,
  personality_score DOUBLE NULL,
  workplace_type VARCHAR(32) NULL,
  risk_level VARCHAR(16) NULL,
  avatar_url VARCHAR(255) NULL,
  quote VARCHAR(500) NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS colleague_persona_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colleague_id INT NOT NULL,
  scorer_id INT NOT NULL,
  eq DOUBLE NOT NULL DEFAULT 50,
  responsibility DOUBLE NOT NULL DEFAULT 50,
  control DOUBLE NOT NULL DEFAULT 50,
  execution DOUBLE NOT NULL DEFAULT 50,
  showmanship DOUBLE NOT NULL DEFAULT 50,
  temper DOUBLE NOT NULL DEFAULT 50,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_persona (colleague_id, scorer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS colleague_statuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  colleague_id INT NULL,
  content TEXT NOT NULL,
  theme_tags TEXT NULL,
  software_tags TEXT NULL,
  mood VARCHAR(64) NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_a INT NOT NULL,
  user_b INT NOT NULL,
  last_message_text VARCHAR(500) NOT NULL DEFAULT '',
  last_time DATETIME NOT NULL,
  unread_a INT NOT NULL DEFAULT 0,
  unread_b INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_pair (user_a, user_b)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  text VARCHAR(1000) NOT NULL,
  media_type VARCHAR(16) NULL,
  media_url VARCHAR(255) NULL,
  order_id VARCHAR(32) NULL,
  is_system_note TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS apps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(64) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  icon VARCHAR(16) NOT NULL DEFAULT '🎮',
  html_content LONGTEXT NOT NULL,
  version VARCHAR(16) NOT NULL DEFAULT '1.0.0',
  size_kb INT NOT NULL DEFAULT 0,
  downloads INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app_id INT NOT NULL,
  user_id INT NULL,
  player_name VARCHAR(32) NOT NULL,
  score INT NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_app_score (app_id, score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ====================================================================
-- 职场关系操作系统 v2：吐槽广场 + 情绪打卡 + 关系雷达 + 职场人格
-- ====================================================================

CREATE TABLE IF NOT EXISTS complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  colleague_id INT NULL,
  category VARCHAR(32) NULL,
  behavior_tags TEXT NULL,
  sentiment VARCHAR(16) NULL,
  is_anonymous TINYINT(1) NOT NULL DEFAULT 0,
  ai_extracted TEXT NULL,
  hot_score DOUBLE NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  KEY idx_complaints_hot (hot_score, id),
  KEY idx_complaints_user_time (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS complaint_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_complaint_like (complaint_id, user_id),
  KEY idx_like_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS complaint_resonances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_complaint_resonance (complaint_id, user_id),
  KEY idx_resonance_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS complaint_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  user_id INT NOT NULL,
  content VARCHAR(300) NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_comment_complaint (complaint_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mood_checkins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  mood VARCHAR(16) NOT NULL,
  stress_sources TEXT NULL,
  note VARCHAR(500) NOT NULL DEFAULT '',
  checkin_date DATE NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_user_date (user_id, checkin_date),
  KEY idx_mood_user_date (user_id, checkin_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS colleague_radar_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colleague_id INT NOT NULL,
  scorer_id INT NOT NULL,
  cooperation DOUBLE NOT NULL,
  expertise DOUBLE NOT NULL,
  communication DOUBLE NOT NULL,
  support DOUBLE NOT NULL,
  trust DOUBLE NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_colleague_scorer (colleague_id, scorer_id),
  KEY idx_radar_colleague (colleague_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS personality_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  personality VARCHAR(32) NOT NULL,
  total_complaints INT NOT NULL DEFAULT 0,
  total_resonances INT NOT NULL DEFAULT 0,
  top_target VARCHAR(64) NULL,
  top_theme VARCHAR(64) NULL,
  weakest_point VARCHAR(64) NULL,
  emotion_index INT NOT NULL DEFAULT 50,
  relationship_sensitivity INT NOT NULL DEFAULT 50,
  slack_score INT NOT NULL DEFAULT 50,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`
