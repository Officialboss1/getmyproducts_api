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

    // Use your FRONTEND URL for shareable referral links
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const referralLink = `${frontendUrl}/register?ref=${user.referralCode}`;

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


// Get all referrals belonging to the logged-in salesperson
export const getMyReferrals = async (req, res) => {
  try {
    const referrals = await Referral.find({ salesPerson: req.user._id })
      .populate('customer', 'name email createdAt')
      .populate('salesPerson', 'name')
      .sort({ createdAt: -1 });

      const formatted = referrals.map(r => ({
        id: r._id,
        name: r.customer?.name || 'Unnamed',
        email: r.customer?.email || 'N/A',
        joinDate: r.customer?.createdAt || r.createdAt,
        status: r.status,
        salesCount: Sale.countDocuments({ user: r.customer?._id }),
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get referral statistics for the logged-in salesperson
export const getReferralStats = async (req, res) => {
  try {
    const referrals = await Referral.find({ salesPerson: req.user._id });
    const activeReferrals = referrals.filter(r => r.status === 'active').length;
    const totalSales = await Sale.countDocuments({ referrer: req.user._id });
    const totalRevenue = (await Sale.aggregate([
      { $match: { referrer: req.user._id } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } },
    ]))[0]?.total || 0;

    const stats = {
      totalReferrals: referrals.length,
      activeReferrals,
      totalSales,
      totalRevenue,
      yourBonus: totalRevenue * 0.05,
      progress: {
        referrals: { current: activeReferrals, target: 5 },
        sales: { current: totalSales, target: 75 },
      },
      isTeamHead: req.user.role === 'team_head',
      teamHeadProgress: Math.min(100, ((activeReferrals / 5) * 50 + (totalSales / 75) * 50)),
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
