import webpush from "web-push";
// import { Resend } from "resend";
import { Notification } from "../models/notification.model.js";
import { PushSubscription } from "../models/pushSubscription.model.js";
import { User } from "../models/user.model.js";
import { emitToUser } from "./socket.service.js";
import { sendEmail } from "./auth.service.js";
import { APP_PUBLIC_URL, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "../../env.js";

const pushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
// Resend sender kept for quick rollback if needed.
// import { EMAIL_FROM, RESEND_API_KEY } from "../../env.js";
// const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const NOTIFICATION_DELIVERY_CONCURRENCY = Math.max(1, Number(process.env.NOTIFICATION_DELIVERY_CONCURRENCY || 10));

if (pushConfigured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const toAbsoluteUrl = (actionUrl = "") => {
    if (!actionUrl) return APP_PUBLIC_URL;
    if (/^https?:\/\//i.test(actionUrl)) return actionUrl;
    return `${String(APP_PUBLIC_URL || "").replace(/\/$/, "")}/${String(actionUrl).replace(/^\//, "")}`;
};

const buildPushPayload = (notification) => JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: notification._id?.toString?.() || `${notification.type}-${Date.now()}`,
    data: {
        notificationId: notification._id?.toString?.(),
        type: notification.type,
        url: toAbsoluteUrl(notification.actionUrl),
        ...(notification.data || {}),
    },
});

const serializeNotification = (notification) => {
    const plain = notification?.toObject?.() || notification;
    return {
        ...plain,
        _id: plain._id?.toString?.() || plain._id,
        user: plain.user?.toString?.() || plain.user,
    };
};

const escapeHtml = (value = "") =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const runWithConcurrency = async (items, worker, limit = NOTIFICATION_DELIVERY_CONCURRENCY) => {
    const results = [];
    let cursor = 0;

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            try {
                results[index] = { status: "fulfilled", value: await worker(items[index], index) };
            } catch (error) {
                results[index] = { status: "rejected", reason: error };
            }
        }
    });

    await Promise.all(workers);
    return results;
};

const buildNotificationEmailHtml = (notification) => {
    const url = toAbsoluteUrl(notification.actionUrl);
    return `
<!doctype html>
<html lang="en">
  <body style="margin:0;background:#070913;color:#f8fafc;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070913;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-radius:18px;overflow:hidden;border:1px solid #26324f;background:#0d1222;">
            <tr>
              <td style="padding:26px;background:linear-gradient(135deg,#6d28d9,#0ea5e9 52%,#22c55e);">
                <p style="margin:0 0 8px;color:#dbeafe;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">Battle4Arena</p>
                <h1 style="margin:0;color:#fff;font-size:25px;line-height:1.2;font-weight:900;">${escapeHtml(notification.title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:26px;">
                <p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7;">${escapeHtml(notification.body)}</p>
                <a href="${escapeHtml(url)}" style="display:inline-block;border-radius:12px;background:#22c55e;color:#04110a;padding:13px 18px;text-decoration:none;font-size:13px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">Open Battle4Arena</a>
                <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.6;word-break:break-all;">${escapeHtml(url)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const sendPushToUser = async (userId, notification) => {
    if (!pushConfigured || !userId) return;

    const subscriptions = await PushSubscription.find({ user: userId, enabled: true }).lean();
    if (subscriptions.length === 0) return;

    await runWithConcurrency(
        subscriptions,
        async (subscription) => {
            try {
                await webpush.sendNotification({
                    endpoint: subscription.endpoint,
                    keys: subscription.keys,
                }, buildPushPayload(notification));
            } catch (error) {
                if ([404, 410].includes(Number(error?.statusCode))) {
                    await PushSubscription.deleteOne({ endpoint: subscription.endpoint });
                }
            }
        },
        NOTIFICATION_DELIVERY_CONCURRENCY
    );
};

export const getPushPublicKey = () => VAPID_PUBLIC_KEY || "";

export const sendNotificationEmail = async (userId, notification) => {
    if (!userId) return { skipped: true, reason: "missing_user" };

    const user = await User.findById(userId).select("email username preferences").lean();
    if (!user?.email || user.preferences?.notifications === false) {
        return { skipped: true, reason: "email_unavailable_or_disabled" };
    }

    return sendEmail({
        to: user.email,
        subject: notification.title,
        html: buildNotificationEmailHtml(notification),
        text: `${notification.title}\n\n${notification.body}\n\n${toAbsoluteUrl(notification.actionUrl)}`,
    });

    // Resend version kept commented as requested.
    // const result = await resend.emails.send({
    //     from: EMAIL_FROM,
    //     to: user.email,
    //     subject: notification.title,
    //     html: buildNotificationEmailHtml(notification),
    //     text: `${notification.title}\n\n${notification.body}\n\n${toAbsoluteUrl(notification.actionUrl)}`,
    // });
    //
    // if (result?.error) throw result.error;
    // return result?.data || result;
};

const deliverNotification = async (notification, { sendEmail = false } = {}) => {
    const serialized = serializeNotification(notification);
    emitToUser(serialized.user, "notification:new", serialized);

    const tasks = [];
    if (notification.channels?.push !== false) {
        tasks.push(sendPushToUser(serialized.user, notification));
    }
    if (sendEmail || notification.channels?.email) {
        tasks.push(
            sendNotificationEmail(serialized.user, notification)
                .then(() => Notification.updateOne({ _id: notification._id }, { $set: { emailSentAt: new Date(), emailError: "" } }))
                .catch((error) => Notification.updateOne({ _id: notification._id }, { $set: { emailError: error?.message || "Failed to send email" } }))
        );
    }

    await Promise.allSettled(tasks);
    await Notification.updateOne({ _id: notification._id }, { $set: { deliveredAt: new Date() } });
};

export const createNotification = async ({
    user,
    title,
    body,
    type = "system",
    priority = "normal",
    actionUrl = "",
    data = {},
    channels = {},
    email = false,
    session,
} = {}) => {
    if (!user || !title || !body) return null;

    const docs = await Notification.create([{
        user,
        title,
        body,
        type,
        priority,
        actionUrl,
        data,
        channels: {
            inApp: channels.inApp ?? true,
            push: channels.push ?? true,
            email: channels.email ?? email,
        },
    }], session ? { session, ordered: true } : { ordered: true });

    const notification = docs[0];
    if (!session) {
        await deliverNotification(notification, { sendEmail: email });
    }
    return notification;
};

export const createNotifications = async (notifications = [], options = {}) => {
    const validNotifications = notifications.filter((item) => item?.user && item?.title && item?.body);
    if (validNotifications.length === 0) return [];

    const inserted = await Notification.insertMany(validNotifications, {
        ordered: false,
        ...(options.session ? { session: options.session } : {}),
    });

    if (!options.session) {
        await runWithConcurrency(
            inserted,
            (notification) => deliverNotification(notification, {
                sendEmail: Boolean(notification.channels?.email),
            }),
            NOTIFICATION_DELIVERY_CONCURRENCY
        );
    }
    return inserted;
};

export const sendPushForNotification = sendPushToUser;
export const deliverStoredNotification = deliverNotification;
