import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_SECRET } from "../../env.js";
import { User } from "../models/user.model.js";

let io;
let redisAdapterReady = false;
const onlineUsers = new Map();
const ADMIN_SOCKET_ROLES = ["super_admin", "admin", "moderator", "support", "finance_manager", "tournament_manager"];
const connectionAttempts = new Map();
const SOCKET_WINDOW_MS = Number(process.env.SOCKET_RATE_LIMIT_WINDOW_MS || 60_000);
const SOCKET_MAX_CONNECTIONS = Number(process.env.SOCKET_RATE_LIMIT_MAX || 60);

const cleanupConnectionAttempts = () => {
    const now = Date.now();
    for (const [key, value] of connectionAttempts.entries()) {
        if (now - value.startedAt > SOCKET_WINDOW_MS) connectionAttempts.delete(key);
    }
};

const cleanupTimer = setInterval(cleanupConnectionAttempts, SOCKET_WINDOW_MS);
cleanupTimer.unref?.();

const getTokenFromSocket = (socket) => {
    const authToken = socket.handshake.auth?.token;
    if (authToken) return authToken;

    const header = socket.handshake.headers?.authorization || "";
    if (header.startsWith("Bearer ")) return header.slice(7);
    return "";
};

export const getUserRoom = (userId) => `user:${userId}`;
export const ADMIN_ROOM = "admin:ops";

const hasAdminSocketRole = (roles = []) => roles.some((role) => ADMIN_SOCKET_ROLES.includes(role));

const emitAdminPresence = () => {
    if (!io) return;
    io.to(ADMIN_ROOM).emit("admin:presence", getSocketStats());
};

const setupRedisAdapter = async () => {
    const redisUrl = process.env.REDIS_URL || "";
    if (!redisUrl || !io || redisAdapterReady) return;

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (error) => console.error("Socket Redis pub client error:", error.message));
    subClient.on("error", (error) => console.error("Socket Redis sub client error:", error.message));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    redisAdapterReady = true;
    console.log("Socket.IO Redis adapter enabled");
};

export const initSocket = (server, allowedOrigins = []) => {
    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error("Not allowed by Socket.IO CORS"));
                }
            },
            credentials: true,
        },
        transports: ["websocket", "polling"],
        maxHttpBufferSize: 64 * 1024,
        pingInterval: 25_000,
        pingTimeout: 20_000,
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60_000,
            skipMiddlewares: false,
        },
    });

    io.use(async (socket, next) => {
        try {
            const address = socket.handshake.address || socket.conn.remoteAddress || "unknown";
            const now = Date.now();
            const attempt = connectionAttempts.get(address);
            const nextAttempt = attempt && now - attempt.startedAt <= SOCKET_WINDOW_MS
                ? { startedAt: attempt.startedAt, count: attempt.count + 1 }
                : { startedAt: now, count: 1 };
            connectionAttempts.set(address, nextAttempt);
            if (nextAttempt.count > SOCKET_MAX_CONNECTIONS) {
                return next(new Error("Too many socket connection attempts"));
            }

            const token = getTokenFromSocket(socket);
            if (!token) return next(new Error("Authentication required"));

            const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
            const userId = decoded?._id || decoded?.id || decoded?.userId;
            if (!userId) return next(new Error("Invalid token"));

            socket.userId = userId.toString();
            const user = await User.findById(socket.userId).select("role isActive accountStatus").lean();
            if (!user?.isActive || user.accountStatus === "banned" || user.role?.includes("banned")) {
                return next(new Error("Account is not active"));
            }
            socket.userRoles = Array.isArray(user.role) ? user.role : [];
            return next();
        } catch {
            return next(new Error("Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        socket.join(getUserRoom(socket.userId));
        onlineUsers.set(socket.userId, (onlineUsers.get(socket.userId) || 0) + 1);
        if (hasAdminSocketRole(socket.userRoles)) {
            socket.join(ADMIN_ROOM);
            socket.emit("admin:presence", getSocketStats());
        }
        socket.emit("notification:ready", { userId: socket.userId });
        emitAdminPresence();

        socket.on("disconnect", () => {
            const nextCount = Math.max(0, (onlineUsers.get(socket.userId) || 0) - 1);
            if (nextCount > 0) onlineUsers.set(socket.userId, nextCount);
            else onlineUsers.delete(socket.userId);
            emitAdminPresence();
        });
    });

    setupRedisAdapter().catch((error) => {
        redisAdapterReady = false;
        console.error("Socket.IO Redis adapter disabled:", error.message);
    });

    return io;
};

export const getSocketServer = () => io;

export const getSocketStats = () => ({
    onlineUsers: onlineUsers.size,
    sockets: io?.engine?.clientsCount || 0,
    redisAdapter: redisAdapterReady,
});

export const emitToAdmins = (event, payload) => {
    if (!io) return false;
    io.to(ADMIN_ROOM).emit(event, payload);
    return true;
};

export const emitToUser = (userId, event, payload) => {
    if (!io || !userId) return false;
    io.to(getUserRoom(userId)).emit(event, payload);
    return true;
};
