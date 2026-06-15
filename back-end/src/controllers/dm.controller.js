import path from "path";
import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
    acceptMessageRequest,
    blockDmConversation,
    deleteDmConversationForUser,
    declineMessageRequest,
    getConversationForUser,
    getDmMessages,
    getDmRoomName,
    getDmSettings,
    getDmUnreadTotal,
    listDmConversations,
    markDmDelivered,
    markDmRead,
    reportDmConversation,
    serializeConversation,
    sendDmMessage,
    startDmConversation,
    updateConversationPreferences,
    updateDmSettings,
} from "../services/dm.service.js";
import { getSocketServer, getUserRoom } from "../services/socket.service.js";
import {
    buildChatFileName,
    sanitizeFolderName,
    uploadToTeleStore,
} from "../services/storage/telestore.service.js";

const MAX_UPLOAD_BYTES = Number(process.env.DM_UPLOAD_MAX_BYTES || 5 * 1024 * 1024);
const ALLOWED_UPLOAD_TYPES = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
    ["application/pdf", "pdf"],
    ["text/plain", "txt"],
    ["application/zip", "zip"],
]);

const participantIdsFromConversation = (conversation) =>
    (conversation?.participants || [])
        .map((participant) => participant?.user?._id || participant?.user)
        .filter(Boolean)
        .map((id) => id.toString());

const emitUnreadToUsers = async (userIds = []) => {
    const io = getSocketServer();
    if (!io) return;
    await Promise.all(
        [...new Set(userIds)].map(async (userId) => {
            const count = await getDmUnreadTotal(userId).catch(() => null);
            if (count !== null) io.to(getUserRoom(userId)).emit("dm:unread", { count });
        })
    );
};

const emitConversationUpdate = async (conversation, event = "conversation:update") => {
    const io = getSocketServer();
    if (!io || !conversation?._id) return;
    const participantIds = participantIdsFromConversation(conversation);
    participantIds.forEach((userId) => io.to(getUserRoom(userId)).emit(event, { conversationId: conversation._id, conversation }));
    await emitUnreadToUsers(participantIds);
};

const emitMessageUpdate = async (conversation, message) => {
    const io = getSocketServer();
    if (!io || !conversation?._id || !message?._id) return;
    io.to(getDmRoomName(conversation._id)).emit("message:receive", { conversationId: conversation._id, message });
    await emitConversationUpdate(conversation);
};

export const listConversations = asyncHandler(async (req, res) => {
    const data = await listDmConversations({
        userId: req.user._id,
        q: req.query.q,
        status: req.query.status,
        limit: req.query.limit,
    });
    return res.status(200).json(new ApiResponse(200, data, "Conversations loaded"));
});

export const getConversation = asyncHandler(async (req, res) => {
    const conversation = await getConversationForUser(req.params.conversationId, req.user._id);
    return res.status(200).json(new ApiResponse(200, serializeConversation(conversation, req.user._id), "Conversation loaded"));
});

export const createConversation = asyncHandler(async (req, res) => {
    const data = await startDmConversation({
        user: req.user,
        targetUserId: req.body?.targetUserId,
        initialMessage: req.body?.initialMessage,
        metadata: req.body?.metadata,
    });
    await emitConversationUpdate(data.conversation, "conversation:created");
    if (data.message) await emitMessageUpdate(data.conversation, data.message);
    return res.status(201).json(new ApiResponse(201, data, "Conversation ready"));
});

export const listMessages = asyncHandler(async (req, res) => {
    const data = await getDmMessages({
        userId: req.user._id,
        conversationId: req.params.conversationId,
        before: req.query.before,
        limit: req.query.limit,
    });
    return res.status(200).json(new ApiResponse(200, data, "Messages loaded"));
});

export const sendMessage = asyncHandler(async (req, res) => {
    const data = await sendDmMessage({
        user: req.user,
        conversationId: req.params.conversationId,
        body: req.body?.body,
        type: req.body?.type,
        attachments: req.body?.attachments,
        replyTo: req.body?.replyTo,
        metadata: req.body?.metadata,
        clientRequestId: req.body?.clientRequestId,
    });
    await emitMessageUpdate(data.conversation, data.message);
    return res.status(201).json(new ApiResponse(201, data.message, data.idempotent ? "Message already sent" : "Message sent"));
});

export const markDelivered = asyncHandler(async (req, res) => {
    const data = await markDmDelivered({
        userId: req.user._id,
        conversationId: req.params.conversationId,
    });
    getSocketServer()?.to(getDmRoomName(req.params.conversationId)).emit("message:delivered", data);
    return res.status(200).json(new ApiResponse(200, data, "Messages marked delivered"));
});

export const markRead = asyncHandler(async (req, res) => {
    const data = await markDmRead({
        userId: req.user._id,
        conversationId: req.params.conversationId,
    });
    const io = getSocketServer();
    io?.to(getDmRoomName(req.params.conversationId)).emit("message:read", data);
    await emitUnreadToUsers([req.user._id]);
    return res.status(200).json(new ApiResponse(200, data, "Conversation marked read"));
});

export const updatePreferences = asyncHandler(async (req, res) => {
    const conversation = await updateConversationPreferences({
        userId: req.user._id,
        conversationId: req.params.conversationId,
        pinned: req.body?.pinned,
        muted: req.body?.muted,
        archived: req.body?.archived,
    });
    await emitConversationUpdate(conversation);
    return res.status(200).json(new ApiResponse(200, conversation, "Conversation updated"));
});

export const acceptRequest = asyncHandler(async (req, res) => {
    const conversation = await acceptMessageRequest({
        userId: req.user._id,
        conversationId: req.params.conversationId,
    });
    await emitConversationUpdate(conversation, "conversation:accepted");
    return res.status(200).json(new ApiResponse(200, conversation, "Message request accepted"));
});

export const declineRequest = asyncHandler(async (req, res) => {
    const data = await declineMessageRequest({
        userId: req.user._id,
        conversationId: req.params.conversationId,
    });
    getSocketServer()?.to(getDmRoomName(req.params.conversationId)).emit("conversation:declined", data);
    await emitUnreadToUsers([req.user._id]);
    return res.status(200).json(new ApiResponse(200, data, "Message request declined"));
});

export const blockConversation = asyncHandler(async (req, res) => {
    const conversation = await blockDmConversation({
        userId: req.user._id,
        conversationId: req.params.conversationId,
        reason: req.body?.reason,
    });
    getSocketServer()?.to(getDmRoomName(req.params.conversationId)).emit("conversation:block", {
        conversationId: conversation._id,
        conversation,
    });
    return res.status(200).json(new ApiResponse(200, conversation, "User blocked"));
});

export const deleteConversation = asyncHandler(async (req, res) => {
    const data = await deleteDmConversationForUser({
        userId: req.user._id,
        conversationId: req.params.conversationId,
    });
    getSocketServer()?.to(getUserRoom(req.user._id)).emit("conversation:delete", data);
    await emitUnreadToUsers([req.user._id]);
    return res.status(200).json(new ApiResponse(200, data, "Conversation deleted"));
});

export const reportConversation = asyncHandler(async (req, res) => {
    const data = await reportDmConversation({
        userId: req.user._id,
        conversationId: req.params.conversationId,
        reason: req.body?.reason,
        message: req.body?.message,
    });
    return res.status(201).json(new ApiResponse(201, data, "Report submitted"));
});

export const getUnreadCount = asyncHandler(async (req, res) => {
    const count = await getDmUnreadTotal(req.user._id);
    return res.status(200).json(new ApiResponse(200, { count }, "Unread count loaded"));
});

export const getSettings = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, getDmSettings(req.user), "DM settings loaded"));
});

export const updateSettings = asyncHandler(async (req, res) => {
    const data = await updateDmSettings({
        userId: req.user._id,
        privacy: req.body?.privacy,
        readReceipts: req.body?.readReceipts,
        onlineStatus: req.body?.onlineStatus,
    });
    return res.status(200).json(new ApiResponse(200, data, "DM settings updated"));
});

const decodeFileName = (value = "Attachment") => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

const buildDmFolderPath = (conversation, user) => {
    const conversationId = String(conversation?._id || "unknown");
    const names = (conversation?.participants || [])
        .map((participant) => participant?.user?.username)
        .filter(Boolean)
        .slice(0, 2);

    return [
        process.env.TELESTORE_DM_ROOT_FOLDER_NAME || "Battle4Arena Direct Messages",
        sanitizeFolderName(`${names.join(" with ") || user?.username || "Conversation"} - ${conversationId.slice(-8)}`),
    ];
};

export const uploadAttachment = asyncHandler(async (req, res) => {
    const conversation = await getConversationForUser(req.params.conversationId, req.user._id);
    if ((conversation.blockedBy || []).length) throw new ApiError(403, "This conversation is blocked");

    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer?.length) throw new ApiError(400, "Attachment file is required");
    if (buffer.length > MAX_UPLOAD_BYTES) throw new ApiError(413, "Attachment is too large");

    const mimeType = String(req.headers["content-type"] || "application/octet-stream").split(";")[0].toLowerCase();
    const ext = ALLOWED_UPLOAD_TYPES.get(mimeType);
    if (!ext) throw new ApiError(400, "Unsupported attachment type");

    const originalName = decodeFileName(String(req.header("x-file-name") || "Attachment"))
        .replace(/[^\w.\-()\s]/g, "")
        .trim()
        .slice(0, 120) || "Attachment";

    const fileName = buildChatFileName({ originalName, ext, user: req.user });
    const uploaded = await uploadToTeleStore({
        buffer,
        fileName,
        originalName,
        mimeType,
        folderPath: buildDmFolderPath(conversation, req.user),
        tags: ["battle4arena", "dm", mimeType.startsWith("image/") ? "image" : "file"].filter(Boolean),
        metadata: {
            conversationId: req.params.conversationId,
            uploadedBy: req.user._id?.toString?.(),
            originalExtension: path.extname(originalName),
        },
    });

    const data = {
        type: mimeType.startsWith("image/") ? "image" : "file",
        url: uploaded.publicUrl || uploaded.downloadUrl || uploaded.apiUrl,
        name: originalName,
        mimeType,
        size: buffer.length,
        storageProvider: uploaded.provider,
        mediaId: uploaded.mediaId,
        apiUrl: uploaded.apiUrl,
        downloadUrl: uploaded.downloadUrl,
        thumbUrl: uploaded.thumbUrl,
        folderId: uploaded.folderId,
        folderName: uploaded.folderName,
    };

    return res.status(201).json(new ApiResponse(201, data, "Attachment uploaded"));
});
