import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getReferralSettings,
  updateReferralSettings,
  getActivitySettings,
  updateActivitySettings,
} from "../controllers/settingController.js";

const router = express.Router();

// Admin / Super Admin only
router.get("/referrals", protect, getReferralSettings);
router.put("/referrals", protect, updateReferralSettings);

// Activity settings (Admin / Super Admin)
router.get("/activity", protect, getActivitySettings);
router.put("/activity", protect, updateActivitySettings);

export default router;
