import mongoose from "mongoose";
import { getPlatformFeePercent } from "../utils/money.js";

const SUPPORTED_GAMES = ["freefire", "bgmi", "callofduty", "valorant"];
const SUPPORTED_GAME_MODES = [
    "battle_royale",
    "clash_squad",
    "lone_wolf",
    "classic",
    "tdm",
    "arena",
    "multiplayer",
    "search_destroy",
    "competitive",
    "custom"
];

const TournamentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    game: {
        type: String,
        enum: SUPPORTED_GAMES,
        trim: true,
        lowercase: true,
        default: 'freefire',
        index: true
    },
    gameMode: {
        type: String,
        enum: SUPPORTED_GAME_MODES,
        default: "battle_royale",
        index: true
    },
    mapName: {
        type: String,
        trim: true,
        default: ""
    },
    platform: {
        type: String,
        enum: ["mobile", "pc", "console", "crossplay"],
        default: "mobile"
    },
    perspective: {
        type: String,
        enum: ["tpp", "fpp", "both", "na"],
        default: "tpp"
    },
    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    channel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Channel',
        default: null,
        index: true
    },
    type: {
        type: String,
        enum: ['solo', 'duo', 'squad', 'team'],
        required: true
    },
    startAt: {
        type: Date,
        required: true,
        validate: {
            validator: function (value) {
                return !this.registrationEnd || value > this.registrationEnd;
            },
            message: "Start date must be after registration end date."
        }
    },
    endAt: {
        type: Date
    },
    registrationStart: {
        type: Date,
        required: true
    },
    registrationEnd: {
        type: Date,
        required: true,
        validate: {
            validator: function (value) {
                return !this.registrationStart || value > this.registrationStart;
            },
            message: "Registration end date must be after registration start date."
        }
    },
    maxPlayers: {
        type: Number,
        default: 2,
        min: 1
    },
    maxTeams: {
        type: Number,
        default: 2,
        min: 1
    },
    teamSize: {
        type: Number,
        default: 1,
        min: 1,
        max: 5
    },
    entryFee: {
        type: Number,
        default: 0
    },
    joinedPlayers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    ],
    platformFeePercent: {
        type: Number,
        default: () => getPlatformFeePercent("TOURNAMENT_ENTRY"),
        min: 0,
        max: 100
    },
    platformFeeAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    organizerEarnings: {
        type: Number,
        default: 0,
        min: 0
    },
    prizePool: {
        type: Number,
        default: 0,
        min: 0
    },
    prizeMode: {
        type: String,
        enum: ["position", "kill", "both"],
        default: "position"
    },
    killPrizeAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    prizeDistribution: [
        {
            position: {
                type: Number,
                required: true,
                min: 1
            },
            prizeAmount: {
                type: Number,
                required: true,
                default: 0,
                min: 0
            }
        }
    ],
    results: [
        {
            position: {
                type: Number,
                default: 0,
                min: 0
            },
            player: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            },
            kills: {
                type: Number,
                default: 0,
                min: 0
            },
            points: {
                type: Number,
                default: 0,
                min: 0
            },
            positionPrizeWon: {
                type: Number,
                default: 0,
                min: 0
            },
            killPrizeWon: {
                type: Number,
                default: 0,
                min: 0
            },
            prizeMode: {
                type: String,
                enum: ["position", "kill", "both"],
                default: "position"
            },
            prizeWon: {
                type: Number,
                default: 0,
                min: 0
            }
        }
    ],
    rules: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['draft', 'open', 'running', 'completed', 'cancelled'],
        default: 'draft',
        index: true
    },
    room_details: {
        roomId: { type: String, trim: true },
        roomPass: { type: String, trim: true },
        roomJoinTime: { type: Date }
    },
}, { timestamps: true });

// Compound index for sorting tournaments by name and date
TournamentSchema.index({ title: 1, startAt: -1 });
TournamentSchema.index({ organizer: 1, startAt: -1 });
TournamentSchema.index({ channel: 1, startAt: -1 });
TournamentSchema.index({ status: 1, startAt: 1 });
TournamentSchema.index({ createdAt: -1 });
TournamentSchema.index({ game: 1, status: 1, createdAt: -1 });
TournamentSchema.index({ organizer: 1, createdAt: -1 });
TournamentSchema.index({ channel: 1, createdAt: -1 });

export const Tournament = mongoose.model('Tournament', TournamentSchema);
