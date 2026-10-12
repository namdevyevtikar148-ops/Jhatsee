import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/user.js";
import Account from "../models/account.js";
import { authMiddleware } from "../middleware/index.js";

const router = express.Router();

// --- Signin Route ---
router.post("/signin", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(400).json({ error: "Invalid email or password" });
        }
        
        const match = await bcrypt.compare(password, user.password);
        
        if (!match) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const account = await Account.findOne({ userId: user._id });
        if (!account) return res.status(404).json({ error: "Account not found" });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.json({ 
            token, 
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                mobileNumber: user.mobileNumber,
                balance: account.balance
            }
        });
        
    } catch (error) {
        console.error("💥 SIGNIN ERROR:", error);
        res.status(500).json({ error: "Server error", details: error.message });
    }
});

// --- Signup Route ---
router.post("/signup", async (req, res) => {
    try {
        const { firstName, lastName, email, mobileNumber, password } = req.body;

        if (!firstName || !lastName || !email || !mobileNumber || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }
        if (!/^[0-9]{10}$/.test(mobileNumber)) {
            return res.status(400).json({ error: "Invalid mobile number format" });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { mobileNumber }] });
        if (existingUser) {
            return res.status(400).json({ error: "User with this email or mobile number already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            firstName,
            lastName,
            email,
            mobileNumber,
            password: hashedPassword,
        });

        await newUser.save();

        const account = new Account({ userId: newUser._id, balance: 500 });
        await account.save();

        const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            message: "User created successfully",
            token,
            user: {
                id: newUser._id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email,
                mobileNumber: newUser.mobileNumber,
                balance: 500,
            }
        });
    } catch (error) {
        console.error("💥 SIGNUP ERROR:", error);
        res.status(500).json({ error: "Signup failed", details: error.message });
    }
});

// --- Search for users ---
router.get("/bulk", authMiddleware, async (req, res) => {
    try {
        const filter = req.query.filter || "";
        const users = await User.find({
            $or: [
                { firstName: { "$regex": filter, "$options": "i" } },
                { lastName: { "$regex": filter, "$options": "i" } }
            ]
        }).select("-password");

        res.status(200).json({
            users: users.map(user => ({
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
            }))
        });
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;