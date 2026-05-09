import express from "express";
import {
    createChannel,
    getMyChannel,
    listChannels,
    getChannelByIdentifier,
    getCreatorByUserId,
    updateChannel,
    joinChannel,
    leaveChannel,
    getJoinedChannels,
    getJoinedChannelTournaments,
    getChannelTournaments,
    rateCreatorByUserId,
    rateCreatorByChannelId,
} from "../controllers/channel.controller.js";
import { optionalProtect, protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", listChannels);
router.post("/", protect, createChannel);

router.get("/me", protect, getMyChannel);
router.get("/joined", protect, getJoinedChannels);
router.get("/feed/tournaments", protect, getJoinedChannelTournaments);
router.get("/creator/:userId", optionalProtect, getCreatorByUserId);
router.post("/creator/:userId/rating", protect, rateCreatorByUserId);

router.get("/:identifier", optionalProtect, getChannelByIdentifier);
router.patch("/:channelId", protect, updateChannel);
router.post("/:channelId/rating", protect, rateCreatorByChannelId);
router.post("/:channelId/join", protect, joinChannel);
router.delete("/:channelId/join", protect, leaveChannel);
router.get("/:channelId/tournaments", getChannelTournaments);

export default router;
