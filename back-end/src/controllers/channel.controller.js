import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Channel } from "../models/channel.model.js";
import { ChannelSubscription } from "../models/channelSubscription.model.js";
import { Tournament } from "../models/tournament.model.js";
import { User } from "../models/user.model.js";
import { CreatorRating } from "../models/creatorRating.model.js";
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

const getAvailableHandle = async (baseHandle, ownerId, currentChannelId = null) => {
    const fallback = `creator-${ownerId.toString().slice(-6)}`;
    const normalizedBase = getRequestedHandle(baseHandle, fallback) || fallback;
    const base = normalizedBase.slice(0, 30);
    let handle = base;
    let suffix = 0;

    while (await Channel.exists({
        handle,
        owner: { $ne: ownerId },
        ...(currentChannelId ? { _id: { $ne: currentChannelId } } : {})
    })) {
        suffix += 1;
        const nextSuffix = `-${suffix}`;
        handle = `${base.slice(0, 30 - nextSuffix.length)}${nextSuffix}`;
    }

    return handle;
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

    if (!hasRole(req.user, "creator", "admin")) {
        throw new ApiError(403, "Admin approval is required before creating a creator channel");
    }

    if (!name || name.trim() === "") {
        throw new ApiError(400, "Channel name is required");
    }

    const requestedHandle = getRequestedHandle(handle, name);
    if (!requestedHandle) {
        throw new ApiError(400, "Channel handle must be at least 3 valid characters");
    }

    const existingChannel = await Channel.findOne({ owner: userId });
    if (existingChannel) {
        existingChannel.name = name.trim();
        existingChannel.handle = await getAvailableHandle(requestedHandle, userId, existingChannel._id);
        existingChannel.description = description;
        if (avatar) existingChannel.avatar = avatar;
        if (banner) existingChannel.banner = banner;
        if (socialLinks) existingChannel.socialLinks = socialLinks;
        existingChannel.isActive = true;
        await existingChannel.save();

        return res.status(200).json(
            new ApiResponse(200, existingChannel, "Channel setup updated successfully")
        );
    }

    const channel = await Channel.create({
        owner: userId,
        name: name.trim(),
        handle: await getAvailableHandle(requestedHandle, userId),
        description,
        avatar,
        banner,
        socialLinks
    });

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
        .limit(Number(limit))
        .lean();

    const ownerIds = channels.map((channel) => channel.owner?._id || channel.owner);
    const tournamentCounts = await Tournament.aggregate([
        { $match: { organizer: { $in: ownerIds } } },
        {
            $group: {
                _id: "$organizer",
                count: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                openOrRunning: { $sum: { $cond: [{ $in: ["$status", ["open", "running"]] }, 1, 0] } },
                prizePool: { $sum: "$prizePool" },
                organizerEarnings: { $sum: "$organizerEarnings" }
            }
        }
    ]);

    const countByOwner = new Map(
        tournamentCounts.map((item) => [item._id.toString(), item])
    );

    const data = channels.map((channel) => {
        const ownerId = channel.owner?._id || channel.owner;
        const stats = countByOwner.get(ownerId.toString()) || {};
        const rating = Number(channel.owner?.stats?.rating || 0);
        const ratingCount = Number(channel.owner?.stats?.ratingCount || 0);
        const topScore = Number((
            Number(channel.memberCount || 0) * 2 +
            Number(stats.count || 0) * 12 +
            Number(stats.completed || 0) * 18 +
            Number(stats.openOrRunning || 0) * 10 +
            Number(stats.prizePool || 0) * 0.03 +
            rating * 20 +
            Math.min(ratingCount, 100) * 1.5
        ).toFixed(2));
        return {
            ...channel,
            tournamentCount: stats.count || 0,
            topScore,
            ranking: {
                completedTournaments: stats.completed || 0,
                activeTournaments: stats.openOrRunning || 0,
                totalPrize: Number(stats.prizePool || 0),
                earnings: Number(stats.organizerEarnings || 0),
                rating,
                ratingCount,
            }
        };
    }).sort((a, b) => Number(b.topScore || 0) - Number(a.topScore || 0));

    const channelOwnerIds = new Set(ownerIds.map((ownerId) => ownerId?.toString()).filter(Boolean));
    const fallbackUserQuery = {
            role: "creator",
            isActive: true,
            _id: { $nin: [...channelOwnerIds] },
        };
    if (search && search.trim() !== "") {
        fallbackUserQuery.username = { $regex: search.trim(), $options: "i" };
    }
    const creatorFallbackUsers = await User.find(fallbackUserQuery)
            .sort({ createdAt: -1 })
            .limit(Math.max(Number(limit) - data.length, 0))
            .select("username avatar stats role")
            .lean();
    const fallbackChannels = creatorFallbackUsers.map((user) => ({
        _id: user._id,
        owner: user,
        name: user.username,
        handle: user.username,
        description: "Approved creator",
        memberCount: 0,
        isActive: true,
        tournamentCount: 0,
        virtual: true,
    }));

    const total = await Channel.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, { channels: [...data, ...fallbackChannels], total: total + fallbackChannels.length }, "Channels fetched successfully")
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
        .select("-room_details.roomId -room_details.roomPass")
        .sort({ startAt: 1, createdAt: -1 })
        .limit(Number(tournamentLimit))
        .lean();

    const tournamentCount = await Tournament.countDocuments(tournamentQuery);
    const prizeTotals = await Tournament.aggregate([
        { $match: tournamentQuery },
        { $group: { _id: null, totalPrize: { $sum: "$prizePool" } } }
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            { channel, creator: channel.owner, tournaments, tournamentCount, totalPrize: Number(prizeTotals[0]?.totalPrize || 0) },
            "Channel fetched successfully"
        )
    );
});

const getCreatorByUserId = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { tournamentLimit = 6, status } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, "Invalid creator user ID");
    }

    const user = await User.findById(userId).select("username avatar role stats createdAt").lean();
    if (!user || !user.role?.includes("creator")) {
        throw new ApiError(404, "Creator not found");
    }

    const channel = await Channel.findOne({ owner: userId, isActive: true }).populate("owner", "username avatar stats");
    const extra = {};
    if (status) extra.status = status;

    const tournamentQuery = channel
        ? buildChannelTournamentQuery(channel, extra)
        : { organizer: userId, ...extra };

    const tournaments = await Tournament.find(tournamentQuery)
        .populate("organizer", "username avatar stats")
        .populate("channel", "name handle avatar")
        .select("-room_details.roomId -room_details.roomPass")
        .sort({ startAt: 1, createdAt: -1 })
        .limit(Number(tournamentLimit))
        .lean();

    const [tournamentCount, prizeTotals] = await Promise.all([
        Tournament.countDocuments(tournamentQuery),
        Tournament.aggregate([
            { $match: tournamentQuery },
            { $group: { _id: null, totalPrize: { $sum: "$prizePool" } } }
        ])
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                channel,
                creator: user,
                tournaments,
                tournamentCount,
                totalPrize: Number(prizeTotals[0]?.totalPrize || 0)
            },
            "Creator fetched successfully"
        )
    );
});

const rateCreatorByUserId = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const rating = Number(req.body.rating);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, "Invalid creator user ID");
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        throw new ApiError(400, "Rating must be between 1 and 5");
    }

    if (userId === req.user._id.toString()) {
        throw new ApiError(400, "You cannot rate yourself");
    }

    const creator = await User.findById(userId).select("role isActive");
    if (!creator || !creator.isActive || !creator.role?.includes("creator")) {
        throw new ApiError(404, "Creator not found");
    }

    await CreatorRating.findOneAndUpdate(
        { creator: userId, user: req.user._id },
        { $set: { rating } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const totals = await CreatorRating.aggregate([
        { $match: { creator: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: "$creator", rating: { $avg: "$rating" }, ratingCount: { $sum: 1 } } }
    ]);
    const stats = totals[0] || { rating: 0, ratingCount: 0 };
    const updatedCreator = await User.findByIdAndUpdate(
        userId,
        {
            $set: {
                "stats.rating": Number(Number(stats.rating || 0).toFixed(1)),
                "stats.ratingCount": Number(stats.ratingCount || 0),
            }
        },
        { new: true }
    ).select("username avatar role stats");

    return res.status(200).json(
        new ApiResponse(200, { creator: updatedCreator }, "Creator rating saved")
    );
});

const rateCreatorByChannelId = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const channel = await resolveChannel(channelId);
    const ownerId = channel.owner?._id || channel.owner;
    req.params.userId = ownerId.toString();
    return rateCreatorByUserId(req, res);
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
        .select("-room_details.roomId -room_details.roomPass")
        .sort({ startAt: 1, createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean();

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
        .select("-room_details.roomId -room_details.roomPass")
        .sort({ startAt: 1, createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean();

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
    getCreatorByUserId,
    rateCreatorByUserId,
    rateCreatorByChannelId,
    updateChannel,
    joinChannel,
    leaveChannel,
    getJoinedChannels,
    getJoinedChannelTournaments,
    getChannelTournaments
};
