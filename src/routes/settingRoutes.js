import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  getReferralSettings,
  updateReferralSettings,
  getActivitySettings,
  updateActivitySettings,
  getGlobalTargets,
  updateGlobalTargets,
  getSystemSettings,
  updateSystemSettings,
} from "../controllers/settingController.js";

const router = express.Router();

// Admin / Super Admin only
router.get("/referrals", protect, getReferralSettings);
router.put("/referrals", protect, updateReferralSettings);

// Activity settings (Admin / Super Admin)
router.get("/activity", protect, getActivitySettings);
router.put("/activity", protect, updateActivitySettings);

// Global targets (Admin / Super Admin)
router.get("/targets", protect, getGlobalTargets);
router.put("/targets", protect, updateGlobalTargets);

// System settings (Admin / Super Admin)
router.get("/system", protect, getSystemSettings);
router.put("/system", protect, updateSystemSettings);

export default router;
