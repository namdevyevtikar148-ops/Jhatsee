import express from "express";
import cors from "cors";
import "dotenv/config";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

// Import route files
import userRoutes from "./routes/user.js";
import accountRoutes from "./routes/account.js";
import transactionsRoutes from "./routes/transactions.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/jhatse")
    .then(() => console.log("MongoDB connected successfully."))
    .catch(err => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/account", accountRoutes);
app.use("/api/v1/transactions", transactionsRoutes);

// ✅ Serve frontend (React build)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
