import Foundation

/// 吐槽同事 · 核心数据模型
/// 四维主题：同事属性 / 公司属性 / 主题 / 软件

/// 心情（吐槽状态的心情标签）
enum StatusMood: String, CaseIterable, Identifiable {
    case angry = "😤 气愤"
    case helpless = "😩 无奈"
    case speechless = "🙄 无语"
    case funny = "😂 好笑"
    case worried = "😟 担心"
    case calm = "😐 平淡"

    var id: String { rawValue }
    /// 仅表情符号（用于卡片角标）
    var emoji: String { String(rawValue.prefix(2)) }
}

/// 同事关系
enum ColleagueRelation: String, CaseIterable, Identifiable {
    case boss = "上级"
    case peer = "同事"
    case subordinate = "下属"
    case client = "客户"
    case partner = "合作方"

    var id: String { rawValue }
}

/// 四维 · 主题标签（吐槽的「主题」维度，多选）
enum StatusThemes {
    static let all = [
        "甩锅", "画饼", "加班", "PUA", "双标", "抢功",
        "形式主义", "内卷", "摸鱼", "甩锅大会", "开会成瘾",
        "无效加班", "情绪劳动", "职场霸凌", "升职无望", "离职念头"
    ]
}

/// 四维 · 软件标签（吐槽涉及的「软件/工具」维度，多选）
enum StatusSoftware {
    static let all = [
        "企业微信", "钉钉", "飞书", "微信", "腾讯会议",
        "Excel", "PPT", "Word", "OA 系统", "邮件",
        "钉钉日报", "周报", "OKR 系统", "审批流", "云文档"
    ]
}

/// 四维 · 同事属性标签（同事档案的「属性」维度，多选）
enum ColleagueAttrs {
    static let all = [
        "甩锅倾向", "画饼高手", "执行力强", "甩锅王", "推诿",
        "敬业", "内卷达人", "情绪稳定", "难沟通", "心机",
        "护犊子", "双标", "画大饼", "抢功", "靠谱", "八卦"
    ]
}

/// 同事关系标签（用于同事档案的「关系」维度）
enum ColleagueRelations {
    static let all = ColleagueRelation.allCases.map { $0.rawValue }
}

/// 同事状态（吐槽动态）：用户对某位同事的一条吐槽
struct StatusModel: Codable, Identifiable, Hashable {
    let id: UUID
    var userId: UUID?            // 作者（服务端用户 id）
    var authorName: String       // 作者昵称
    var avatarSymbol: String
    var colleagueId: UUID?       // 关联同事档案（可为空：纯吐槽）
    var colleagueName: String?   // 关联同事姓名（服务端解析返回）
    var content: String
    var themeTags: [String]
    var softwareTags: [String]
    var mood: String?            // StatusMood.rawValue
    var time: Date

    var isMine: Bool {
        // 演示模式全部视为本人；服务端通过 userId 判断
        userId == nil
    }

    init(
        id: UUID = UUID(),
        userId: UUID? = nil,
        authorName: String = "",
        avatarSymbol: String = "👤",
        colleagueId: UUID? = nil,
        colleagueName: String? = nil,
        content: String,
        themeTags: [String] = [],
        softwareTags: [String] = [],
        mood: String? = nil,
        time: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.authorName = authorName
        self.avatarSymbol = avatarSymbol
        self.colleagueId = colleagueId
        self.colleagueName = colleagueName
        self.content = content
        self.themeTags = themeTags
        self.softwareTags = softwareTags
        self.mood = mood
        self.time = time
    }
}

/// 同事档案（「同事属性」维度核心实体）
struct ColleagueModel: Codable, Identifiable, Hashable {
    let id: UUID
    var name: String
    var position: String         // 职位
    var department: String       // 部门
    var relation: String         // 关系（上级/同事/下属/客户/合作方）
    var attributeTags: [String]  // 属性标签（多选）
    var companyId: UUID?         // 关联公司
    var companyName: String?     // 关联公司名（本地维护，便于展示）
    var notes: String            // 备注
    var avatarSymbol: String
    var time: Date

    init(
        id: UUID = UUID(),
        name: String,
        position: String = "",
        department: String = "",
        relation: String = "",
        attributeTags: [String] = [],
        companyId: UUID? = nil,
        companyName: String? = nil,
        notes: String = "",
        avatarSymbol: String = "👤",
        time: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.position = position
        self.department = department
        self.relation = relation
        self.attributeTags = attributeTags
        self.companyId = companyId
        self.companyName = companyName
        self.notes = notes
        self.avatarSymbol = avatarSymbol
        self.time = time
    }
}

/// 公司属性（「公司属性」维度核心实体）
struct CompanyModel: Codable, Identifiable, Hashable {
    let id: UUID
    var name: String
    var industry: String         // 行业
    var scale: String            // 规模
    var overtimeCulture: String  // 加班文化
    var welfare: String          // 福利
    var location: String         // 地点

    init(
        id: UUID = UUID(),
        name: String,
        industry: String = "",
        scale: String = "",
        overtimeCulture: String = "",
        welfare: String = "",
        location: String = ""
    ) {
        self.id = id
        self.name = name
        self.industry = industry
        self.scale = scale
        self.overtimeCulture = overtimeCulture
        self.welfare = welfare
        self.location = location
    }
}

// MARK: - 职场关系操作系统 v2 模型

/// 字典标签（来自 /api/tags）
struct TagDict: Codable {
    let colleagueTypes: [TagItem]
    let behaviorTags: [TagItem]
    let moods: [MoodItem]
    let stressSources: [TagItem]
    let personalityTemplates: [PersonalityTemplate]
}

struct TagItem: Codable, Identifiable {
    let id: String
    let label: String
    let emoji: String?
}

struct MoodItem: Codable, Identifiable {
    let id: String
    let emoji: String
    let label: String
}

struct PersonalityTemplate: Codable, Identifiable {
    let id: String
    let label: String
    let emoji: String
    let desc: String
}

/// 吐槽广场 · 单条吐槽（计数与互动状态为 var，便于点赞/共鸣后本地更新）
struct ComplaintModel: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    let authorName: String
    let avatarSymbol: String
    let isAnonymous: Bool
    let content: String
    let colleagueId: String?
    let colleagueName: String?
    let category: String?
    let behaviorTags: [String]
    let sentiment: String?
    let aiExtracted: AIExtracted?
    var likeCount: Int
    var resonanceCount: Int
    var hotScore: Double
    var liked: Bool
    var resonated: Bool
    /// 设计稿 v2.1：评论数 + 共鸣值%（= 共鸣/(赞+共鸣)，无互动为 0；可选兼容旧响应）
    var commentCount: Int?
    var resonanceRate: Int?
    let time: Date
}

/// 吐槽评论（设计稿卡片"评论 N"）
struct ComplaintComment: Codable, Identifiable, Hashable {
    let id: String
    let complaintId: String
    let userId: String
    let authorName: String
    let avatarSymbol: String?
    let content: String
    let time: Date
}

/// 首页统计（设计稿 Dashboard 4 卡）
struct HomeStats: Codable, Hashable {
    let todayComplaints: Int
    let myResonances: Int
    let myLikes: Int
    let avgColleagueScore: Double?
    let colleagueCount: Int
    let healthScore: Int?
    let moodDays: Int
}

/// 全局搜索结果（吐槽 / 同事 / 公司）
struct SearchResults: Codable, Hashable {
    let query: String
    let complaints: [SearchComplaintHit]
    let colleagues: [SearchColleagueHit]
    let companies: [SearchCompanyHit]
}

struct SearchComplaintHit: Codable, Hashable {
    let id: String
    let content: String
    let snippet: String
    let isAnonymous: Bool
    let category: String?
    let sentiment: String?
    let time: Date
}

struct SearchColleagueHit: Codable, Hashable {
    let id: String
    let name: String
    let position: String?
    let department: String?
    let companyId: String?
}

struct SearchCompanyHit: Codable, Hashable {
    let id: String
    let name: String
    let industry: String?
    let scale: String?
}

// MARK: - v3 品行系统 + 聊天分析

/// 同事品行六维人格打分（0-100）
struct PersonaScores: Codable, Hashable {
    var eq: Double = 50
    var responsibility: Double = 50
    var control: Double = 50
    var execution: Double = 50
    var showmanship: Double = 50
    var temper: Double = 50
}

/// 品行预测（人格标签 + 行为预测）
struct PersonaPrediction: Codable, Hashable {
    let colleagueId: String
    let colleagueName: String
    let scores: PersonaScores
    let traits: [PersonaTrait]
    let predictions: [BehaviorPrediction]
    let riskLevel: String
    let disclaimer: String
}

struct PersonaTrait: Codable, Hashable {
    let key: String
    let label: String
    let desc: String
}

struct BehaviorPrediction: Codable, Hashable {
    let key: String
    let label: String
    let probability: Int
}

/// 聊天记录分析结果
struct ChatAnalysis: Codable, Hashable {
    let total: Int
    let participants: [String]
    let avgReplyHours: Double?
    let sentiment: ChatSentiment
    let patterns: [ChatPattern]
    let suggestions: [String]
    let disclaimer: String
}

struct ChatSentiment: Codable, Hashable {
    let positive: Int
    let neutral: Int
    let negative: Int
}

struct ChatPattern: Codable, Hashable {
    let key: String
    let label: String
    let count: Int
    let ratio: Int
}

struct AIExtracted: Codable, Hashable {
    let category: String?
    let behaviorTags: [String]?
    let sentiment: String?
}

/// 情绪打卡（今日打卡状态 / 打卡结果共用；mood 为 emoji 字符串，未打卡时为 nil）
struct MoodCheckin: Codable, Identifiable {
    var id: String { date }
    let date: String            // yyyy-MM-dd
    let mood: String?
    let stressSources: [String]?
    let note: String?
    let createdAt: String?
}

/// 同事关系雷达（5 维评分）
struct RadarScore: Codable, Identifiable {
    let id: String
    let colleagueId: String
    let scorerId: String?
    let cooperation: Int
    let expertise: Int
    let communication: Int
    let support: Int
    let trust: Int
}

/// AI 关系解读
struct RelationshipSummary: Codable {
    let colleagueId: String
    let colleagueName: String
    let position: String?
    let relation: String?
    let radar: RadarMap
    let healthScore: Int
    let relationType: String
    let conflicts: [String]
    let topBehaviors: [String]
    let suggestions: [String]
    let baseOn: Int
    let disclaimer: String
}

/// 五维雷达评分（var 便于本地编辑/保存回填）
struct RadarMap: Codable {
    var cooperation: Int
    var expertise: Int
    var communication: Int
    var support: Int
    var trust: Int
}

/// 职场人格（/api/ai/personality 响应，id 用 personality 派生）
struct PersonalityProfile: Codable, Identifiable {
    var id: String { personality }
    let personality: String
    let emoji: String
    let desc: String
    let stats: PersonalityStats
    let disclaimer: String
}

struct PersonalityStats: Codable {
    let totalComplaints: Int
    let totalResonances: Int
    let topTarget: String?
    let topTheme: String?
    let weakestPoint: String?
    let emotionIndex: Int
    let relationshipSensitivity: Int
    let slackScore: Int
}

/// 情绪趋势点（/api/mood/trends trend 数组元素；缺失日 mood 为 null）
struct MoodTrendPoint: Codable, Identifiable {
    var id: String { date }
    let date: String
    let mood: String?
    let stressSources: [String]
}

/// 情绪 AI 总结
struct MoodSummary: Codable {
    let totalDays: Int
    let message: String
    let rankings: [StressRanking]
    let hotWeekdays: [String]
    let insights: [String]
}

struct StressRanking: Codable, Identifiable {
    let id: String
    let count: Int
}

/// 热搜榜条目
struct TopicItem: Codable, Identifiable {
    let id: String
    let snippet: String
    let category: String?
    let sentiment: String?
    let hotScore: Double
    let resonanceCount: Int
    let likeCount: Int
}

