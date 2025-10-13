// routes/systemRoutes.js
import express from "express";
import { getSystemHealth } from "../controllers/systemController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { adminOrSuper } from "../middlewares/roleMiddleware.js";


const router = express.Router();
router.get("/health", protect, adminOrSuper, getSystemHealth);
export default router;
