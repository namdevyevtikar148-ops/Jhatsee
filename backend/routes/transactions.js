import express from "express";
import Transaction from "../models/transaction.js";
import { authMiddleware } from "../middleware/index.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
    try {
        const transactions = await Transaction.find({
            $or: [
                { from: req.userId },
                { to: req.userId }
            ]
        }).sort({ timestamp: -1 });

        res.json({ transactions });
    } catch (error) {
        console.error("💥 TRANSACTION HISTORY ERROR:", error);
        res.status(500).json({ error: "Failed to retrieve transactions" });
    }
});

export default router;