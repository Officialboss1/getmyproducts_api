// routes/analyticsRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getUserProgress, getLeaderboard, getDailySalesByUser } from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/progress", protect, getUserProgress); // current user
router.get("/progress/:userId", protect, getUserProgress); // specific user
router.get("/leaderboard", protect, getLeaderboard);
router.get("/daily", protect, getDailySalesByUser);

export default router;
