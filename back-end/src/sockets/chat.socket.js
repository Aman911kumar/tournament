import ApiError from "../utils/ApiError.js";
import {
    createChatMessage,
    deleteChatMessage,
    editChatMessage,
    getChatAccessContext,
    getChatRoomName,
    markChatRead,
    moderateChatRoom,
    pinChatMessage,
    serializeChatAccess,
    toggleReaction,
    unpinChatMessage,
} from "../services/chat.service.js";

const presenceByRoom = new Map();
const voiceByRoom = new Map();
const socketRooms = new WeakMap();
const voiceSocketRooms = new WeakMap();
const sendBuckets = new WeakMap();
const EVENT_RATE_WINDOW_MS = 10_000;
const EVENT_RATE_MAX = 12;

const asId = (value) => value?._id?.toString?.() || value?.toString?.() || "";
const getUserRoomName = (userId) => `user:${userId}`;
const getVoiceRoomName = (tournamentId) => `voice:tournament:${tournamentId}`;

const getSocketUser = (socket) => ({
    _id: socket.userId,
    role: socket.userRoles || [],
});

const getSocketUserSummary = (socket) => ({
    userId: socket.userId,
    username: socket.userProfile?.username || "Player",
    avatar: socket.userProfile?.avatar || {},
    role: socket.userRoles || [],
});

const ack = (callback, payload) => {
    if (typeof callback === "function") callback(payload);
};

const toSocketError = (error) => ({
    ok: false,
    status: error instanceof ApiError ? error.statusCode : 500,
    message: error?.message || "Chat action failed",
});

const assertEventRate = (socket) => {
    const now = Date.now();
    const bucket = (sendBuckets.get(socket) || []).filter((time) => now - time < EVENT_RATE_WINDOW_MS);
    bucket.push(now);
    sendBuckets.set(socket, bucket);
    if (bucket.length > EVENT_RATE_MAX) {
        throw new ApiError(429, "You are sending messages too fast");
    }
};

const getJoinedRooms = (socket) => {
    let rooms = socketRooms.get(socket);
    if (!rooms) {
        rooms = new Set();
        socketRooms.set(socket, rooms);
    }
    return rooms;
};

const getJoinedVoiceRooms = (socket) => {
    let rooms = voiceSocketRooms.get(socket);
    if (!rooms) {
        rooms = new Set();
        voiceSocketRooms.set(socket, rooms);
    }
    return rooms;
};

const getPresencePayload = (tournamentId) => {
    const roomName = getChatRoomName(tournamentId);
    const users = [...(presenceByRoom.get(roomName) || new Map()).entries()]
        .map(([userId, count]) => ({ userId, online: count > 0 }))
        .filter((item) => item.online);
    return {
        tournamentId: asId(tournamentId),
        onlineCount: users.length,
        users,
    };
};

const increasePresence = (socket, tournamentId) => {
    const roomName = getChatRoomName(tournamentId);
    const userId = socket.userId;
    const roomPresence = presenceByRoom.get(roomName) || new Map();
    roomPresence.set(userId, (roomPresence.get(userId) || 0) + 1);
    presenceByRoom.set(roomName, roomPresence);
    getJoinedRooms(socket).add(asId(tournamentId));
};

const decreasePresence = (socket, tournamentId) => {
    const roomName = getChatRoomName(tournamentId);
    const userId = socket.userId;
    const roomPresence = presenceByRoom.get(roomName);
    if (!roomPresence) return;
    const nextCount = Math.max(0, (roomPresence.get(userId) || 0) - 1);
    if (nextCount > 0) roomPresence.set(userId, nextCount);
    else roomPresence.delete(userId);
    if (roomPresence.size === 0) presenceByRoom.delete(roomName);
    getJoinedRooms(socket).delete(asId(tournamentId));
};

const serializeVoiceParticipant = (participant) => ({
    userId: participant.userId,
    username: participant.username,
    avatar: participant.avatar,
    role: participant.role || [],
    muted: Boolean(participant.muted),
    speaking: Boolean(participant.speaking),
    joinedAt: participant.joinedAt,
});

const getVoiceParticipants = (tournamentId) => {
    const roomName = getVoiceRoomName(tournamentId);
    return [...(voiceByRoom.get(roomName) || new Map()).values()]
        .map(serializeVoiceParticipant)
        .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
};

const upsertVoiceParticipant = (socket, tournamentId, muted = false) => {
    const roomName = getVoiceRoomName(tournamentId);
    const userId = socket.userId;
    const roomVoice = voiceByRoom.get(roomName) || new Map();
    const existing = roomVoice.get(userId);
    const socketIds = existing?.socketIds instanceof Set ? existing.socketIds : new Set();
    socketIds.add(socket.id);
    const summary = getSocketUserSummary(socket);

    roomVoice.set(userId, {
        ...summary,
        socketIds,
        muted: Boolean(existing?.muted ?? muted),
        speaking: Boolean(existing?.speaking),
        joinedAt: existing?.joinedAt || new Date().toISOString(),
    });
    voiceByRoom.set(roomName, roomVoice);
    getJoinedVoiceRooms(socket).add(asId(tournamentId));
};

const updateVoiceParticipant = (socket, tournamentId, patch = {}) => {
    const roomName = getVoiceRoomName(tournamentId);
    const roomVoice = voiceByRoom.get(roomName);
    const participant = roomVoice?.get(socket.userId);
    if (!participant) return null;
    const next = {
        ...participant,
        muted: typeof patch.muted === "boolean" ? patch.muted : participant.muted,
        speaking: typeof patch.speaking === "boolean" ? patch.speaking : participant.speaking,
    };
    roomVoice.set(socket.userId, next);
    return serializeVoiceParticipant(next);
};

const removeVoiceParticipant = (socket, tournamentId) => {
    const roomName = getVoiceRoomName(tournamentId);
    const roomVoice = voiceByRoom.get(roomName);
    if (!roomVoice) return null;
    const participant = roomVoice.get(socket.userId);
    if (!participant) return null;

    participant.socketIds?.delete?.(socket.id);
    if (participant.socketIds?.size > 0) {
        roomVoice.set(socket.userId, participant);
        return null;
    }

    roomVoice.delete(socket.userId);
    if (roomVoice.size === 0) voiceByRoom.delete(roomName);
    getJoinedVoiceRooms(socket).delete(asId(tournamentId));
    return serializeVoiceParticipant(participant);
};

const leaveAllChatRooms = (io, socket) => {
    const joined = [...getJoinedRooms(socket)];
    joined.forEach((tournamentId) => {
        const roomName = getChatRoomName(tournamentId);
        decreasePresence(socket, tournamentId);
        socket.leave(roomName);
        io.to(roomName).emit("chat:presence", getPresencePayload(tournamentId));
    });
};

const leaveAllVoiceRooms = (io, socket) => {
    const joined = [...getJoinedVoiceRooms(socket)];
    joined.forEach((tournamentId) => {
        const roomName = getVoiceRoomName(tournamentId);
        const removed = removeVoiceParticipant(socket, tournamentId);
        socket.leave(roomName);
        if (removed) {
            io.to(roomName).emit("voice:participant-left", {
                tournamentId,
                userId: removed.userId,
                participants: getVoiceParticipants(tournamentId),
            });
        }
    });
};

const emitUnreadNotifications = (io, { tournamentId, message, participantIds = [], senderId }) => {
    participantIds
        .filter((id) => id && id !== senderId)
        .forEach((id) => {
            io.to(getUserRoomName(id)).emit("chat:notify", {
                tournamentId,
                message,
            });
        });
};

const runSocketAction = (socket, callback, action) => {
    Promise.resolve(action())
        .then((data) => ack(callback, { ok: true, data }))
        .catch((error) => {
            ack(callback, toSocketError(error));
            socket.emit("chat:error", toSocketError(error));
        });
};

export const registerChatSocketHandlers = (io, socket) => {
    socket.on("chat:join", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const tournamentId = payload.tournamentId;
            const context = await getChatAccessContext(getSocketUser(socket), tournamentId);
            const roomName = getChatRoomName(context.tournament._id);
            const normalizedTournamentId = asId(context.tournament._id);

            socket.join(roomName);
            if (!getJoinedRooms(socket).has(normalizedTournamentId)) {
                increasePresence(socket, normalizedTournamentId);
            }

            const access = await serializeChatAccess(context, socket.userId);
            const presence = getPresencePayload(normalizedTournamentId);
            io.to(roomName).emit("chat:presence", presence);
            socket.emit("chat:joined", { access, presence });

            return { access, presence };
        });
    });

    socket.on("chat:leave", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const tournamentId = payload.tournamentId;
            const roomName = getChatRoomName(tournamentId);
            decreasePresence(socket, tournamentId);
            socket.leave(roomName);
            io.to(roomName).emit("chat:presence", getPresencePayload(tournamentId));
            return { tournamentId };
        });
    });

    socket.on("chat:typing", (payload = {}) => {
        const tournamentId = payload.tournamentId;
        if (!tournamentId) return;
        if (!getJoinedRooms(socket).has(asId(tournamentId))) return;
        const roomName = getChatRoomName(tournamentId);
        socket.to(roomName).emit("chat:typing", {
            tournamentId,
            userId: socket.userId,
            isTyping: Boolean(payload.isTyping),
        });
    });

    socket.on("chat:message", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            assertEventRate(socket);
            const result = await createChatMessage({
                user: getSocketUser(socket),
                tournamentId: payload.tournamentId,
                body: payload.body,
                attachments: payload.attachments,
                replyTo: payload.replyTo,
                mentions: payload.mentions,
                type: payload.type,
                metadata: payload.metadata,
            });
            const roomName = getChatRoomName(payload.tournamentId);
            io.to(roomName).emit("chat:message", result.message);
            emitUnreadNotifications(io, {
                tournamentId: payload.tournamentId,
                message: result.message,
                participantIds: result.participantIds,
                senderId: socket.userId,
            });
            return result.message;
        });
    });

    socket.on("chat:edit", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const message = await editChatMessage({
                user: getSocketUser(socket),
                messageId: payload.messageId,
                body: payload.body,
            });
            io.to(getChatRoomName(message.tournament)).emit("chat:message:updated", message);
            return message;
        });
    });

    socket.on("chat:delete", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const message = await deleteChatMessage({
                user: getSocketUser(socket),
                messageId: payload.messageId,
            });
            io.to(getChatRoomName(message.tournament)).emit("chat:message:deleted", message);
            return message;
        });
    });

    socket.on("chat:reaction", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const message = await toggleReaction({
                user: getSocketUser(socket),
                messageId: payload.messageId,
                emoji: payload.emoji,
            });
            io.to(getChatRoomName(message.tournament)).emit("chat:reaction", message);
            return message;
        });
    });

    socket.on("chat:pin", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const message = await pinChatMessage({
                user: getSocketUser(socket),
                messageId: payload.messageId,
            });
            io.to(getChatRoomName(message.tournament)).emit("chat:pinned", message);
            return message;
        });
    });

    socket.on("chat:unpin", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const data = await unpinChatMessage({
                user: getSocketUser(socket),
                tournamentId: payload.tournamentId,
            });
            io.to(getChatRoomName(payload.tournamentId)).emit("chat:unpinned", data);
            return data;
        });
    });

    socket.on("chat:read", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const data = await markChatRead({
                user: getSocketUser(socket),
                tournamentId: payload.tournamentId,
                messageId: payload.messageId,
            });
            io.to(getChatRoomName(payload.tournamentId)).emit("chat:read", data);
            return data;
        });
    });

    socket.on("chat:moderate", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const result = await moderateChatRoom({
                user: getSocketUser(socket),
                tournamentId: payload.tournamentId,
                action: payload.action,
                targetUser: payload.targetUser,
                reason: payload.reason,
                durationMinutes: payload.durationMinutes,
                slowModeSeconds: payload.slowModeSeconds,
                body: payload.body,
            });
            const roomName = getChatRoomName(payload.tournamentId);
            const moderationPayload = {
                action: payload.action,
                state: {
                    slowModeSeconds: result.state.slowModeSeconds,
                    announcement: result.state.announcement,
                },
                systemMessage: result.systemMessage,
            };
            io.to(roomName).emit("chat:moderation", moderationPayload);
            io.to(roomName).emit("chat:message", result.systemMessage);
            if (payload.action === "ban" && payload.targetUser) {
                io.to(getUserRoomName(payload.targetUser)).emit("chat:force-leave", {
                    tournamentId: payload.tournamentId,
                    reason: "You were banned from this room chat",
                });
                io.in(getUserRoomName(payload.targetUser)).socketsLeave(roomName);
            }
            return moderationPayload;
        });
    });

    socket.on("chat:share-room", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const context = await getChatAccessContext(getSocketUser(socket), payload.tournamentId);
            if (!context.permissions.canShareRoomCard) {
                throw new ApiError(403, "Only creator or admin can share room details");
            }
            const room = context.tournament.room_details || {};
            const result = await createChatMessage({
                user: getSocketUser(socket),
                tournamentId: payload.tournamentId,
                body: "Room details shared",
                type: "room_card",
                metadata: {
                    roomId: room.roomId || "",
                    roomPass: room.roomPass || "",
                    roomJoinTime: room.roomJoinTime || null,
                },
            });
            io.to(getChatRoomName(payload.tournamentId)).emit("chat:message", result.message);
            emitUnreadNotifications(io, {
                tournamentId: payload.tournamentId,
                message: result.message,
                participantIds: result.participantIds,
                senderId: socket.userId,
            });
            return result.message;
        });
    });

    socket.on("voice:join", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const tournamentId = payload.tournamentId;
            const context = await getChatAccessContext(getSocketUser(socket), tournamentId);
            const normalizedTournamentId = asId(context.tournament._id);
            const roomName = getVoiceRoomName(normalizedTournamentId);

            socket.join(roomName);
            upsertVoiceParticipant(socket, normalizedTournamentId, Boolean(payload.muted));
            const participant = updateVoiceParticipant(socket, normalizedTournamentId, { muted: Boolean(payload.muted), speaking: false });
            const participants = getVoiceParticipants(normalizedTournamentId);

            socket.emit("voice:snapshot", { tournamentId: normalizedTournamentId, participants });
            socket.to(roomName).emit("voice:participant-joined", {
                tournamentId: normalizedTournamentId,
                participant,
                participants,
            });

            return { tournamentId: normalizedTournamentId, participants };
        });
    });

    socket.on("voice:leave", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const tournamentId = asId(payload.tournamentId);
            const roomName = getVoiceRoomName(tournamentId);
            const removed = removeVoiceParticipant(socket, tournamentId);
            socket.leave(roomName);
            const participants = getVoiceParticipants(tournamentId);
            if (removed) {
                socket.to(roomName).emit("voice:participant-left", {
                    tournamentId,
                    userId: removed.userId,
                    participants,
                });
            }
            return { tournamentId, participants };
        });
    });

    socket.on("voice:state", (payload = {}) => {
        const tournamentId = asId(payload.tournamentId);
        if (!tournamentId || !getJoinedVoiceRooms(socket).has(tournamentId)) return;
        const participant = updateVoiceParticipant(socket, tournamentId, {
            muted: payload.muted,
            speaking: payload.speaking,
        });
        if (!participant) return;
        io.to(getVoiceRoomName(tournamentId)).emit("voice:state", {
            tournamentId,
            participant,
        });
    });

    socket.on("voice:signal", (payload = {}) => {
        const tournamentId = asId(payload.tournamentId);
        const to = asId(payload.to);
        if (!tournamentId || !to || !getJoinedVoiceRooms(socket).has(tournamentId)) return;
        const roomVoice = voiceByRoom.get(getVoiceRoomName(tournamentId));
        if (!roomVoice?.has(to)) return;

        io.to(getUserRoomName(to)).emit("voice:signal", {
            tournamentId,
            from: socket.userId,
            to,
            type: payload.type,
            sdp: payload.sdp,
            candidate: payload.candidate,
        });
    });

    socket.on("disconnect", () => {
        leaveAllVoiceRooms(io, socket);
        leaveAllChatRooms(io, socket);
    });
};
