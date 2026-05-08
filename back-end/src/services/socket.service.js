import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_SECRET } from "../../env.js";

let io;
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

    io.use((socket, next) => {
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
            return next();
        } catch {
            return next(new Error("Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        socket.join(getUserRoom(socket.userId));
        socket.emit("notification:ready", { userId: socket.userId });
    });

    return io;
};

export const getSocketServer = () => io;

export const emitToUser = (userId, event, payload) => {
    if (!io || !userId) return false;
    io.to(getUserRoom(userId)).emit(event, payload);
    return true;
};
