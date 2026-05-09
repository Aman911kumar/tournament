import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Notification } from "../models/notification.model.js";
import { PushSubscription } from "../models/pushSubscription.model.js";
import { createNotification, getPushPublicKey } from "../services/notification.service.js";

const allowedTypes = ["system", "wallet", "tournament", "tournament_update", "reward", "security", "creator", "room", "payment", "report", "moderation"];

const buildNotificationQuery = (req) => {
    const query = { user: req.user._id };
    const { unreadOnly, type } = req.query;

    if (unreadOnly === "true" || unreadOnly === true) query.read = false;
    if (type && allowedTypes.includes(String(type))) query.type = String(type);

    return query;
};

export const getUserNotifications = asyncHandler(async (req, res) => {
    const safeLimit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const safeSkip = Math.max(Number(req.query.skip) || 0, 0);
    const query = buildNotificationQuery(req);

    const [notifications, unreadCount, total] = await Promise.all([
        Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(safeSkip)
            .limit(safeLimit)
            .lean(),
        Notification.countDocuments({ user: req.user._id, read: false }),
        Notification.countDocuments(query),
    ]);

    return res.status(200).json(
        new ApiResponse(200, { notifications, unreadCount, total }, "Notifications fetched successfully")
    );
});

export const getUnreadNotificationCount = asyncHandler(async (req, res) => {
    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });

    return res.status(200).json(
        new ApiResponse(200, { unreadCount }, "Unread notification count fetched")
    );
});

export const markNotificationAsRead = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    if (!notificationId) throw new ApiError(400, "Notification ID is required");

    const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, user: req.user._id },
        { $set: { read: true, readAt: new Date() } },
        { new: true }
    ).lean();

    if (!notification) throw new ApiError(404, "Notification not found");

    return res.status(200).json(
        new ApiResponse(200, notification, "Notification marked as read")
    );
});

export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
        { user: req.user._id, read: false },
        { $set: { read: true, readAt: new Date() } }
    );

    return res.status(200).json(
        new ApiResponse(200, { modifiedCount: result.modifiedCount }, "All notifications marked as read")
    );
});

export const deleteNotification = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    if (!notificationId) throw new ApiError(400, "Notification ID is required");

    const deleted = await Notification.findOneAndDelete({ _id: notificationId, user: req.user._id });
    if (!deleted) throw new ApiError(404, "Notification not found");

    return res.status(200).json(
        new ApiResponse(200, {}, "Notification deleted successfully")
    );
});

export const getNotificationPushConfig = asyncHandler(async (req, res) => {
    const publicKey = getPushPublicKey();

    return res.status(200).json(
        new ApiResponse(200, {
            enabled: Boolean(publicKey),
            publicKey,
        }, publicKey ? "Push notifications are available" : "Push notifications are not configured")
    );
});

export const savePushSubscription = asyncHandler(async (req, res) => {
    const { subscription, platform = "web" } = req.body;
    const endpoint = subscription?.endpoint;
    const keys = subscription?.keys || {};

    if (!endpoint || !keys.p256dh || !keys.auth) {
        throw new ApiError(400, "Valid push subscription is required");
    }

    const saved = await PushSubscription.findOneAndUpdate(
        { endpoint },
        {
            $set: {
                user: req.user._id,
                endpoint,
                keys: {
                    p256dh: keys.p256dh,
                    auth: keys.auth,
                },
                platform: ["web", "android", "ios"].includes(platform) ? platform : "unknown",
                userAgent: req.headers["user-agent"] || "",
                enabled: true,
                lastSeenAt: new Date(),
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json(
        new ApiResponse(200, { subscribed: true, subscriptionId: saved._id }, "Push notifications enabled")
    );
});

export const deletePushSubscription = asyncHandler(async (req, res) => {
    const endpoint = req.body?.endpoint;
    const query = endpoint ? { user: req.user._id, endpoint } : { user: req.user._id };
    const result = await PushSubscription.deleteMany(query);

    return res.status(200).json(
        new ApiResponse(200, { deletedCount: result.deletedCount }, "Push notifications disabled")
    );
});

export const createSystemNotification = asyncHandler(async (req, res) => {
    const notification = await createNotification({
        user: req.user._id,
        title: req.body.title,
        body: req.body.body,
        type: allowedTypes.includes(req.body.type) ? req.body.type : "system",
        priority: req.body.priority,
        actionUrl: req.body.actionUrl,
        data: req.body.data,
        email: Boolean(req.body.email),
    });

    return res.status(201).json(
        new ApiResponse(201, notification, "Notification created successfully")
    );
});
