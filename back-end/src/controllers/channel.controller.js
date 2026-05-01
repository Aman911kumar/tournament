import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Channel } from "../models/channel.model.js";
import { ChannelSubscription } from "../models/channelSubscription.model.js";
import { Tournament } from "../models/tournament.model.js";
import { User } from "../models/user.model.js";
import { hasRole } from "../middlewares/auth.middleware.js";
import mongoose from "mongoose";

const normalizeHandle = (value = "") => {
    return value
        .trim()
        .toLowerCase()
        .replace(/^@/, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 30);
};

const getRequestedHandle = (handle, name) => {
    const normalized = normalizeHandle(handle || name || "");
    return normalized.length >= 3 ? normalized : null;
};

const resolveChannel = async (identifier, includeInactive = false) => {
    if (!identifier) {
        throw new ApiError(400, "Channel identifier is required");
    }

    const query = mongoose.Types.ObjectId.isValid(identifier)
        ? { _id: identifier }
        : { handle: normalizeHandle(identifier) };

    if (!includeInactive) {
        query.isActive = true;
    }

    const channel = await Channel.findOne(query).populate("owner", "username avatar stats");

    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }

    return channel;
};

const buildChannelTournamentQuery = (channel, extra = {}) => {
    const ownerId = channel.owner?._id || channel.owner;

    return {
        $and: [
            {
                $or: [
                    { channel: channel._id },
                    { organizer: ownerId }
                ]
            },
            extra
        ]
    };
};

const createChannel = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { name, handle, description = "", avatar, banner, socialLinks } = req.body;

    if (!name || name.trim() === "") {
        throw new ApiError(400, "Channel name is required");
    }

    const existingChannel = await Channel.findOne({ owner: userId });
    if (existingChannel) {
        throw new ApiError(400, "You already have a channel");
    }

    const requestedHandle = getRequestedHandle(handle, name);
    if (!requestedHandle) {
        throw new ApiError(400, "Channel handle must be at least 3 valid characters");
    }

    const handleExists = await Channel.findOne({ handle: requestedHandle });
    if (handleExists) {
        throw new ApiError(400, "Channel handle is already taken");
    }

    const channel = await Channel.create({
        owner: userId,
        name: name.trim(),
        handle: requestedHandle,
        description,
        avatar,
        banner,
        socialLinks
    });

    await User.findByIdAndUpdate(userId, { $addToSet: { role: "creator" } });

    return res.status(201).json(
        new ApiResponse(201, channel, "Channel created successfully")
    );
});

const getMyChannel = asyncHandler(async (req, res) => {
    const channel = await Channel.findOne({ owner: req.user._id }).populate("owner", "username avatar stats");

    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }

    const tournamentCount = await Tournament.countDocuments(
        buildChannelTournamentQuery(channel)
    );

    return res.status(200).json(
        new ApiResponse(200, { channel, tournamentCount }, "Channel fetched successfully")
    );
});

const listChannels = asyncHandler(async (req, res) => {
    const { limit = 20, skip = 0, search } = req.query;
    const query = { isActive: true };

    if (search && search.trim() !== "") {
        query.$or = [
            { name: { $regex: search.trim(), $options: "i" } },
            { handle: { $regex: normalizeHandle(search), $options: "i" } }
        ];
    }

    const channels = await Channel.find(query)
        .populate("owner", "username avatar stats")
        .sort({ memberCount: -1, createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit));

    const ownerIds = channels.map((channel) => channel.owner?._id || channel.owner);
    const tournamentCounts = await Tournament.aggregate([
        { $match: { organizer: { $in: ownerIds } } },
        { $group: { _id: "$organizer", count: { $sum: 1 } } }
    ]);

    const countByOwner = new Map(
        tournamentCounts.map((item) => [item._id.toString(), item.count])
    );

    const data = channels.map((channel) => {
        const ownerId = channel.owner?._id || channel.owner;
        return {
            ...channel.toObject(),
            tournamentCount: countByOwner.get(ownerId.toString()) || 0
        };
    });

    const total = await Channel.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, { channels: data, total }, "Channels fetched successfully")
    );
});

const getChannelByIdentifier = asyncHandler(async (req, res) => {
    const { identifier } = req.params;
    const { tournamentLimit = 6, status } = req.query;
    const channel = await resolveChannel(identifier);
    const extra = {};

    if (status) {
        extra.status = status;
    }

    const tournamentQuery = buildChannelTournamentQuery(channel, extra);
    const tournaments = await Tournament.find(tournamentQuery)
        .populate("organizer", "username avatar stats")
        .populate("channel", "name handle avatar")
        .sort({ startAt: 1, createdAt: -1 })
        .limit(Number(tournamentLimit));

    const tournamentCount = await Tournament.countDocuments(tournamentQuery);

    return res.status(200).json(
        new ApiResponse(
            200,
            { channel, tournaments, tournamentCount },
            "Channel fetched successfully"
        )
    );
});

const updateChannel = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const channel = await resolveChannel(channelId, true);
    const ownerId = channel.owner?._id || channel.owner;

    if (ownerId.toString() !== req.user._id.toString() && !hasRole(req.user, "admin")) {
        throw new ApiError(403, "Not authorized to update this channel");
    }

    if (req.body.handle) {
        const nextHandle = getRequestedHandle(req.body.handle, null);
        if (!nextHandle) {
            throw new ApiError(400, "Channel handle must be at least 3 valid characters");
        }

        const existingHandle = await Channel.findOne({
            handle: nextHandle,
            _id: { $ne: channel._id }
        });

        if (existingHandle) {
            throw new ApiError(400, "Channel handle is already taken");
        }

        channel.handle = nextHandle;
    }

    const allowedFields = ["name", "description", "avatar", "banner", "socialLinks", "isActive"];
    allowedFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
            channel[field] = req.body[field];
        }
    });

    await channel.save();

    return res.status(200).json(
        new ApiResponse(200, channel, "Channel updated successfully")
    );
});

const joinChannel = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const channel = await resolveChannel(channelId);
    const ownerId = channel.owner?._id || channel.owner;

    if (ownerId.toString() === req.user._id.toString()) {
        throw new ApiError(400, "You cannot join your own channel");
    }

    let subscription;
    let created = false;

    try {
        subscription = await ChannelSubscription.create({
            channel: channel._id,
            user: req.user._id,
            notificationsEnabled: req.body.notificationsEnabled ?? true
        });
        created = true;
    } catch (error) {
        if (error?.code !== 11000) {
            throw error;
        }

        subscription = await ChannelSubscription.findOne({
            channel: channel._id,
            user: req.user._id
        });
    }

    if (created) {
        channel.memberCount += 1;
        await channel.save();
    }

    return res.status(created ? 201 : 200).json(
        new ApiResponse(
            created ? 201 : 200,
            { channel, subscription, joined: true },
            created ? "Channel joined successfully" : "You already joined this channel"
        )
    );
});

const leaveChannel = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const channel = await resolveChannel(channelId, true);

    const subscription = await ChannelSubscription.findOneAndDelete({
        channel: channel._id,
        user: req.user._id
    });

    if (subscription && channel.memberCount > 0) {
        channel.memberCount -= 1;
        await channel.save();
    }

    return res.status(200).json(
        new ApiResponse(200, { channelId: channel._id, joined: false }, "Channel left successfully")
    );
});

const getJoinedChannels = asyncHandler(async (req, res) => {
    const subscriptions = await ChannelSubscription.find({ user: req.user._id })
        .populate({
            path: "channel",
            match: { isActive: true },
            populate: { path: "owner", select: "username avatar stats" }
        })
        .sort({ joinedAt: -1 });

    const channels = subscriptions
        .filter((subscription) => subscription.channel)
        .map((subscription) => ({
            ...subscription.channel.toObject(),
            joinedAt: subscription.joinedAt,
            notificationsEnabled: subscription.notificationsEnabled
        }));

    return res.status(200).json(
        new ApiResponse(200, { channels, total: channels.length }, "Joined channels fetched successfully")
    );
});

const getJoinedChannelTournaments = asyncHandler(async (req, res) => {
    const { limit = 20, skip = 0, status } = req.query;
    const subscriptions = await ChannelSubscription.find({ user: req.user._id })
        .populate("channel", "owner name handle avatar isActive");

    const channels = subscriptions
        .map((subscription) => subscription.channel)
        .filter((channel) => channel?.isActive);

    if (channels.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, { tournaments: [], total: 0 }, "Joined channel tournaments fetched successfully")
        );
    }

    const channelIds = channels.map((channel) => channel._id);
    const ownerIds = channels.map((channel) => channel.owner);
    const query = {
        $or: [
            { channel: { $in: channelIds } },
            { organizer: { $in: ownerIds } }
        ]
    };

    if (status) {
        query.status = status;
    }

    const tournaments = await Tournament.find(query)
        .populate("organizer", "username avatar stats")
        .populate("channel", "name handle avatar")
        .sort({ startAt: 1, createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit));

    const total = await Tournament.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, { tournaments, total }, "Joined channel tournaments fetched successfully")
    );
});

const getChannelTournaments = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const { limit = 20, skip = 0, status } = req.query;
    const channel = await resolveChannel(channelId);
    const extra = {};

    if (status) {
        extra.status = status;
    }

    const query = buildChannelTournamentQuery(channel, extra);
    const tournaments = await Tournament.find(query)
        .populate("organizer", "username avatar stats")
        .populate("channel", "name handle avatar")
        .sort({ startAt: 1, createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit));

    const total = await Tournament.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, { channel, tournaments, total }, "Channel tournaments fetched successfully")
    );
});

export {
    createChannel,
    getMyChannel,
    listChannels,
    getChannelByIdentifier,
    updateChannel,
    joinChannel,
    leaveChannel,
    getJoinedChannels,
    getJoinedChannelTournaments,
    getChannelTournaments
};
