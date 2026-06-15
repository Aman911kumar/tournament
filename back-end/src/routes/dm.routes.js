import express from "express";
import {
    acceptRequest,
    blockConversation,
    createConversation,
    declineRequest,
    deleteConversation,
    getConversation,
    getSettings,
    getUnreadCount,
    listConversations,
    listMessages,
    markDelivered,
    markRead,
    reportConversation,
    sendMessage,
    updatePreferences,
    updateSettings,
    uploadAttachment,
} from "../controllers/dm.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { chatLimiter, moderationLimiter, reportLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/settings", getSettings);
router.patch("/settings", chatLimiter, updateSettings);
router.get("/unread-count", getUnreadCount);

router.get("/conversations", listConversations);
router.post("/conversations", chatLimiter, createConversation);
router.get("/conversations/:conversationId", getConversation);
router.patch("/conversations/:conversationId", chatLimiter, updatePreferences);
router.delete("/conversations/:conversationId", chatLimiter, deleteConversation);

router.get("/conversations/:conversationId/messages", listMessages);
router.post("/conversations/:conversationId/messages", chatLimiter, sendMessage);
router.post(
    "/conversations/:conversationId/attachments",
    chatLimiter,
    express.raw({
        type: ["image/*", "application/pdf", "text/plain", "application/zip"],
        limit: process.env.DM_UPLOAD_MAX_SIZE || "5mb",
    }),
    uploadAttachment
);

router.post("/conversations/:conversationId/read", chatLimiter, markRead);
router.post("/conversations/:conversationId/delivered", chatLimiter, markDelivered);
router.post("/conversations/:conversationId/accept", chatLimiter, acceptRequest);
router.post("/conversations/:conversationId/decline", chatLimiter, declineRequest);
router.post("/conversations/:conversationId/block", moderationLimiter, blockConversation);
router.post("/conversations/:conversationId/report", reportLimiter, reportConversation);

export default router;
