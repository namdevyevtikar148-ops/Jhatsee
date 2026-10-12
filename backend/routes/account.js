import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Account from "../models/Account.js";
import { User } from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { authMiddleware } from "../middleware/index.js";

const router = express.Router();

// --- Signin Route ---
router.post("/signin", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "Invalid email or password" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ error: "Invalid email or password" });

        const account = await Account.findOne({ userId: user._id });
        if (!account) return res.status(404).json({ error: "Account not found" });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "24h" });

        res.json({
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                balance: account.balance,
            },
        });
    } catch (error) {
        console.error("💥 SIGNIN ERROR:", error);
        res.status(500).json({ error: "Server error", details: error.message });
    }
});

// --- Signup Route ---
router.post("/signup", async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ firstName, lastName, email, password: hashedPassword });
        await user.save();

        const account = new Account({ userId: user._id, balance: 500 });
        await account.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "24h" });

        res.status(201).json({
            message: "User created successfully",
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                balance: 500,
            },
        });
    } catch (error) {
        console.error("💥 SIGNUP ERROR:", error);
        res.status(500).json({ error: "Signup failed", details: error.message });
    }
});

// --- Balance Route ---
router.get("/balance", authMiddleware, async (req, res) => {
    try {
        const account = await Account.findOne({ userId: req.userId });
        if (!account) return res.status(404).json({ message: "Account not found" });
        res.json({ balance: account.balance });
    } catch (error) {
        console.error("💥 BALANCE ERROR:", error);
        res.status(500).json({ error: "Failed to retrieve balance" });
    }
});

// --- Transfer Route ---
router.post("/transfer", authMiddleware, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { to, amount } = req.body;
        const amountAsNumber = parseFloat(amount);
        if (isNaN(amountAsNumber) || amountAsNumber <= 0) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Invalid transfer amount" });
        }

        const fromAccount = await Account.findOne({ userId: req.userId }).session(session);
        if (!fromAccount || fromAccount.balance < amountAsNumber) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Insufficient balance" });
        }

        // --- CORRECTION STARTS HERE ---
        // Find the recipient user by their mobile number
        const toUser = await User.findOne({ mobileNumber: to }).session(session);
        if (!toUser) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Invalid recipient mobile number" });
        }

        // Now find the recipient's account using the userId from the user found above
        const toAccount = await Account.findOne({ userId: toUser._id }).session(session);
        if (!toAccount) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Recipient account not found" });
        }
        // --- CORRECTION ENDS HERE ---

        await Account.updateOne({ userId: req.userId }, { $inc: { balance: -amountAsNumber } }).session(session);
        await Account.updateOne({ userId: toAccount.userId }, { $inc: { balance: amountAsNumber } }).session(session);

        await Transaction.create([{ from: req.userId, to: toAccount.userId, amount: amountAsNumber }], { session });

        await session.commitTransaction();
        res.json({ message: "Transfer successful" });
    } catch (error) {
        await session.abortTransaction();
        console.error("💥 TRANSFER ERROR:", error);
        res.status(500).json({ error: "Transfer failed", details: error.message });
    } finally {
        session.endSession();
    }
});

// --- Transactions History Route ---
router.get("/transactions", authMiddleware, async (req, res) => {
    try {
        const transactions = await Transaction.find({
            $or: [{ from: req.userId }, { to: req.userId }],
        }).sort({ timestamp: -1 });

        res.json({ transactions });
    } catch (error) {
        console.error("💥 TRANSACTION HISTORY ERROR:", error);
        res.status(500).json({ error: "Failed to retrieve transactions" });
    }
});

export default router;