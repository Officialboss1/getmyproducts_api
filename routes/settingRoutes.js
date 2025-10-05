import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getReferralSettings,
  updateReferralSettings,
} from "../controllers/settingController.js";

const router = express.Router();

// Admin / Super Admin only
router.get("/referrals", protect, getReferralSettings);
router.put("/referrals", protect, updateReferralSettings);

export default router;
