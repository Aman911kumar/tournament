import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { Tournament } from "../models/tournament.model.js";
import { Registration } from "../models/registration.model.js";
import { ChatMessage } from "../models/chatMessage.model.js";
import { ChatRoomState } from "../models/chatRoomState.model.js";
import { ChatReadState } from "../models/chatReadState.model.js";
import { ChatModerationLog } from "../models/chatModerationLog.model.js";
import { User } from "../models/user.model.js";
import { deleteFromTeleStore } from "./storage/telestore.service.js";

const MODERATOR_ROLES = ["admin", "moderator", "super_admin", "support", "tournament_manager"];
const ACTIVE_REGISTRATION_STATUSES = ["paid", "confirmed"];
const MESSAGE_LIMIT_MAX = 60;
const MESSAGE_LIMIT_DEFAULT = 30;
const MAX_ATTACHMENTS = 4;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_METADATA_LENGTH = 1500;
const CHAT_PARTICIPANT_CACHE_TTL_MS = Number(process.env.CHAT_PARTICIPANT_CACHE_TTL_MS || 15_000);
const CHAT_PARTICIPANT_CACHE_MAX = Number(process.env.CHAT_PARTICIPANT_CACHE_MAX || 500);
const ALLOWED_REACTIONS = new Set(["👍", "❤️", "😂", "🔥", "😮", "😢", "👏", "👀", "🏆", "🎯"]);

const participantCache = new Map();

const asId = (value) => value?._id?.toString?.() || value?.toString?.() || "";
const sameId = (a, b) => asId(a) === asId(b);

export const getChatRoomName = (tournamentId) => `chat:tournament:${tournamentId}`;

export const hasChatModeratorRole = (user) => {
    const roles = Array.isArray(user?.role) ? user.role : Array.isArray(user?.roles) ? user.roles : [];
    return roles.some((role) => MODERATOR_ROLES.includes(role));
};

const sanitizeText = (value = "", maxLength = MAX_MESSAGE_LENGTH) =>
    String(value || "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .replace(/\s{5,}/g, "    ")
        .trim()
        .slice(0, maxLength);

const getCachedParticipantIds = (tournamentId) => {
    if (!CHAT_PARTICIPANT_CACHE_TTL_MS) return null;
    const key = asId(tournamentId);
    const cached = participantCache.get(key);
    if (!cached || cached.expiresAt <= Date.now()) {
        participantCache.delete(key);
        return null;
    }
    return cached.ids;
};

const setCachedParticipantIds = (tournamentId, ids = []) => {
    if (!CHAT_PARTICIPANT_CACHE_TTL_MS) return;
    const key = asId(tournamentId);
    if (!key) return;
    participantCache.set(key, {
        ids,
        expiresAt: Date.now() + CHAT_PARTICIPANT_CACHE_TTL_MS,
    });
    if (participantCache.size > CHAT_PARTICIPANT_CACHE_MAX) {
        const oldestKey = participantCache.keys().next().value;
        if (oldestKey) participantCache.delete(oldestKey);
    }
};

export const invalidateChatParticipantCache = (tournamentId) => {
    participantCache.delete(asId(tournamentId));
};

const normalizeMetadata = (metadata = {}) => {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};

    const allowedKeys = [
        "clientRequestId",
        "roomId",
        "roomPass",
        "roomJoinTime",
        "action",
        "targetUser",
        "slowModeSeconds",
    ];
    const next = {};
    for (const key of allowedKeys) {
        const value = metadata[key];
        if (value === undefined || value === null) continue;
        if (typeof value === "boolean" || typeof value === "number") next[key] = value;
        else next[key] = sanitizeText(value, key === "clientRequestId" ? 100 : 500);
    }

    if (JSON.stringify(next).length <= MAX_METADATA_LENGTH) return next;
    return next.clientRequestId ? { clientRequestId: next.clientRequestId } : {};
};

const isActiveModerationEntry = (entry) => {
    if (!entry) return false;
    if (!entry.until) return true;
    return new Date(entry.until).getTime() > Date.now();
};

const normalizeDurationMinutes = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, 60 * 24 * 30);
};

const getActiveEntry = (entries = [], userId) =>
    entries.find((entry) => sameId(entry.user, userId) && isActiveModerationEntry(entry));

export const getOrCreateChatRoomState = async (tournamentId) =>
    ChatRoomState.findOneAndUpdate(
        { tournament: tournamentId },
        { $setOnInsert: { tournament: tournamentId, enabled: true } },
        { new: true, upsert: true }
    );

export const getChatParticipantIds = async (tournament) => {
    const tournamentId = asId(tournament);
    const cached = getCachedParticipantIds(tournamentId);
    if (cached) return cached;

    const ids = new Set();
    if (tournament?.organizer) ids.add(asId(tournament.organizer));
    (tournament?.joinedPlayers || []).forEach((userId) => ids.add(asId(userId)));

    const registrations = await Registration.find({
        tournament: tournamentId,
        status: { $in: ACTIVE_REGISTRATION_STATUSES },
    }).select("user team").lean();

    registrations.forEach((registration) => {
        if (registration.user) ids.add(asId(registration.user));
        (registration.team || []).forEach((userId) => ids.add(asId(userId)));
    });

    const participantIds = [...ids].filter((id) => mongoose.Types.ObjectId.isValid(id));
    setCachedParticipantIds(tournamentId, participantIds);
    return participantIds;
};

const canAccessTournamentChat = async (user, tournament) => {
    if (!user || !tournament) return { allowed: false, role: "guest" };
    if (hasChatModeratorRole(user)) return { allowed: true, role: "admin" };
    if (sameId(tournament.organizer, user._id)) return { allowed: true, role: "creator" };
    if ((tournament.joinedPlayers || []).some((id) => sameId(id, user._id))) return { allowed: true, role: "player" };

    const registration = await Registration.exists({
        tournament: tournament._id,
        status: { $in: ACTIVE_REGISTRATION_STATUSES },
        $or: [
            { user: user._id },
            { team: user._id },
        ],
    });

    return { allowed: Boolean(registration), role: registration ? "player" : "guest" };
};

export const getChatAccessContext = async (user, tournamentId, options = {}) => {
    const normalizedTournamentId = asId(tournamentId);
    if (!mongoose.Types.ObjectId.isValid(normalizedTournamentId)) {
        throw new ApiError(400, "Invalid tournament id");
    }

    const tournament = await Tournament.findById(normalizedTournamentId)
        .select("title game status organizer channel room_details joinedPlayers startAt")
        .populate("organizer", "username avatar role")
        .lean();

    if (!tournament) throw new ApiError(404, "Tournament not found");

    const access = await canAccessTournamentChat(user, tournament);
    if (!access.allowed) {
        throw new ApiError(403, "Join this tournament to access room chat");
    }

    const roomState = await getOrCreateChatRoomState(tournament._id);
    const isModerator = access.role === "admin" || access.role === "creator";
    const activeBan = getActiveEntry(roomState.bannedUsers, user._id);
    if (activeBan && !isModerator && !options.ignoreBan) {
        throw new ApiError(403, "You are banned from this room chat");
    }

    const activeMute = getActiveEntry(roomState.mutedUsers, user._id);

    return {
        tournament,
        roomState,
        role: access.role,
        permissions: {
            canRead: true,
            canSend: !activeMute && !activeBan,
            canModerate: isModerator,
            canDeleteAny: isModerator,
            canPin: isModerator,
            canShareRoomCard: isModerator,
            mutedUntil: activeMute?.until || null,
            bannedUntil: activeBan?.until || null,
        },
    };
};

export const serializeChatAccess = async (context, userId) => {
    const participantIds = await getChatParticipantIds(context.tournament);
    const unread = await ChatReadState.findOne({
        tournament: context.tournament._id,
        user: userId,
    }).lean();
    const pinnedMessage = context.roomState.pinnedMessage
        ? await ChatMessage.findById(context.roomState.pinnedMessage)
            .populate("sender", "username avatar role")
            .lean()
        : null;

    return {
        tournament: {
            _id: asId(context.tournament._id),
            title: context.tournament.title,
            game: context.tournament.game,
            status: context.tournament.status,
            startAt: context.tournament.startAt,
            organizer: context.tournament.organizer,
            room: {
                roomId: context.tournament.room_details?.roomId || "",
                roomPass: context.tournament.room_details?.roomPass || "",
                roomJoinTime: context.tournament.room_details?.roomJoinTime || null,
            },
        },
        role: context.role,
        permissions: context.permissions,
        slowModeSeconds: context.roomState.slowModeSeconds || 0,
        announcement: context.roomState.announcement || null,
        pinnedMessage: pinnedMessage ? serializeMessage(pinnedMessage) : null,
        participantCount: participantIds.length,
        unreadCount: Number(unread?.unreadCount || 0),
    };
};

export const serializeMessage = (message) => {
    const plain = message?.toObject?.() || message;
    if (!plain) return null;

    return {
        _id: asId(plain._id),
        tournament: asId(plain.tournament),
        sender: plain.sender && typeof plain.sender === "object"
            ? {
                _id: asId(plain.sender._id),
                username: plain.sender.username,
                avatar: plain.sender.avatar,
                role: plain.sender.role || [],
            }
            : plain.sender ? { _id: asId(plain.sender) } : null,
        type: plain.type,
        body: plain.status === "deleted" ? "This message was deleted" : plain.body,
        attachments: plain.status === "deleted" ? [] : (plain.attachments || []),
        replyTo: plain.replyTo && typeof plain.replyTo === "object" ? {
            _id: asId(plain.replyTo._id),
            body: plain.replyTo.body,
            type: plain.replyTo.type,
            sender: plain.replyTo.sender && typeof plain.replyTo.sender === "object"
                ? { _id: asId(plain.replyTo.sender._id), username: plain.replyTo.sender.username }
                : null,
        } : plain.replyTo ? { _id: asId(plain.replyTo) } : null,
        mentions: (plain.mentions || []).map(asId),
        reactions: (plain.reactions || []).map((reaction) => ({
            emoji: reaction.emoji,
            users: (reaction.users || []).map(asId),
        })),
        seenBy: (plain.seenBy || []).map((seen) => ({
            user: asId(seen.user),
            seenAt: seen.seenAt,
        })),
        status: plain.status,
        editedAt: plain.editedAt,
        deletedAt: plain.deletedAt,
        pinnedAt: plain.pinnedAt,
        metadata: plain.metadata || {},
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    };
};

const populateMessageQuery = (query) =>
    query
        .populate("sender", "username avatar role")
        .populate({
            path: "replyTo",
            select: "body type sender status",
            populate: { path: "sender", select: "username avatar role" },
        });

export const getChatMessages = async ({ user, tournamentId, before, limit = MESSAGE_LIMIT_DEFAULT }) => {
    await getChatAccessContext(user, tournamentId);
    const safeLimit = Math.min(Math.max(Number(limit) || MESSAGE_LIMIT_DEFAULT, 1), MESSAGE_LIMIT_MAX);
    const query = { tournament: tournamentId };

    if (before) {
        const beforeDate = new Date(before);
        if (!Number.isNaN(beforeDate.getTime())) {
            query.createdAt = { $lt: beforeDate };
        }
    }

    const messages = await populateMessageQuery(
        ChatMessage.find(query)
            .sort({ createdAt: -1, _id: -1 })
            .limit(safeLimit + 1)
            .lean()
    );

    const hasMore = messages.length > safeLimit;
    const page = messages.slice(0, safeLimit).reverse().map(serializeMessage);
    return {
        messages: page,
        hasMore,
        nextCursor: hasMore ? page[0]?.createdAt : null,
    };
};

const normalizeAttachments = (attachments = []) =>
    attachments
        .filter(Boolean)
        .slice(0, MAX_ATTACHMENTS)
        .map((attachment) => {
            const type = attachment.type === "image" ? "image" : "file";
            const url = sanitizeText(attachment.url, 500);
            if (!url) return null;
            return {
                type,
                url,
                name: sanitizeText(attachment.name || "Attachment", 120),
                mimeType: sanitizeText(attachment.mimeType || "", 120),
                size: Math.max(0, Number(attachment.size || 0)),
                storageProvider: sanitizeText(attachment.storageProvider || "", 40),
                mediaId: sanitizeText(attachment.mediaId || "", 160),
                apiUrl: sanitizeText(attachment.apiUrl || "", 500),
                downloadUrl: sanitizeText(attachment.downloadUrl || "", 500),
                thumbUrl: sanitizeText(attachment.thumbUrl || "", 500),
                folderId: sanitizeText(attachment.folderId || "", 160),
                folderName: sanitizeText(attachment.folderName || "", 300),
            };
        })
        .filter(Boolean);

const deleteMessageTeleStoreAttachments = async (attachments = []) => {
    const mediaIds = [
        ...new Set(
            (attachments || [])
                .filter((attachment) => String(attachment?.storageProvider || "").toLowerCase() === "telestore")
                .map((attachment) => String(attachment?.mediaId || "").trim())
                .filter(Boolean)
        ),
    ];

    if (!mediaIds.length) return;
    await Promise.all(mediaIds.map((mediaId) => deleteFromTeleStore(mediaId)));
};

const normalizeMentions = (mentions = []) =>
    [...new Set((mentions || []).map(asId).filter((id) => mongoose.Types.ObjectId.isValid(id)))].slice(0, 12);

const resolveMentions = async (body, mentions = []) => {
    const ids = new Set(normalizeMentions(mentions));
    const usernames = [...String(body || "").matchAll(/@([a-zA-Z0-9_]{4,30})/g)]
        .map((match) => match[1])
        .slice(0, 12);

    if (usernames.length) {
        const users = await User.find({ username: { $in: [...new Set(usernames)] } }).select("_id").lean();
        users.forEach((user) => ids.add(asId(user._id)));
    }

    return [...ids].slice(0, 12);
};

const assertCanSend = async ({ user, tournamentId, context }) => {
    if (!context.permissions.canSend) {
        throw new ApiError(403, "You cannot send messages in this room");
    }

    if (context.permissions.canModerate) return;

    const slowModeSeconds = Number(context.roomState.slowModeSeconds || 0);
    if (slowModeSeconds <= 0) return;

    const latestMessage = await ChatMessage.findOne({
        tournament: tournamentId,
        sender: user._id,
        type: { $in: ["text", "image", "file"] },
    }).select("createdAt").sort({ createdAt: -1 }).lean();

    if (!latestMessage) return;
    const waitMs = slowModeSeconds * 1000 - (Date.now() - new Date(latestMessage.createdAt).getTime());
    if (waitMs > 0) {
        throw new ApiError(429, `Slow mode is active. Wait ${Math.ceil(waitMs / 1000)}s before sending again.`);
    }
};

export const createChatMessage = async ({ user, tournamentId, body, attachments = [], replyTo, mentions = [], type = "text", metadata = {} }) => {
    const context = await getChatAccessContext(user, tournamentId);
    await assertCanSend({ user, tournamentId, context });

    const cleanBody = sanitizeText(body);
    const cleanAttachments = normalizeAttachments(attachments);
    const cleanMetadata = normalizeMetadata(metadata);
    const clientRequestId = cleanMetadata.clientRequestId;

    if (clientRequestId) {
        const existing = await populateMessageQuery(
            ChatMessage.findOne({
                tournament: tournamentId,
                sender: user._id,
                "metadata.clientRequestId": clientRequestId,
            }).lean()
        );
        if (existing) {
            return {
                message: serializeMessage(existing),
                participantIds: await getChatParticipantIds(context.tournament),
                context,
                duplicate: true,
            };
        }
    }

    if (type === "room_card" && !context.permissions.canShareRoomCard) {
        throw new ApiError(403, "Only creator or admin can share room details");
    }
    if (["announcement", "system"].includes(type) && !context.permissions.canModerate) {
        throw new ApiError(403, "Only creator or admin can send this message type");
    }
    const messageType = type === "announcement" || type === "room_card" || type === "system"
        ? type
        : cleanAttachments.some((attachment) => attachment.type === "image")
            ? "image"
            : cleanAttachments.length
                ? "file"
                : "text";

    if (!cleanBody && cleanAttachments.length === 0 && messageType !== "room_card") {
        throw new ApiError(400, "Message cannot be empty");
    }

    if (replyTo && !mongoose.Types.ObjectId.isValid(replyTo)) {
        throw new ApiError(400, "Invalid reply message id");
    }

    const message = await ChatMessage.create({
        tournament: tournamentId,
        sender: user._id,
        type: messageType,
        body: cleanBody,
        attachments: cleanAttachments,
        replyTo: replyTo || null,
        mentions: await resolveMentions(cleanBody, mentions),
        seenBy: [{ user: user._id, seenAt: new Date() }],
        metadata: cleanMetadata,
    });

    await ChatRoomState.updateOne(
        { tournament: tournamentId },
        { $set: { lastMessage: message._id, lastMessageAt: message.createdAt } },
        { upsert: true }
    );

    const participantIds = await getChatParticipantIds(context.tournament);
    const unreadOps = participantIds
        .filter((id) => id !== asId(user._id))
        .map((id) => ({
            updateOne: {
                filter: { tournament: tournamentId, user: id },
                update: { $inc: { unreadCount: 1 }, $set: { updatedAt: new Date() } },
                upsert: true,
            },
        }));
    if (unreadOps.length) await ChatReadState.bulkWrite(unreadOps, { ordered: false });

    const populated = await populateMessageQuery(ChatMessage.findById(message._id).lean());
    return {
        message: serializeMessage(populated),
        participantIds,
        context,
    };
};

export const createSystemChatMessage = async ({ tournamentId, body, type = "system", metadata = {} }) => {
    const message = await ChatMessage.create({
        tournament: tournamentId,
        sender: null,
        type,
        body: sanitizeText(body, 500),
        metadata,
    });
    await ChatRoomState.updateOne(
        { tournament: tournamentId },
        { $set: { lastMessage: message._id, lastMessageAt: message.createdAt } },
        { upsert: true }
    );
    return serializeMessage(await ChatMessage.findById(message._id).lean());
};

const getMessageWithContext = async (user, messageId) => {
    if (!mongoose.Types.ObjectId.isValid(messageId)) throw new ApiError(400, "Invalid message id");
    const message = await ChatMessage.findById(messageId);
    if (!message) throw new ApiError(404, "Message not found");
    const context = await getChatAccessContext(user, message.tournament);
    return { message, context };
};

export const editChatMessage = async ({ user, messageId, body }) => {
    const { message } = await getMessageWithContext(user, messageId);
    if (message.status === "deleted") throw new ApiError(400, "Deleted messages cannot be edited");
    if (!sameId(message.sender, user._id)) throw new ApiError(403, "Only the sender can edit this message");
    if (!["text", "image", "file"].includes(message.type)) throw new ApiError(400, "This message type cannot be edited");

    message.body = sanitizeText(body);
    message.editedAt = new Date();
    await message.save();
    return serializeMessage(await populateMessageQuery(ChatMessage.findById(message._id).lean()));
};

export const deleteChatMessage = async ({ user, messageId }) => {
    const { message, context } = await getMessageWithContext(user, messageId);
    const isSender = sameId(message.sender, user._id);
    if (!isSender && !context.permissions.canDeleteAny) {
        throw new ApiError(403, "You cannot delete this message");
    }

    await deleteMessageTeleStoreAttachments(message.attachments);

    message.status = "deleted";
    message.body = "";
    message.attachments = [];
    message.deletedAt = new Date();
    message.deletedBy = user._id;
    await message.save();

    if (!isSender) {
        await ChatModerationLog.create({
            tournament: message.tournament,
            actor: user._id,
            message: message._id,
            action: "delete_message",
        });
    }

    return serializeMessage(await populateMessageQuery(ChatMessage.findById(message._id).lean()));
};

export const toggleReaction = async ({ user, messageId, emoji }) => {
    const cleanEmoji = sanitizeText(emoji, 16);
    if (!ALLOWED_REACTIONS.has(cleanEmoji)) throw new ApiError(400, "Unsupported reaction");

    const { message } = await getMessageWithContext(user, messageId);
    if (message.status === "deleted") throw new ApiError(400, "Cannot react to deleted messages");

    const userId = asId(user._id);
    const reaction = message.reactions.find((item) => item.emoji === cleanEmoji);
    if (reaction) {
        const hasReaction = reaction.users.some((id) => asId(id) === userId);
        reaction.users = hasReaction
            ? reaction.users.filter((id) => asId(id) !== userId)
            : [...reaction.users, user._id];
        if (reaction.users.length === 0) {
            message.reactions = message.reactions.filter((item) => item.emoji !== cleanEmoji);
        }
    } else {
        message.reactions.push({ emoji: cleanEmoji, users: [user._id] });
    }

    await message.save();
    return serializeMessage(await populateMessageQuery(ChatMessage.findById(message._id).lean()));
};

export const pinChatMessage = async ({ user, messageId }) => {
    const { message, context } = await getMessageWithContext(user, messageId);
    if (!context.permissions.canPin) throw new ApiError(403, "Only creator or admin can pin messages");

    message.pinnedAt = new Date();
    message.pinnedBy = user._id;
    await message.save();
    await ChatRoomState.updateOne(
        { tournament: message.tournament },
        { $set: { pinnedMessage: message._id } },
        { upsert: true }
    );
    await ChatModerationLog.create({
        tournament: message.tournament,
        actor: user._id,
        message: message._id,
        action: "pin_message",
    });

    return serializeMessage(await populateMessageQuery(ChatMessage.findById(message._id).lean()));
};

export const unpinChatMessage = async ({ user, tournamentId }) => {
    const context = await getChatAccessContext(user, tournamentId);
    if (!context.permissions.canPin) throw new ApiError(403, "Only creator or admin can unpin messages");

    const pinnedMessage = context.roomState.pinnedMessage;
    await ChatRoomState.updateOne({ tournament: tournamentId }, { $set: { pinnedMessage: null } });
    if (pinnedMessage) await ChatMessage.updateOne({ _id: pinnedMessage }, { $set: { pinnedAt: null, pinnedBy: null } });
    await ChatModerationLog.create({
        tournament: tournamentId,
        actor: user._id,
        message: pinnedMessage || null,
        action: "unpin_message",
    });

    return { pinnedMessage: null };
};

export const markChatRead = async ({ user, tournamentId, messageId }) => {
    const context = await getChatAccessContext(user, tournamentId);
    const lastMessage = messageId && mongoose.Types.ObjectId.isValid(messageId)
        ? await ChatMessage.findOne({ _id: messageId, tournament: tournamentId }).select("_id createdAt").lean()
        : await ChatMessage.findOne({ tournament: tournamentId }).sort({ createdAt: -1 }).select("_id createdAt").lean();

    const lastReadAt = lastMessage?.createdAt || new Date();
    await ChatReadState.findOneAndUpdate(
        { tournament: tournamentId, user: user._id },
        { $set: { lastReadMessage: lastMessage?._id || null, lastReadAt, unreadCount: 0 } },
        { upsert: true, new: true }
    );

    if (lastMessage?._id) {
        await ChatMessage.updateOne(
            { _id: lastMessage._id, "seenBy.user": { $ne: user._id } },
            { $push: { seenBy: { user: user._id, seenAt: new Date() } } }
        );
    }

    return {
        tournamentId: asId(context.tournament._id),
        userId: asId(user._id),
        messageId: asId(lastMessage?._id),
        lastReadAt,
        unreadCount: 0,
    };
};

export const moderateChatRoom = async ({ user, tournamentId, action, targetUser, reason = "", durationMinutes = 0, slowModeSeconds = 0, body = "" }) => {
    const context = await getChatAccessContext(user, tournamentId, { ignoreBan: true });
    if (!context.permissions.canModerate) throw new ApiError(403, "Only creator or admin can moderate this chat");

    const now = new Date();
    const cleanReason = sanitizeText(reason, 300);
    const duration = normalizeDurationMinutes(durationMinutes);
    const expiresAt = duration ? new Date(Date.now() + duration * 60 * 1000) : null;
    const targetId = targetUser && mongoose.Types.ObjectId.isValid(targetUser) ? targetUser : null;
    const state = await getOrCreateChatRoomState(tournamentId);

    if (["mute", "ban", "unmute", "unban"].includes(action) && !targetId) {
        throw new ApiError(400, "Target user is required");
    }

    if (action === "mute") {
        state.mutedUsers = state.mutedUsers.filter((entry) => !sameId(entry.user, targetId));
        state.mutedUsers.push({ user: targetId, by: user._id, reason: cleanReason, until: expiresAt, createdAt: now });
    } else if (action === "unmute") {
        state.mutedUsers = state.mutedUsers.filter((entry) => !sameId(entry.user, targetId));
    } else if (action === "ban") {
        state.bannedUsers = state.bannedUsers.filter((entry) => !sameId(entry.user, targetId));
        state.bannedUsers.push({ user: targetId, by: user._id, reason: cleanReason, until: expiresAt, createdAt: now });
    } else if (action === "unban") {
        state.bannedUsers = state.bannedUsers.filter((entry) => !sameId(entry.user, targetId));
    } else if (action === "slow_mode") {
        state.slowModeSeconds = Math.min(Math.max(Number(slowModeSeconds) || 0, 0), 300);
    } else if (action === "announcement") {
        state.announcement = { body: sanitizeText(body, 400), by: user._id, createdAt: now };
    } else {
        throw new ApiError(400, "Unsupported moderation action");
    }

    await state.save();
    const log = await ChatModerationLog.create({
        tournament: tournamentId,
        actor: user._id,
        targetUser: targetId,
        action,
        reason: cleanReason,
        expiresAt,
        metadata: action === "slow_mode" ? { slowModeSeconds: state.slowModeSeconds } : {},
    });

    const systemBody = action === "announcement"
        ? state.announcement.body
        : `${action.replace("_", " ")} updated`;
    const systemMessage = await createSystemChatMessage({
        tournamentId,
        body: systemBody,
        type: action === "announcement" ? "announcement" : "system",
        metadata: { action, targetUser: targetId, slowModeSeconds: state.slowModeSeconds },
    });

    return {
        state,
        log,
        systemMessage,
    };
};

export const reportChatMessage = async ({ user, messageId, reason = "" }) => {
    const { message, context } = await getMessageWithContext(user, messageId);
    const cleanReason = sanitizeText(reason, 300);
    if (!cleanReason || cleanReason.length < 5) throw new ApiError(400, "Report reason is required");

    const log = await ChatModerationLog.create({
        tournament: message.tournament,
        actor: user._id,
        targetUser: message.sender || null,
        message: message._id,
        action: "report_message",
        reason: cleanReason,
    });

    return {
        log,
        tournamentId: asId(context.tournament._id),
        messageId: asId(message._id),
    };
};
