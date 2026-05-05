import dotenv from "dotenv";
import mongoose from "mongoose";
import { Ledger } from "../src/models/ledger.model.js";
import { WalletTransaction } from "../src/models/walletTransaction.model.js";

dotenv.config();

if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
}

await mongoose.connect(process.env.MONGODB_URI);

const ledgers = await Ledger.find({
    $or: [
        { category: { $exists: false } },
        { category: null },
        { category: "" },
        { fromUser: { $exists: false } },
        { toUser: { $exists: false } },
    ],
});

let updated = 0;
let skipped = 0;

for (const ledger of ledgers) {
    const tx = await WalletTransaction.findOne({ transactionId: ledger.transactionId }).lean();
    if (!tx) {
        skipped += 1;
        continue;
    }

    const fromUser = tx.fromUser || (tx.type === "DEBIT" ? tx.user : null);
    const toUser = tx.toUser || (tx.type === "CREDIT" ? tx.user : null);

    await Ledger.updateOne(
        { _id: ledger._id },
        {
            $set: {
                category: tx.category,
                referenceId: tx.referenceId || ledger.referenceId || null,
                fromUser,
                toUser,
                platformFee: tx.platformFee || 0,
                netAmount: tx.netAmount || tx.amount || 0,
                metadata: {
                    ...(ledger.metadata || {}),
                    backfilledFromWalletTransaction: true,
                    walletTransactionId: tx._id,
                },
            },
        }
    );
    updated += 1;
}

console.log(JSON.stringify({ scanned: ledgers.length, updated, skipped }, null, 2));

await mongoose.disconnect();
