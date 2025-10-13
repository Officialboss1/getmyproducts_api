import express from "express";
import { getSalesSummary, getRecentActivities, getAllUsers, getChatSummary } from "../controllers/superAdminController.js";
import { adminOrSuper } from "../middlewares/roleMiddleware.js";
import { protect } from "../middlewares/authMiddleware.js";


const router = express.Router();

// summary of system-wide sales performance
router.get("/sales/summary", protect, adminOrSuper, getSalesSummary);

// recent activities (sales, users, etc.)
router.get("/activities/recent", protect, adminOrSuper, getRecentActivities);

// get all users for dashboard stats
router.get("/users/all", protect, adminOrSuper, getAllUsers);

// chat summary for dashboard
router.get("/chat/summary", protect, adminOrSuper, getChatSummary);

export default router;
