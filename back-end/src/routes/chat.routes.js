import express from "express";
import {
    getChatAccess,
    listChatMessages,
    markRoomRead,
    moderateRoomChat,
    pinMessage,
    reactToChatMessage,
    removeChatMessage,
    reportMessage,
    sendChatMessage,
    unpinMessage,
    updateChatMessage,
    uploadChatAttachment,
} from "../controllers/chat.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { chatLimiter, moderationLimiter, reportLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/tournaments/:tournamentId/access", getChatAccess);
router.get("/tournaments/:tournamentId/messages", listChatMessages);
router.post("/tournaments/:tournamentId/messages", chatLimiter, sendChatMessage);
router.post(
    "/tournaments/:tournamentId/attachments",
    chatLimiter,
    express.raw({
        type: ["image/*", "application/pdf", "text/plain", "application/zip"],
        limit: process.env.CHAT_UPLOAD_MAX_SIZE || "5mb",
    }),
    uploadChatAttachment
);
router.post("/tournaments/:tournamentId/read", chatLimiter, markRoomRead);
router.post("/tournaments/:tournamentId/moderation", moderationLimiter, moderateRoomChat);
router.delete("/tournaments/:tournamentId/pin", moderationLimiter, unpinMessage);

router.patch("/messages/:messageId", chatLimiter, updateChatMessage);
router.delete("/messages/:messageId", chatLimiter, removeChatMessage);
router.post("/messages/:messageId/reactions", chatLimiter, reactToChatMessage);
router.post("/messages/:messageId/pin", moderationLimiter, pinMessage);
router.post("/messages/:messageId/report", reportLimiter, reportMessage);

export default router;
