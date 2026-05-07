import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
    {
        public_id: { type: String, trim: true },
        url: { type: String, trim: true }
    },
    { _id: false }
);

const channelSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80
        },
        handle: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
            match: [/^[a-z0-9][a-z0-9_-]{2,29}$/, "Invalid channel handle"]
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },
        avatar: {
            type: mediaSchema,
            default: {}
        },
        banner: {
            type: mediaSchema,
            default: {}
        },
        socialLinks: {
            youtube: { type: String, trim: true },
            instagram: { type: String, trim: true },
            discord: { type: String, trim: true },
            website: { type: String, trim: true }
        },
        memberCount: {
            type: Number,
            default: 0,
            min: 0
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    { timestamps: true }
);

channelSchema.index({ name: "text", handle: "text" });
channelSchema.index({ memberCount: -1, createdAt: -1 });
channelSchema.index({ isActive: 1, memberCount: -1, createdAt: -1 });

export const Channel = mongoose.model("Channel", channelSchema);
