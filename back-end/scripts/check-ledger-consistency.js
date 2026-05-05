import dotenv from "dotenv";
import mongoose from "mongoose";
import { Ledger } from "../src/models/ledger.model.js";

dotenv.config();

if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
}

await mongoose.connect(process.env.MONGODB_URI);

const total = await Ledger.countDocuments();
const withDirection = await Ledger.countDocuments({
    $or: [{ fromUser: { $ne: null } }, { toUser: { $ne: null } }],
});
const missingCategory = await Ledger.countDocuments({
    $or: [{ category: { $exists: false } }, { category: null }, { category: "" }],
});
const missingDirectionSamples = await Ledger.find({
    $or: [{ fromUser: { $exists: false } }, { toUser: { $exists: false } }],
})
    .select("transactionId category referenceId fromUser toUser")
    .limit(5)
    .lean();

console.log(JSON.stringify({ total, withDirection, missingCategory, missingDirectionSamples }, null, 2));

await mongoose.disconnect();
