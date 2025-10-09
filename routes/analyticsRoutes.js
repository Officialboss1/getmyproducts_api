// routes/analyticsRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getUserProgress, getLeaderboard, getDailySalesByUser, getSystemAnalytics, exportAnalytics } from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/progress", protect, getUserProgress); // current user
router.get("/progress/:userId", protect, getUserProgress); // specific user
router.get("/leaderboard", protect, getLeaderboard);
router.get("/daily-sales", protect, getDailySalesByUser);
router.get("/system", protect, getSystemAnalytics);
router.get("/export", protect, exportAnalytics);

export default router;
