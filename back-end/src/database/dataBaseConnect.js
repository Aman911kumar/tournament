import mongoose from "mongoose";
import {
    MONGODB_MAX_IDLE_TIME_MS,
    MONGODB_MAX_POOL_SIZE,
    MONGODB_MIN_POOL_SIZE,
    MONGODB_URI,
    MONGODB_WAIT_QUEUE_TIMEOUT_MS,
} from "../../env.js";
import { User } from "../models/user.model.js";

let indexesEnsured = false;

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
        if (mongoose.connection.readyState === 1) {
            if (!indexesEnsured) {
                await ensureUserPhoneIndex();
                indexesEnsured = true;
            }
            return mongoose.connection;
        }

        // Serverless-safe connection caching (Vercel): reuse the same in-flight promise/connection per runtime.
        const globalKey = "__b4a_mongooseConnectPromise__";
        const existingPromise = globalThis[globalKey];
        if (existingPromise) {
            const connection = await existingPromise;
            if (!indexesEnsured) {
                await ensureUserPhoneIndex();
                indexesEnsured = true;
            }
            return connection?.connection || mongoose.connection;
        }

        mongoose.set("strictQuery", true);

        const connectPromise = mongoose.connect(MONGODB_URI, {
            autoIndex: process.env.NODE_ENV !== "production",
            maxPoolSize: Number(MONGODB_MAX_POOL_SIZE || 50),
            minPoolSize: Number(MONGODB_MIN_POOL_SIZE || 0),
            maxIdleTimeMS: Number(MONGODB_MAX_IDLE_TIME_MS || 60000),
            waitQueueTimeoutMS: Number(MONGODB_WAIT_QUEUE_TIMEOUT_MS || 5000),
            serverSelectionTimeoutMS: 10000,
        });

        globalThis[globalKey] = connectPromise;

        const connection = await connectPromise;

        if (!indexesEnsured) {
            await ensureUserPhoneIndex();
            indexesEnsured = true;
        }

        console.log(`\nDatabase connected successfully to :${connection.connection.host}`);
        return connection;
    } catch (error) {
        // Clear cached promise on failure so next invocation can retry.
        try {
            delete globalThis["__b4a_mongooseConnectPromise__"];
        } catch {
            // ignore
        }
        throw error
    }
}

export default connect_db
