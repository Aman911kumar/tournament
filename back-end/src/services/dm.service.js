import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Channel } from "../models/channel.model.js";
import { ChannelSubscription } from "../models/channelSubscription.model.js";
import { DmConversation } from "../models/dmConversation.model.js";
import { DmMessage } from "../models/dmMessage.model.js";
import { Report } from "../models/report.model.js";

const MESSAGE_LIMIT_DEFAULT = 30;
const MESSAGE_LIMIT_MAX = 60;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_ATTACHMENTS = 4;
const ALLOWED_MESSAGE_TYPES = new Set([
    "text",
    "emoji",
    "image",
    "file",
    "voice_note",
    "system",
    "tournament_card",
    "creator_card",
]);
const RELATIONSHIP_PRIVACY = new Set(["followers_only", "subscribers_only", "mutual_followers"]);

const asId = (value) => value?._id?.toString?.() || value?.toString?.() || "";
const sameId = (a, b) => asId(a) === asId(b);

export const getDmRoomName = (conversationId) => `dm:conversation:${conversationId}`;

export const getParticipantKey = (firstUserId, secondUserId) => {
    const ids = [asId(firstUserId), asId(secondUserId)].filter(Boolean).sort();
    if (ids.length !== 2 || ids[0] === ids[1]) throw new ApiError(400, "Invalid conversation participants");
    return ids.join(":");
};

const ensureObjectId = (value, label = "id") => {
    const id = asId(value);
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, `Invalid ${label}`);
    return id;
};

const sanitizeText = (value = "", maxLength = MAX_MESSAGE_LENGTH) =>
    String(value || "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .replace(/\s{6,}/g, "     ")
        .trim()
        .slice(0, maxLength);

const normalizeMetadata = (metadata = {}) => {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
    const allowedKeys = [
        "clientRequestId",
        "tournamentId",
        "tournamentTitle",
        "creatorId",
        "creatorName",
        "source",
        "cardUrl",
    ];
    const next = {};
    for (const key of allowedKeys) {
        const value = metadata[key];
        if (value === undefined || value === null) continue;
        if (typeof value === "boolean" || typeof value === "number") next[key] = value;
        else next[key] = sanitizeText(value, key === "clientRequestId" ? 120 : 500);
    }
    return JSON.stringify(next).length <= 1800 ? next : {};
};

const normalizeAttachments = (attachments = []) => {
    if (!Array.isArray(attachments)) return [];
    return attachments.slice(0, MAX_ATTACHMENTS).map((attachment) => ({
        type: ["image", "file", "voice", "video"].includes(attachment?.type) ? attachment.type : "file",
        url: sanitizeText(attachment?.url, 1000),
        name: sanitizeText(attachment?.name, 160),
        mimeType: sanitizeText(attachment?.mimeType, 120),
        size: Math.max(0, Number(attachment?.size || 0)),
        storageProvider: sanitizeText(attachment?.storageProvider || attachment?.provider, 80),
        mediaId: sanitizeText(attachment?.mediaId, 160),
        apiUrl: sanitizeText(attachment?.apiUrl, 1000),
        downloadUrl: sanitizeText(attachment?.downloadUrl, 1000),
        thumbUrl: sanitizeText(attachment?.thumbUrl, 1000),
        folderId: sanitizeText(attachment?.folderId, 160),
        folderName: sanitizeText(attachment?.folderName, 260),
    })).filter((attachment) => attachment.url);
};

const getRoles = (user) => (Array.isArray(user?.role) ? user.role : []);

const assertCanUseDm = (user, label = "User") => {
    const roles = getRoles(user);
    if (!user?.isActive || roles.includes("banned") || user?.accountStatus === "banned") {
        throw new ApiError(403, `${label} account is not active`);
    }
    if (["suspended", "muted"].includes(user?.accountStatus)) {
        throw new ApiError(403, `${label} account is currently restricted`);
    }
};

export const getDmSettings = (user = {}) => ({
    privacy: user?.preferences?.dmPrivacy || "everyone",
    readReceipts: user?.preferences?.dmReadReceipts !== false,
    onlineStatus: user?.preferences?.dmOnlineStatus !== false,
});

export const serializeDmUser = (user) => {
    const source = user?._doc || user || {};
    const settings = getDmSettings(source);
    return {
        _id: asId(source._id || source),
        username: source.username || "Player",
        avatar: source.avatar || {},
        banner: source.banner || {},
        role: Array.isArray(source.role) ? source.role : [],
        accountStatus: source.accountStatus || "active",
        isActive: source.isActive !== false,
        lastSeenAt: settings.onlineStatus ? source.lastLoginAt || null : null,
        dmOnlineStatus: settings.onlineStatus,
    };
};

export const serializeMessage = (message) => {
    if (!message) return null;
    const source = message?._doc || message;
    return {
        _id: asId(source._id),
        conversation: asId(source.conversation),
        sender: typeof source.sender === "object" ? serializeDmUser(source.sender) : asId(source.sender),
        type: source.type || "text",
        body: source.status === "deleted" ? "This message was deleted" : source.body || "",
        attachments: source.status === "deleted" ? [] : source.attachments || [],
        replyTo: asId(source.replyTo),
        status: source.status || "active",
        deliveryStatus: source.deliveryStatus || "sent",
        clientRequestId: source.clientRequestId || source.metadata?.clientRequestId || "",
        deliveredTo: (source.deliveredTo || []).map((entry) => ({
            user: asId(entry.user),
            at: entry.at,
        })),
        readBy: (source.readBy || []).map((entry) => ({
            user: asId(entry.user),
            at: entry.at,
        })),
        metadata: source.metadata || {},
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
    };
};

const getParticipantRecord = (conversation, userId) =>
    (conversation?.participants || []).find((participant) => sameId(participant.user, userId));

const getOtherParticipant = (conversation, userId) =>
    (conversation?.participants || []).find((participant) => !sameId(participant.user, userId));

export const serializeConversation = (conversation, currentUserId) => {
    if (!conversation) return null;
    const source = conversation?._doc || conversation;
    const participant = getParticipantRecord(source, currentUserId) || {};
    const otherParticipant = getOtherParticipant(source, currentUserId) || {};
    const otherUser = typeof otherParticipant.user === "object"
        ? serializeDmUser(otherParticipant.user)
        : { _id: asId(otherParticipant.user), username: "Player", avatar: {} };

    return {
        _id: asId(source._id),
        type: source.type || "direct",
        participants: (source.participants || []).map((item) => ({
            user: typeof item.user === "object" ? serializeDmUser(item.user) : { _id: asId(item.user) },
            unreadCount: item.unreadCount || 0,
            pinned: Boolean(item.pinned),
            muted: Boolean(item.muted),
            archived: Boolean(item.archived),
            deletedAt: item.deletedAt || null,
            lastReadAt: item.lastReadAt || null,
        })),
        otherUser,
        request: {
            status: source.request?.status || "accepted",
            requestedBy: asId(source.request?.requestedBy),
            respondedAt: source.request?.respondedAt || null,
        },
        blockedBy: (source.blockedBy || []).map((entry) => ({
            user: asId(entry.user),
            reason: entry.reason || "",
            createdAt: entry.createdAt,
        })),
        isBlocked: (source.blockedBy || []).length > 0,
        blockedByMe: (source.blockedBy || []).some((entry) => sameId(entry.user, currentUserId)),
        unreadCount: participant.unreadCount || 0,
        pinned: Boolean(participant.pinned),
        muted: Boolean(participant.muted),
        archived: Boolean(participant.archived),
        lastMessage: source.lastMessage
            ? {
                message: asId(source.lastMessage.message),
                sender: asId(source.lastMessage.sender),
                body: source.lastMessage.body || "",
                type: source.lastMessage.type || "text",
                createdAt: source.lastMessage.createdAt || null,
            }
            : null,
        lastActivityAt: source.lastActivityAt,
        metadata: source.metadata || {},
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
    };
};

const populateConversation = (query) =>
    query
        .populate("participants.user", "username avatar banner role accountStatus isActive lastLoginAt preferences")
        .populate("lastMessage.sender", "username avatar role")
        .lean();

const getConversationQueryForUser = (conversationId, userId) => {
    const id = ensureObjectId(conversationId, "conversation id");
    return DmConversation.findOne({
        _id: id,
        "participants.user": ensureObjectId(userId, "user id"),
    });
};

export const getConversationForUser = async (conversationId, userId) => {
    const conversation = await populateConversation(getConversationQueryForUser(conversationId, userId));
    if (!conversation) throw new ApiError(404, "Conversation not found");
    return conversation;
};

const getUserChannel = async (userId) =>
    Channel.findOne({ owner: userId, isActive: true }).select("_id owner").lean();

const isChannelSubscriber = async (channelId, userId) => {
    if (!channelId || !userId) return false;
    return Boolean(await ChannelSubscription.exists({ channel: channelId, user: userId }));
};

const getRelationshipAccess = async (requesterId, targetId, privacy) => {
    if (!RELATIONSHIP_PRIVACY.has(privacy)) return true;
    const targetChannel = await getUserChannel(targetId);
    const requesterFollowsTarget = await isChannelSubscriber(targetChannel?._id, requesterId);
    if (privacy === "followers_only" || privacy === "subscribers_only") return requesterFollowsTarget;

    const requesterChannel = await getUserChannel(requesterId);
    const targetFollowsRequester = await isChannelSubscriber(requesterChannel?._id, targetId);
    return requesterFollowsTarget && targetFollowsRequester;
};

const getConversationUsers = async (requesterId, targetUserId) => {
    const [requester, target] = await Promise.all([
        User.findById(requesterId)
            .select("username avatar banner role accountStatus isActive lastLoginAt preferences")
            .lean(),
        User.findById(targetUserId)
            .select("username avatar banner role accountStatus isActive lastLoginAt preferences")
            .lean(),
    ]);

    if (!requester) throw new ApiError(401, "Authentication required");
    if (!target) throw new ApiError(404, "User not found");
    if (sameId(requester._id, target._id)) throw new ApiError(400, "You cannot message yourself");
    assertCanUseDm(requester, "Your");
    assertCanUseDm(target, "Recipient");
    return { requester, target };
};

export const listDmConversations = async ({ userId, q = "", status = "inbox", limit = 40 }) => {
    const normalizedUserId = ensureObjectId(userId, "user id");
    const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 80);
    const query = {
        "participants.user": normalizedUserId,
        "participants.deletedAt": null,
    };

    if (status === "requests") {
        query["request.status"] = "pending";
        query["request.requestedBy"] = { $ne: normalizedUserId };
    } else if (status === "sent_requests") {
        query["request.status"] = "pending";
        query["request.requestedBy"] = normalizedUserId;
    } else if (status === "archived") {
        query.participants = {
            $elemMatch: {
                user: normalizedUserId,
                archived: true,
                deletedAt: null,
            },
        };
    } else {
        query["request.status"] = { $in: ["accepted", "pending"] };
        query.participants = {
            $elemMatch: {
                user: normalizedUserId,
                archived: { $ne: true },
                deletedAt: null,
            },
        };
    }

    const conversations = await populateConversation(
        DmConversation.find(query)
            .sort({ "participants.pinned": -1, lastActivityAt: -1 })
            .limit(safeLimit)
    );

    const search = String(q || "").trim().toLowerCase();
    const serialized = conversations.map((conversation) => serializeConversation(conversation, normalizedUserId));
    if (!search) return serialized;
    return serialized.filter((conversation) =>
        conversation.otherUser?.username?.toLowerCase?.().includes(search) ||
        conversation.lastMessage?.body?.toLowerCase?.().includes(search)
    );
};

export const getDmUnreadTotal = async (userId) => {
    const normalizedUserId = ensureObjectId(userId, "user id");
    const conversations = await DmConversation.find({
        participants: {
            $elemMatch: {
                user: normalizedUserId,
                archived: { $ne: true },
                deletedAt: null,
            },
        },
    }).select("participants").lean();

    return conversations.reduce((total, conversation) => {
        const participant = getParticipantRecord(conversation, normalizedUserId);
        return total + Math.max(0, Number(participant?.unreadCount || 0));
    }, 0);
};

export const startDmConversation = async ({ user, targetUserId, initialMessage = "", metadata = {} }) => {
    const requesterId = ensureObjectId(user?._id, "user id");
    const targetId = ensureObjectId(targetUserId, "target user id");
    const { requester, target } = await getConversationUsers(requesterId, targetId);
    const participantKey = getParticipantKey(requester._id, target._id);

    let conversation = await DmConversation.findOne({ participantKey });
    if (conversation) {
        if ((conversation.blockedBy || []).length) throw new ApiError(403, "This conversation is blocked");
        const participant = getParticipantRecord(conversation, requesterId);
        if (participant?.deletedAt) {
            participant.deletedAt = null;
            participant.archived = false;
            await conversation.save();
        }
    } else {
        const targetSettings = getDmSettings(target);
        if (targetSettings.privacy === "nobody") {
            throw new ApiError(403, "This user is not accepting direct messages");
        }
        const hasRelationshipAccess = await getRelationshipAccess(requester._id, target._id, targetSettings.privacy);
        const requestStatus = hasRelationshipAccess ? "accepted" : "pending";
        conversation = await DmConversation.create({
            type: "direct",
            participantKey,
            participants: [
                { user: requester._id, unreadCount: 0 },
                { user: target._id, unreadCount: 0 },
            ],
            createdBy: requester._id,
            request: {
                status: requestStatus,
                requestedBy: requestStatus === "pending" ? requester._id : null,
            },
            metadata: normalizeMetadata(metadata),
        });
    }

    let message = null;
    if (sanitizeText(initialMessage)) {
        const sent = await sendDmMessage({
            user: requester,
            conversationId: conversation._id,
            body: initialMessage,
            type: "text",
            metadata,
        });
        message = sent.message;
    }

    const populated = await populateConversation(DmConversation.findById(conversation._id));
    return {
        conversation: serializeConversation(populated, requesterId),
        message,
    };
};

export const getDmMessages = async ({ userId, conversationId, before, limit }) => {
    const normalizedUserId = ensureObjectId(userId, "user id");
    await getConversationForUser(conversationId, normalizedUserId);
    const safeLimit = Math.min(Math.max(Number(limit) || MESSAGE_LIMIT_DEFAULT, 1), MESSAGE_LIMIT_MAX);
    const query = { conversation: ensureObjectId(conversationId, "conversation id") };
    if (before && mongoose.Types.ObjectId.isValid(before)) {
        query._id = { $lt: before };
    }

    const messages = await DmMessage.find(query)
        .populate("sender", "username avatar role")
        .sort({ _id: -1 })
        .limit(safeLimit)
        .lean();

    return messages.reverse().map(serializeMessage);
};

export const sendDmMessage = async ({
    user,
    conversationId,
    body = "",
    type = "text",
    attachments = [],
    replyTo = null,
    metadata = {},
    clientRequestId = "",
}) => {
    const senderId = ensureObjectId(user?._id, "user id");
    const conversation = await getConversationQueryForUser(conversationId, senderId);
    if (!conversation) throw new ApiError(404, "Conversation not found");
    assertCanUseDm(user, "Your");
    if ((conversation.blockedBy || []).length) throw new ApiError(403, "This conversation is blocked");

    const requestStatus = conversation.request?.status || "accepted";
    if (requestStatus === "declined") throw new ApiError(403, "This message request was declined");
    if (requestStatus === "pending" && !sameId(conversation.request?.requestedBy, senderId)) {
        throw new ApiError(403, "Accept this message request before replying");
    }

    const safeType = ALLOWED_MESSAGE_TYPES.has(type) ? type : "text";
    const safeBody = sanitizeText(body);
    const safeAttachments = normalizeAttachments(attachments);
    const safeClientRequestId = sanitizeText(clientRequestId || metadata?.clientRequestId, 120);

    if (!safeBody && safeAttachments.length === 0 && !["tournament_card", "creator_card", "system"].includes(safeType)) {
        throw new ApiError(400, "Message cannot be empty");
    }

    if (safeClientRequestId) {
        const existing = await DmMessage.findOne({
            conversation: conversation._id,
            sender: senderId,
            clientRequestId: safeClientRequestId,
        }).populate("sender", "username avatar role").lean();
        if (existing) {
            const populatedConversation = await populateConversation(DmConversation.findById(conversation._id));
            return {
                message: serializeMessage(existing),
                conversation: serializeConversation(populatedConversation, senderId),
                idempotent: true,
            };
        }
    }

    const message = await DmMessage.create({
        conversation: conversation._id,
        sender: senderId,
        type: safeAttachments.length && safeType === "text" ? safeAttachments[0].type : safeType,
        body: safeBody,
        attachments: safeAttachments,
        replyTo: replyTo && mongoose.Types.ObjectId.isValid(replyTo) ? replyTo : null,
        clientRequestId: safeClientRequestId,
        readBy: [{ user: senderId, at: new Date() }],
        deliveredTo: [{ user: senderId, at: new Date() }],
        metadata: normalizeMetadata(metadata),
    });

    const otherParticipant = getOtherParticipant(conversation, senderId);
    conversation.lastMessage = {
        message: message._id,
        sender: senderId,
        body: safeBody || (safeAttachments.length ? safeAttachments[0].name || "Attachment" : "Shared item"),
        type: message.type,
        createdAt: message.createdAt,
    };
    conversation.lastActivityAt = message.createdAt;
    for (const participant of conversation.participants) {
        if (sameId(participant.user, senderId)) {
            participant.deletedAt = null;
            participant.archived = false;
            participant.unreadCount = 0;
            participant.lastReadAt = new Date();
        } else {
            participant.deletedAt = null;
            participant.unreadCount = Math.max(0, Number(participant.unreadCount || 0)) + 1;
        }
    }
    await conversation.save();

    const populatedMessage = await DmMessage.findById(message._id).populate("sender", "username avatar role").lean();
    const populatedConversation = await populateConversation(DmConversation.findById(conversation._id));

    return {
        message: serializeMessage(populatedMessage),
        conversation: serializeConversation(populatedConversation, senderId),
        recipientId: asId(otherParticipant?.user),
    };
};

export const markDmDelivered = async ({ userId, conversationId }) => {
    const normalizedUserId = ensureObjectId(userId, "user id");
    await getConversationForUser(conversationId, normalizedUserId);
    const now = new Date();
    await DmMessage.updateMany(
        {
            conversation: ensureObjectId(conversationId, "conversation id"),
            sender: { $ne: normalizedUserId },
            "deliveredTo.user": { $ne: normalizedUserId },
        },
        {
            $push: { deliveredTo: { user: normalizedUserId, at: now } },
            $set: { deliveryStatus: "delivered" },
        }
    );
    return { conversationId: asId(conversationId), userId: normalizedUserId, deliveredAt: now };
};

export const markDmRead = async ({ userId, conversationId }) => {
    const normalizedUserId = ensureObjectId(userId, "user id");
    const conversation = await getConversationQueryForUser(conversationId, normalizedUserId);
    if (!conversation) throw new ApiError(404, "Conversation not found");
    const now = new Date();
    const participant = getParticipantRecord(conversation, normalizedUserId);
    if (participant) {
        participant.unreadCount = 0;
        participant.lastReadAt = now;
        await conversation.save();
    }

    await DmMessage.updateMany(
        {
            conversation: conversation._id,
            sender: { $ne: normalizedUserId },
            "readBy.user": { $ne: normalizedUserId },
        },
        {
            $push: { readBy: { user: normalizedUserId, at: now } },
            $set: { deliveryStatus: "read" },
        }
    );

    return { conversationId: asId(conversation._id), userId: normalizedUserId, readAt: now, unreadCount: 0 };
};

export const updateConversationPreferences = async ({ userId, conversationId, pinned, muted, archived }) => {
    const normalizedUserId = ensureObjectId(userId, "user id");
    const conversation = await getConversationQueryForUser(conversationId, normalizedUserId);
    if (!conversation) throw new ApiError(404, "Conversation not found");

    const participant = getParticipantRecord(conversation, normalizedUserId);
    if (!participant) throw new ApiError(404, "Conversation not found");
    if (typeof pinned === "boolean") participant.pinned = pinned;
    if (typeof muted === "boolean") participant.muted = muted;
    if (typeof archived === "boolean") participant.archived = archived;
    participant.deletedAt = null;
    await conversation.save();

    const populated = await populateConversation(DmConversation.findById(conversation._id));
    return serializeConversation(populated, normalizedUserId);
};

export const acceptMessageRequest = async ({ userId, conversationId }) => {
    const normalizedUserId = ensureObjectId(userId, "user id");
    const conversation = await getConversationQueryForUser(conversationId, normalizedUserId);
    if (!conversation) throw new ApiError(404, "Conversation not found");
    if ((conversation.request?.status || "accepted") !== "pending") {
        const populatedExisting = await populateConversation(DmConversation.findById(conversation._id));
        return serializeConversation(populatedExisting, normalizedUserId);
    }
    if (sameId(conversation.request?.requestedBy, normalizedUserId)) {
        throw new ApiError(403, "The recipient must accept this message request");
    }
    conversation.request.status = "accepted";
    conversation.request.respondedAt = new Date();
    await conversation.save();
    const populated = await populateConversation(DmConversation.findById(conversation._id));
    return serializeConversation(populated, normalizedUserId);
};

export const declineMessageRequest = async ({ userId, conversationId }) => {
    const normalizedUserId = ensureObjectId(userId, "user id");
    const conversation = await getConversationQueryForUser(conversationId, normalizedUserId);
    if (!conversation) throw new ApiError(404, "Conversation not found");
    if (sameId(conversation.request?.requestedBy, normalizedUserId)) {
        throw new ApiError(403, "Only the recipient can decline this message request");
    }
    conversation.request.status = "declined";
    conversation.request.respondedAt = new Date();
    const participant = getParticipantRecord(conversation, normalizedUserId);
    if (participant) {
        participant.unreadCount = 0;
        participant.deletedAt = new Date();
    }
    await conversation.save();
    return { conversationId: asId(conversation._id), status: "declined" };
};

export const blockDmConversation = async ({ userId, conversationId, reason = "" }) => {
    const normalizedUserId = ensureObjectId(userId, "user id");
    const conversation = await getConversationQueryForUser(conversationId, normalizedUserId);
    if (!conversation) throw new ApiError(404, "Conversation not found");
    if (!(conversation.blockedBy || []).some((entry) => sameId(entry.user, normalizedUserId))) {
        conversation.blockedBy.push({
            user: normalizedUserId,
            reason: sanitizeText(reason, 240),
            createdAt: new Date(),
        });
    }
    await conversation.save();
    const populated = await populateConversation(DmConversation.findById(conversation._id));
    return serializeConversation(populated, normalizedUserId);
};

export const deleteDmConversationForUser = async ({ userId, conversationId }) => {
    const normalizedUserId = ensureObjectId(userId, "user id");
    const conversation = await getConversationQueryForUser(conversationId, normalizedUserId);
    if (!conversation) throw new ApiError(404, "Conversation not found");
    const participant = getParticipantRecord(conversation, normalizedUserId);
    if (participant) {
        participant.deletedAt = new Date();
        participant.archived = false;
        participant.unreadCount = 0;
    }
    await conversation.save();
    return { conversationId: asId(conversation._id), deleted: true };
};

const normalizeReportReason = (reason = "other") => {
    const value = String(reason || "other").toLowerCase();
    if (["spam", "harassment", "abuse"].includes(value)) return "abusive_behavior";
    if (["scam", "fake_account", "fraud"].includes(value)) return "fraud_scam";
    if (["inappropriate", "nsfw"].includes(value)) return "inappropriate_content";
    return ["abusive_behavior", "fraud_scam", "spam", "other"].includes(value) ? value : "other";
};

export const reportDmConversation = async ({ userId, conversationId, reason = "other", message = "" }) => {
    const normalizedUserId = ensureObjectId(userId, "user id");
    const conversation = await getConversationForUser(conversationId, normalizedUserId);
    const otherParticipant = getOtherParticipant(conversation, normalizedUserId);
    const category = normalizeReportReason(reason);
    const report = await Report.create({
        reporter: normalizedUserId,
        createdBy: normalizedUserId,
        targetType: "player",
        category,
        reason: category,
        reportedUser: asId(otherParticipant?.user?._id || otherParticipant?.user) || null,
        title: "Direct message report",
        message: sanitizeText(message || `Reported a direct message conversation for ${category}`, 1000),
        content: sanitizeText(message || "Direct message conversation reported", 1000),
        severity: category === "fraud_scam" || category === "abusive_behavior" ? "high" : "medium",
        duplicateKey: `dm:${conversationId}:${normalizedUserId}:${Date.now()}`,
        metadata: {
            conversationId: asId(conversationId),
        },
    });

    return {
        _id: asId(report._id),
        status: report.status,
        category: report.category,
        createdAt: report.createdAt,
    };
};

export const updateDmSettings = async ({ userId, privacy, readReceipts, onlineStatus }) => {
    const normalizedUserId = ensureObjectId(userId, "user id");
    const allowedPrivacy = ["everyone", "followers_only", "subscribers_only", "mutual_followers", "nobody"];
    const update = {};
    if (allowedPrivacy.includes(privacy)) update["preferences.dmPrivacy"] = privacy;
    if (typeof readReceipts === "boolean") update["preferences.dmReadReceipts"] = readReceipts;
    if (typeof onlineStatus === "boolean") update["preferences.dmOnlineStatus"] = onlineStatus;

    const user = await User.findByIdAndUpdate(normalizedUserId, { $set: update }, { new: true })
        .select("preferences")
        .lean();
    if (!user) throw new ApiError(404, "User not found");
    return getDmSettings(user);
};
