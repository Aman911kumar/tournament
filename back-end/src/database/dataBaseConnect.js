import mongoose from "mongoose";
import { MONGODB_URI } from "../../env.js";
import { User } from "../models/user.model.js";

const ensureUserPhoneIndex = async () => {
    try {
        const indexes = await User.collection.indexes();
        const phoneIndex = indexes.find((index) => index.key?.phone_number === 1);

        if (phoneIndex && !phoneIndex.sparse) {
            await User.collection.dropIndex(phoneIndex.name);
        }

        await User.collection.createIndex(
            { phone_number: 1 },
            { unique: true, sparse: true, name: "phone_number_1" }
        );

        await User.collection.createIndex(
            { socialProvider: 1, socialProviderId: 1 },
            {
                unique: true,
                name: "socialProvider_1_socialProviderId_1",
                partialFilterExpression: {
                    socialProvider: { $type: "string" },
                    socialProviderId: { $type: "string" },
                },
            }
        );

        const legacyUsers = await User.find({ phone_number: /^(google|facebook):/i }).select("phone_number socialProvider socialProviderId");
        await Promise.all(legacyUsers.map(async (user) => {
            const [provider, providerId] = String(user.phone_number).split(":");
            if (!user.socialProvider || !user.socialProviderId) {
                user.socialProvider = provider;
                user.socialProviderId = providerId;
            }
            user.set("phone_number", undefined);
            await user.save({ validateBeforeSave: false });
        }));
    } catch (error) {
        console.warn("User phone index cleanup skipped:", error.message);
    }
};

const connect_db = async () => {
    try {
        const connection = await mongoose.connect(MONGODB_URI)
        await ensureUserPhoneIndex();
        console.log(`\nDatabase connected successfully to :${connection.connection.host}`)
    } catch (error) {
        throw error
    }
}

export default connect_db
