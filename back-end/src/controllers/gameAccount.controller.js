import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { verifyGameId, normalizeGame } from "../services/gameIdVerification.service.js";
import { GameAccount } from "../models/gameAccount.model.js";
import mongoose from "mongoose";

// ---------------------------------
// CREATE GAME ACCOUNT
// ---------------------------------
const createGameAccount = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    let { game, inGameName, gameId, level } = req.body;

    // 🔧 Normalize game
    game = normalizeGame(game)

    if (!game || !inGameName || !gameId) {
        throw new ApiError(400, "Game, inGameName and gameId are required");
    }

    // 🔒 Check: only one account per game per user
    const existingGameAccount = await GameAccount.findOne({
        user: userId,
        game: game
    });

    if (existingGameAccount) {
        throw new ApiError(400, `You already have an account for ${game}`);
    }

    // 🔒 Check: duplicate gameId for same user
    const duplicateGameId = await GameAccount.findOne({
        user: userId,
        gameId: gameId
    });

    if (duplicateGameId) {
        throw new ApiError(400, "This Game ID is already registered");
    }

    // ✅ Create account
    const account = await GameAccount.create({
        user: userId,
        game,
        inGameName,
        gameId,
        level,
    });

    return res.status(201).json(
        new ApiResponse(201, account, "Game account linked successfully")
    );
});

// ---------------------------------
// GET ALL GAME ACCOUNTS (USER)
// ---------------------------------
const getUserGameAccounts = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const accounts = await GameAccount.find({ user: userId }).sort({ createdAt: -1 });

    return res.status(200).json(
        new ApiResponse(200, accounts, "Game accounts fetched successfully")
    );
});

// ---------------------------------
// GET SINGLE GAME ACCOUNT
// ---------------------------------
const getGameAccountById = asyncHandler(async (req, res) => {
    const { accountId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
        throw new ApiError(400, "Invalid account ID");
    }

    const account = await GameAccount.findById(accountId);

    if (!account) {
        throw new ApiError(404, "Game account not found");
    }

    // ownership check
    if (account.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Not authorized to access this account");
    }

    return res.status(200).json(
        new ApiResponse(200, account, "Game account fetched successfully")
    );
});

// ---------------------------------
// UPDATE GAME ACCOUNT (PATCH)
// ---------------------------------
const updateGameAccount = asyncHandler(async (req, res) => {
    const { accountId } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
        throw new ApiError(400, "Invalid account ID");
    }

    const account = await GameAccount.findById(accountId);

    if (!account) {
        throw new ApiError(404, "Game account not found");
    }

    if (account.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Not authorized to update this account");
    }

    // Only allow certain fields
    const allowedFields = ["game", "inGameName", "gameId", "level"];
    Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
            account[key] = updates[key];
        }
    });

    await account.save();

    return res.status(200).json(
        new ApiResponse(200, account, "Game account updated successfully")
    );
});

// ---------------------------------
// DELETE GAME ACCOUNT
// ---------------------------------
const deleteGameAccount = asyncHandler(async (req, res) => {
    const { accountId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
        throw new ApiError(400, "Invalid account ID");
    }

    const account = await GameAccount.findById(accountId);

    if (!account) {
        throw new ApiError(404, "Game account not found");
    }

    if (account.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Not authorized to delete this account");
    }

    await account.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Game account deleted successfully")
    );
});


const verifyGameAccount = asyncHandler(async (req, res) => {
    const { accountId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
        throw new ApiError(400, "Invalid account ID");
    }

    const account = await GameAccount.findById(accountId);

    if (!account) {
        throw new ApiError(404, "Game account not found");
    }
    // console.log(account)

    const result = await verifyGameId(account.game, account.gameId);
    // console.log(result)

    if (!result.valid) {
        throw new ApiError(400, result.message || "Invalid Game ID");
    }

    // ✅ Update fields from verification
    if (result.data?.username) {
        account.inGameName = result.data.username;
    }

    account.verified = true;

    // ✅ Save updated account
    await account.save();

    // console.log(account)

    return res.status(200).json(
        new ApiResponse(
            200,
            account,
            "Game account verified and updated successfully"
        )
    );
});

export {
    createGameAccount,
    getUserGameAccounts,
    getGameAccountById,
    updateGameAccount,
    deleteGameAccount,
    verifyGameAccount
};