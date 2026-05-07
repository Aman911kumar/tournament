import mongoose from "mongoose";

const RegistrationSchema = new mongoose.Schema({
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true,
    },

    // For Duo/Squad tournaments
    team: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: []
        }
    ],

    // For Solo tournaments
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    status: {
        type: String,
        enum: ['pending', 'paid', 'confirmed', 'rejected', 'cancelled'],
        default: 'pending'
    },

    slotNumber: {
        type: Number,
        min: 1,
        default: null
    },

    paidAmount: {
        type: Number,
        default: 0,
        min: [0, 'Paid amount cannot be negative']
    },

    platformFee: {
        type: Number,
        default: 0,
        min: [0, 'Platform fee cannot be negative']
    },

    organizerAmount: {
        type: Number,
        default: 0,
        min: [0, 'Organizer amount cannot be negative']
    },

    paymentRef: {
        type: String,
        trim: true,
        default: null
    },

    gameAccounts: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            game: { type: String, trim: true },
            inGameName: { type: String, trim: true },
            gameId: { type: String, trim: true },
            level: { type: String, default: null },
            verified: { type: Boolean, default: false },
        }
    ]

}, { timestamps: true });

// Indexes
RegistrationSchema.index({ tournament: 1, user: 1 });
RegistrationSchema.index({ tournament: 1, status: 1 });
RegistrationSchema.index({ tournament: 1, slotNumber: 1 });
RegistrationSchema.index({ user: 1, status: 1, createdAt: -1 });
RegistrationSchema.index({ team: 1, status: 1 });

// Validate based on tournament type
RegistrationSchema.pre("validate", function (next) {
    if (!this.user && (!this.team || this.team.length === 0)) {
        return next(new Error("Either user or team members must be provided."));
    }
    next();
});

export const Registration = mongoose.model('Registration', RegistrationSchema);
