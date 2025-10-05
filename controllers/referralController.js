import User from "../models/User.js";
import Referral from "../models/Referral.js";
import Setting from "../models/Setting.js";
import { nanoid } from "nanoid";
import dotenv from "dotenv";
import Sale from "../models/Sale.js";




dotenv.config();

// Generate referral link for a salesperson
export const getReferralLink = async (req, res) => {
  try {
    if (req.user.role !== "salesperson") {
      return res.status(403).json({ message: "Only salespersons can generate referral links" });
    }

    let user = await User.findById(req.user._id);

    if (!user.referralCode) {
      user.referralCode = nanoid(8); // generate unique code
      await user.save();
    }

        // Use environment BASE_URL or request origin
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;

    const referralLink = `${baseUrl}/register?ref=${user.referralCode}`;
    res.json({ referralLink, code: user.referralCode });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Track customer registration via referral
export const registerWithReferral = async (salesPersonId, customerId) => {
  try {
    await Referral.create({
      salesPerson: salesPersonId,
      customer: customerId,
      status: "pending"
    });

    await User.findByIdAndUpdate(salesPersonId, {
      $push: { referredCustomers: customerId }
    });
  } catch (error) {
    console.error("Referral tracking failed:", error);
  }
};

// Check if salesperson qualifies for promotion
export const checkReferralPromotion = async (salesPersonId) => {
  try {
    const referralSetting = await Setting.findOne({ key: "referral" });
    if (!referralSetting) return;

    const { requiredReferrals, requiredSalesPerReferral } = referralSetting.value;

    // Get all completed referrals by this salesperson
    const referrals = await Referral.find({
      referrer: salesPersonId,
      status: "completed"
    }).populate("referred");

    if (!referrals || referrals.length < requiredReferrals) {
      return; // not enough referrals yet
    }

    // Check each referral’s sales
    let qualifiedReferrals = 0;

    for (const referral of referrals) {
      const salesCount = await Sale.countDocuments({ user: referral.referred._id });
      if (salesCount >= requiredSalesPerReferral) {
        qualifiedReferrals++;
      }
    }

    // If enough referrals are qualified, promote salesperson
    if (qualifiedReferrals >= requiredReferrals) {
      await User.findByIdAndUpdate(salesPersonId, { role: "team_head" }); // or "senior_salesperson" if you add it
      console.log("🎉 Promotion granted to salesperson:", salesPersonId);
    }
  } catch (error) {
    console.error("Promotion check failed:", error);
  }
};
