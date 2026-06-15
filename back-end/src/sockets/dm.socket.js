import ApiError from "../utils/ApiError.js";
import {
    acceptMessageRequest,
    blockDmConversation,
    deleteDmConversationForUser,
    getConversationForUser,
    getDmRoomName,
    getDmUnreadTotal,
    markDmDelivered,
    markDmRead,
    sendDmMessage,
    startDmConversation,
    updateConversationPreferences,
} from "../services/dm.service.js";

const joinedDmRooms = new WeakMap();
const eventBuckets = new WeakMap();
const DM_EVENT_LIMITS = {
    "message:send": { windowMs: 10_000, max: 12 },
    "typing:start": { windowMs: 5_000, max: 10 },
    "typing:stop": { windowMs: 5_000, max: 10 },
    "message:read": { windowMs: 10_000, max: 12 },
    "conversation:create": { windowMs: 60_000, max: 12 },
};

const asId = (value) => value?._id?.toString?.() || value?.toString?.() || "";
const getUserRoomName = (userId) => `user:${userId}`;

const getSocketUser = (socket) => ({
    _id: socket.userId,
    username: socket.userProfile?.username || "Player",
    avatar: socket.userProfile?.avatar || {},
    role: socket.userRoles || [],
    isActive: true,
    accountStatus: "active",
});

const ack = (callback, payload) => {
    if (typeof callback === "function") callback(payload);
};

const toSocketError = (error) => ({
    ok: false,
    status: error instanceof ApiError ? error.statusCode : 500,
    message: error?.message || "Direct message action failed",
});

const getJoinedRooms = (socket) => {
    let rooms = joinedDmRooms.get(socket);
    if (!rooms) {
        rooms = new Set();
        joinedDmRooms.set(socket, rooms);
    }
    return rooms;
};

const assertEventRate = (socket, event) => {
    const config = DM_EVENT_LIMITS[event] || { windowMs: 10_000, max: 20 };
    const now = Date.now();
    const buckets = eventBuckets.get(socket) || new Map();
    const bucket = (buckets.get(event) || []).filter((time) => now - time < config.windowMs);
    bucket.push(now);
    buckets.set(event, bucket);
    eventBuckets.set(socket, buckets);
    if (bucket.length > config.max) throw new ApiError(429, "Direct message action rate limit exceeded");
};

const allowEvent = (socket, event) => {
    try {
        assertEventRate(socket, event);
        return true;
    } catch {
        return false;
    }
};

const runSocketAction = (socket, callback, action) => {
    Promise.resolve(action())
        .then((data) => ack(callback, { ok: true, data }))
        .catch((error) => {
            const payload = toSocketError(error);
            ack(callback, payload);
            socket.emit("dm:error", payload);
        });
};

const participantIdsFromConversation = (conversation) =>
    (conversation?.participants || [])
        .map((participant) => participant?.user?._id || participant?.user)
        .filter(Boolean)
        .map((id) => id.toString());

const emitUnreadToUsers = async (io, userIds = []) => {
    await Promise.all(
        [...new Set(userIds)].map(async (userId) => {
            const count = await getDmUnreadTotal(userId).catch(() => null);
            if (count !== null) io.to(getUserRoomName(userId)).emit("dm:unread", { count });
        })
    );
};

const emitConversationToUsers = async (io, conversation, event = "conversation:update") => {
    const userIds = participantIdsFromConversation(conversation);
    userIds.forEach((userId) => io.to(getUserRoomName(userId)).emit(event, {
        conversationId: conversation._id,
        conversation,
    }));
    await emitUnreadToUsers(io, userIds);
};

const joinConversationRoom = async (io, socket, conversationId) => {
    const conversation = await getConversationForUser(conversationId, socket.userId);
    const roomName = getDmRoomName(conversation._id);
    socket.join(roomName);
    getJoinedRooms(socket).add(asId(conversation._id));
    await markDmDelivered({ userId: socket.userId, conversationId: conversation._id }).catch(() => undefined);
    socket.emit("conversation:joined", { conversationId: asId(conversation._id) });
    return conversation;
};

const leaveAllDmRooms = (socket) => {
    [...getJoinedRooms(socket)].forEach((conversationId) => {
        socket.leave(getDmRoomName(conversationId));
    });
    getJoinedRooms(socket).clear();
};

export const registerDmSocketHandlers = (io, socket) => {
    socket.on("conversation:create", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            assertEventRate(socket, "conversation:create");
            const result = await startDmConversation({
                user: getSocketUser(socket),
                targetUserId: payload.targetUserId,
                initialMessage: payload.initialMessage,
                metadata: payload.metadata,
            });
            socket.join(getDmRoomName(result.conversation._id));
            getJoinedRooms(socket).add(result.conversation._id);
            await emitConversationToUsers(io, result.conversation, "conversation:created");
            if (result.message) {
                io.to(getDmRoomName(result.conversation._id)).emit("message:receive", {
                    conversationId: result.conversation._id,
                    message: result.message,
                });
            }
            return result;
        });
    });

    socket.on("conversation:join", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const conversation = await joinConversationRoom(io, socket, payload.conversationId);
            return { conversationId: asId(conversation._id) };
        });
    });

    socket.on("conversation:leave", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const conversationId = asId(payload.conversationId);
            if (!conversationId) return { conversationId };
            getJoinedRooms(socket).delete(conversationId);
            socket.leave(getDmRoomName(conversationId));
            return { conversationId };
        });
    });

    socket.on("message:send", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            assertEventRate(socket, "message:send");
            const result = await sendDmMessage({
                user: getSocketUser(socket),
                conversationId: payload.conversationId,
                body: payload.body,
                type: payload.type,
                attachments: payload.attachments,
                replyTo: payload.replyTo,
                metadata: payload.metadata,
                clientRequestId: payload.clientRequestId,
            });
            const roomName = getDmRoomName(result.conversation._id);
            io.to(roomName).emit("message:receive", {
                conversationId: result.conversation._id,
                message: result.message,
            });
            await emitConversationToUsers(io, result.conversation);
            return result.message;
        });
    });

    socket.on("message:delivered", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const data = await markDmDelivered({
                userId: socket.userId,
                conversationId: payload.conversationId,
            });
            io.to(getDmRoomName(payload.conversationId)).emit("message:delivered", data);
            return data;
        });
    });

    socket.on("message:read", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            assertEventRate(socket, "message:read");
            const data = await markDmRead({
                userId: socket.userId,
                conversationId: payload.conversationId,
            });
            io.to(getDmRoomName(payload.conversationId)).emit("message:read", data);
            await emitUnreadToUsers(io, [socket.userId]);
            return data;
        });
    });

    socket.on("typing:start", (payload = {}) => {
        if (!allowEvent(socket, "typing:start")) return;
        const conversationId = asId(payload.conversationId);
        if (!conversationId || !getJoinedRooms(socket).has(conversationId)) return;
        socket.to(getDmRoomName(conversationId)).emit("typing:start", {
            conversationId,
            userId: socket.userId,
            username: socket.userProfile?.username || "Player",
        });
    });

    socket.on("typing:stop", (payload = {}) => {
        if (!allowEvent(socket, "typing:stop")) return;
        const conversationId = asId(payload.conversationId);
        if (!conversationId || !getJoinedRooms(socket).has(conversationId)) return;
        socket.to(getDmRoomName(conversationId)).emit("typing:stop", {
            conversationId,
            userId: socket.userId,
        });
    });

    socket.on("conversation:accept", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const conversation = await acceptMessageRequest({
                userId: socket.userId,
                conversationId: payload.conversationId,
            });
            await emitConversationToUsers(io, conversation, "conversation:accepted");
            return conversation;
        });
    });

    socket.on("conversation:block", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const conversation = await blockDmConversation({
                userId: socket.userId,
                conversationId: payload.conversationId,
                reason: payload.reason,
            });
            io.to(getDmRoomName(payload.conversationId)).emit("conversation:block", {
                conversationId: conversation._id,
                conversation,
            });
            return conversation;
        });
    });

    socket.on("conversation:delete", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const data = await deleteDmConversationForUser({
                userId: socket.userId,
                conversationId: payload.conversationId,
            });
            socket.leave(getDmRoomName(payload.conversationId));
            getJoinedRooms(socket).delete(asId(payload.conversationId));
            socket.emit("conversation:delete", data);
            await emitUnreadToUsers(io, [socket.userId]);
            return data;
        });
    });

    socket.on("conversation:preferences", (payload = {}, callback) => {
        runSocketAction(socket, callback, async () => {
            const conversation = await updateConversationPreferences({
                userId: socket.userId,
                conversationId: payload.conversationId,
                pinned: payload.pinned,
                muted: payload.muted,
                archived: payload.archived,
            });
            await emitConversationToUsers(io, conversation);
            return conversation;
        });
    });

    socket.on("disconnect", () => {
        leaveAllDmRooms(socket);
    });
};
