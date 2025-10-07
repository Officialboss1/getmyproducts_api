import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import salesRoutes from "./routes/salesRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import competitionRoutes from "./routes/competitionRoutes.js";
import targetsRoutes from "./routes/targetsRoutes.js";
import customerCodeRoutes from "./routes/customerCodeRoutes.js";
import settingRoutes from "./routes/settingRoutes.js";
import referralRoutes from "./routes/referralRoutes.js";
import systemHealth from "./routes/systemRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";

dotenv.config();
connectDB();

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/competitions", competitionRoutes);
app.use("/api/targets", targetsRoutes);
app.use("/api/customer-codes", customerCodeRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/referrals", referralRoutes)
app.use("/api/system", systemHealth);
app.use("/api", superAdminRoutes);




// Catch-All 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

// Server Boot
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});