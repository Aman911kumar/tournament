import fs from "fs/promises";
import path from "path";
import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
    createChatMessage,
    deleteChatMessage,
    editChatMessage,
    getChatAccessContext,
    getChatMessages,
    getChatRoomName,
    markChatRead,
    moderateChatRoom,
    pinChatMessage,
    reportChatMessage,
    serializeChatAccess,
    toggleReaction,
    unpinChatMessage,
} from "../services/chat.service.js";
import { getSocketServer, getUserRoom } from "../services/socket.service.js";
import {
    buildChatFileName,
    buildChatFolderPath,
    uploadToTeleStore,
} from "../services/storage/telestore.service.js";

const MAX_UPLOAD_BYTES = Number(process.env.CHAT_UPLOAD_MAX_BYTES || 5 * 1024 * 1024);
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || "uploads");
const CHAT_UPLOAD_DIR = path.join(UPLOAD_ROOT, "chat");
const ALLOWED_UPLOAD_TYPES = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
    ["application/pdf", "pdf"],
    ["text/plain", "txt"],
    ["application/zip", "zip"],
]);

const socketUser = (req) => ({
    _id: req.user._id,
    role: req.user.role || [],
});

const emitRoom = (tournamentId, event, payload) => {
    const io = getSocketServer();
    if (!io) return;
    io.to(getChatRoomName(tournamentId)).emit(event, payload);
};

const emitUnreadNotifications = ({ tournamentId, message, participantIds = [], senderId }) => {
    const io = getSocketServer();
    if (!io) return;
    participantIds
        .filter((id) => id && id !== senderId)
        .forEach((id) => {
            io.to(getUserRoom(id)).emit("chat:notify", {
                tournamentId,
                message,
            });
        });
};

const getUploadPublicUrl = (req, relativePath) => {
    const configuredBase = String(process.env.PUBLIC_API_URL || process.env.CHAT_UPLOAD_PUBLIC_BASE_URL || "").replace(/\/$/, "");
    const origin = configuredBase || `${req.protocol}://${req.get("host")}`;
    return `${origin}/${relativePath.replace(/\\/g, "/").replace(/^\/+/, "")}`;
};

const getChatStorageProvider = () => String(process.env.CHAT_STORAGE_PROVIDER || "telestore").toLowerCase();
const shouldFallbackToLocalStorage = () => String(process.env.CHAT_STORAGE_LOCAL_FALLBACK || "false").toLowerCase() === "true";

const storeAttachmentLocally = async ({ req, buffer, mimeType, ext, originalName, fileName }) => {
    const tournamentDir = path.join(CHAT_UPLOAD_DIR, req.params.tournamentId);
    await fs.mkdir(tournamentDir, { recursive: true });

    const absolutePath = path.join(tournamentDir, fileName);
    await fs.writeFile(absolutePath, buffer, { flag: "wx" });

    const relativePath = path.relative(UPLOAD_ROOT, absolutePath);
    return {
        type: mimeType.startsWith("image/") ? "image" : "file",
        url: getUploadPublicUrl(req, path.join("uploads", relativePath)),
        name: originalName,
        mimeType,
        size: buffer.length,
        storageProvider: "local",
        folderName: path.join("uploads", "chat", req.params.tournamentId).replace(/\\/g, "/"),
    };
};

export const getChatAccess = asyncHandler(async (req, res) => {
    const context = await getChatAccessContext(req.user, req.params.tournamentId);
    const data = await serializeChatAccess(context, req.user._id);
    return res.status(200).json(new ApiResponse(200, data, "Chat access loaded"));
});

export const listChatMessages = asyncHandler(async (req, res) => {
    const data = await getChatMessages({
        user: req.user,
        tournamentId: req.params.tournamentId,
        before: req.query.before,
        limit: req.query.limit,
    });
    return res.status(200).json(new ApiResponse(200, data, "Messages loaded"));
});

export const sendChatMessage = asyncHandler(async (req, res) => {
    const result = await createChatMessage({
        user: req.user,
        tournamentId: req.params.tournamentId,
        body: req.body?.body,
        attachments: req.body?.attachments,
        replyTo: req.body?.replyTo,
        mentions: req.body?.mentions,
        type: req.body?.type,
        metadata: req.body?.metadata,
    });

    emitRoom(req.params.tournamentId, "chat:message", result.message);
    emitUnreadNotifications({
        tournamentId: req.params.tournamentId,
        message: result.message,
        participantIds: result.participantIds,
        senderId: req.user._id.toString(),
    });

    return res.status(201).json(new ApiResponse(201, result.message, "Message sent"));
});

export const updateChatMessage = asyncHandler(async (req, res) => {
    const message = await editChatMessage({
        user: req.user,
        messageId: req.params.messageId,
        body: req.body?.body,
    });
    emitRoom(message.tournament, "chat:message:updated", message);
    return res.status(200).json(new ApiResponse(200, message, "Message updated"));
});

export const removeChatMessage = asyncHandler(async (req, res) => {
    const message = await deleteChatMessage({
        user: req.user,
        messageId: req.params.messageId,
    });
    emitRoom(message.tournament, "chat:message:deleted", message);
    return res.status(200).json(new ApiResponse(200, message, "Message deleted"));
});

export const reactToChatMessage = asyncHandler(async (req, res) => {
    const message = await toggleReaction({
        user: req.user,
        messageId: req.params.messageId,
        emoji: req.body?.emoji,
    });
    emitRoom(message.tournament, "chat:reaction", message);
    return res.status(200).json(new ApiResponse(200, message, "Reaction updated"));
});

export const pinMessage = asyncHandler(async (req, res) => {
    const message = await pinChatMessage({
        user: req.user,
        messageId: req.params.messageId,
    });
    emitRoom(message.tournament, "chat:pinned", message);
    return res.status(200).json(new ApiResponse(200, message, "Message pinned"));
});

export const unpinMessage = asyncHandler(async (req, res) => {
    const data = await unpinChatMessage({
        user: req.user,
        tournamentId: req.params.tournamentId,
    });
    emitRoom(req.params.tournamentId, "chat:unpinned", data);
    return res.status(200).json(new ApiResponse(200, data, "Message unpinned"));
});

export const markRoomRead = asyncHandler(async (req, res) => {
    const data = await markChatRead({
        user: req.user,
        tournamentId: req.params.tournamentId,
        messageId: req.body?.messageId,
    });
    emitRoom(req.params.tournamentId, "chat:read", data);
    return res.status(200).json(new ApiResponse(200, data, "Chat marked as read"));
});

export const moderateRoomChat = asyncHandler(async (req, res) => {
    const result = await moderateChatRoom({
        user: req.user,
        tournamentId: req.params.tournamentId,
        action: req.body?.action,
        targetUser: req.body?.targetUser,
        reason: req.body?.reason,
        durationMinutes: req.body?.durationMinutes,
        slowModeSeconds: req.body?.slowModeSeconds,
        body: req.body?.body,
    });
    emitRoom(req.params.tournamentId, "chat:moderation", {
        action: req.body?.action,
        state: {
            slowModeSeconds: result.state.slowModeSeconds,
            announcement: result.state.announcement,
        },
        systemMessage: result.systemMessage,
    });
    emitRoom(req.params.tournamentId, "chat:message", result.systemMessage);
    if (req.body?.action === "ban" && req.body?.targetUser) {
        const io = getSocketServer();
        const roomName = getChatRoomName(req.params.tournamentId);
        io?.to(getUserRoom(req.body.targetUser)).emit("chat:force-leave", {
            tournamentId: req.params.tournamentId,
            reason: "You were banned from this room chat",
        });
        io?.in(getUserRoom(req.body.targetUser)).socketsLeave(roomName);
    }
    return res.status(200).json(new ApiResponse(200, result, "Chat moderation updated"));
});

export const reportMessage = asyncHandler(async (req, res) => {
    const data = await reportChatMessage({
        user: req.user,
        messageId: req.params.messageId,
        reason: req.body?.reason,
    });
    return res.status(201).json(new ApiResponse(201, data, "Message reported"));
});

export const uploadChatAttachment = asyncHandler(async (req, res) => {
    const context = await getChatAccessContext(req.user, req.params.tournamentId);
    if (!context.permissions.canSend) {
        throw new ApiError(403, "You cannot upload attachments in this room");
    }

    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer?.length) throw new ApiError(400, "Attachment file is required");
    if (buffer.length > MAX_UPLOAD_BYTES) throw new ApiError(413, "Attachment is too large");

    const mimeType = String(req.headers["content-type"] || "application/octet-stream").split(";")[0].toLowerCase();
    const ext = ALLOWED_UPLOAD_TYPES.get(mimeType);
    if (!ext) throw new ApiError(400, "Unsupported attachment type");

    const encodedName = String(req.header("x-file-name") || "Attachment");
    const decodedName = (() => {
        try {
            return decodeURIComponent(encodedName);
        } catch {
            return encodedName;
        }
    })();
    const originalName = decodedName
        .replace(/[^\w.\-()\s]/g, "")
        .trim()
        .slice(0, 120) || "Attachment";

    const fileName = buildChatFileName({ originalName, ext, user: req.user });
    const provider = getChatStorageProvider();
    let data;

    if (provider === "telestore") {
        try {
            const folderPath = buildChatFolderPath({ tournament: context.tournament });
            const uploaded = await uploadToTeleStore({
                buffer,
                fileName,
                originalName,
                mimeType,
                folderPath,
                tags: ["battle4arena", "chat", "tournament", context.tournament.game].filter(Boolean),
                metadata: {
                    tournamentId: req.params.tournamentId,
                    tournamentTitle: context.tournament.title,
                    game: context.tournament.game,
                    uploadedBy: req.user._id?.toString?.(),
                },
            });

            data = {
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
        } catch (error) {
            if (!shouldFallbackToLocalStorage()) throw error;
            console.warn("TeleStore chat upload failed; falling back to local storage", {
                tournamentId: req.params.tournamentId,
                message: error?.message,
            });
            data = await storeAttachmentLocally({ req, buffer, mimeType, ext, originalName, fileName });
        }
    } else {
        data = await storeAttachmentLocally({ req, buffer, mimeType, ext, originalName, fileName });
    }

    return res.status(201).json(new ApiResponse(201, data, "Attachment uploaded"));
});
