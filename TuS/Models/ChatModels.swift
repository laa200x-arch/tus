import Foundation

/// 会话（内置 IM，方案 2.3.3 线上交换）
struct Conversation: Codable, Identifiable, Hashable {
    let id: UUID
    var partner: UserModel
    var lastMessageText: String
    var lastTime: Date
    var unreadCount: Int
}

/// 聊天消息
/// - senderIsMe: 是否本人发送
/// - isSystemNote: 系统提示（如风控拦截提示），非普通消息气泡
/// - mediaType/mediaUrl: 媒体消息（image/video，上传后返回的相对路径）
/// - orderId: 引用的宠物护理订单（渲染订单卡片，点击查看详情）
struct ChatMessage: Codable, Identifiable, Hashable {
    let id: UUID
    var senderIsMe: Bool
    var text: String
    var mediaType: String?
    var mediaUrl: String?
    var orderId: String?
    var time: Date
    var isSystemNote: Bool

    init(
        id: UUID = UUID(),
        senderIsMe: Bool,
        text: String,
        mediaType: String? = nil,
        mediaUrl: String? = nil,
        orderId: String? = nil,
        time: Date = Date(),
        isSystemNote: Bool = false
    ) {
        self.id = id
        self.senderIsMe = senderIsMe
        self.text = text
        self.mediaType = mediaType
        self.mediaUrl = mediaUrl
        self.orderId = orderId
        self.time = time
        self.isSystemNote = isSystemNote
    }
}

