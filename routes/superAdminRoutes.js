import express from "express";
import { getSalesSummary, getRecentActivities } from "../controllers/superAdminController.js";
import { adminOrSuper } from "../middleware/roleMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";


const router = express.Router();

// summary of system-wide sales performance
router.get("/sales/summary", protect, adminOrSuper, getSalesSummary);

// recent activities (sales, users, etc.)
router.get("/activities/recent", protect, adminOrSuper, getRecentActivities);

export default router;
