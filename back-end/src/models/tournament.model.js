import mongoose from "mongoose";

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
        trim: true,
        lowercase: true,
        default: 'freefire',
        index: true
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
        enum: ['solo', 'duo', 'squad'],
        required: true
    },
    format: {
        type: String,
        enum: ['single_elim', 'double_elim', 'round_robin', 'swiss'],
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
        default: 2
    },
    entryFee: {
        type: Number,
        default: 0
    },
    prizePool: {
        total: {
            type: Number,
            default: 0
        },
        distribution: [
            {
                place: { type: Number },
                amount: { type: Number }
            }
        ]
    },
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
        roomPass: { type: String, trim: true }
    },
    matches: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match'
    }]
}, { timestamps: true });

// Compound index for sorting tournaments by name and date
TournamentSchema.index({ title: 1, startAt: -1 });
TournamentSchema.index({ organizer: 1, startAt: -1 });
TournamentSchema.index({ channel: 1, startAt: -1 });
TournamentSchema.index({ status: 1, startAt: 1 });

export const Tournament = mongoose.model('Tournament', TournamentSchema);
