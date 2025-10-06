import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getReferralLink, checkReferralPromotion, getMyReferrals, getReferralStats } from "../controllers/referralController.js";

const router = express.Router();

// Salesperson gets referral link
router.get("/link", protect, getReferralLink);
router.get("/my-referrals", protect, getMyReferrals);
router.get("/stats", protect, getReferralStats);
router.post("/promotion/:salesPersonId", protect, checkReferralPromotion);

export default router;
