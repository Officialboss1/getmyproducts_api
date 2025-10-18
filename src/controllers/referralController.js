import User from "../models/User.js";
import Referral from "../models/Referral.js";
import Setting from "../models/Setting.js";
import Sale from "../models/Sale.js";
import { nanoid } from "nanoid";
import config from "../config/index.js";

// This helper function is the core of our optimization.
// It uses a single aggregation query to get all referral data,
// including sales counts and total revenue for each referred user.
const getAggregatedReferralData = async (salesPersonId) => {
  const referrals = await Referral.aggregate([
    // 1. Find all referrals for the given salesperson
    { $match: { referrer: salesPersonId } },
    // 2. Join with the 'users' collection to get referred user details
    {
      $lookup: {
        from: "users",
        localField: "referred",
        foreignField: "_id",
        as: "referredInfo",
      },
    },
    // 3. Join with the 'sales' collection to get all sales made by referred users
    {
      $lookup: {
        from: "sales",
        localField: "referred",
        foreignField: "user_id", // Standardized field name
        as: "sales",
      },
    },
    // 4. Deconstruct the referredInfo array to a single object
    { $unwind: "$referredInfo" },
    // 5. Calculate stats and reshape the document
    {
      $project: {
        _id: 1,
        status: 1, // Keep original status for comparison
        referrer: 1,
        referred: {
          _id: "$referredInfo._id",
          firstName: "$referredInfo.firstName",
          lastName: "$referredInfo.lastName",
          email: "$referredInfo.email",
          createdAt: "$referredInfo.createdAt",
        },
        salesCount: { $size: "$sales" },
        totalRevenue: { $sum: "$sales.total_amount" },
      },
    },
  ]);
  return referrals;
};

/**
 * Generate referral link for salesperson
 */
export const getReferralLink = async (req, res) => {
  try {
    if (req.user.role !== "salesperson") {
      return res
        .status(403)
        .json({ message: "Only salespersons can generate referral links" });
    }

    let user = await User.findById(req.user._id);
    if (!user.referralCode) {
      user.referralCode = nanoid(8);
      await user.save();
    }

    const frontendUrl = config.frontendUrl;
    const referralLink = `${frontendUrl}/register?ref=${user.referralCode}`;

    res.json({ referralLink, code: user.referralCode });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Register a customer under a salesperson's referral
 */
export const registerWithReferral = async (referrerId, referredId) => {
  try {
    await Referral.create({
      referrer: referrerId,
      referred: referredId,
      status: "pending",
    });

    // Note: It's often better not to embed arrays of IDs that can grow indefinitely.
    // The Referral collection is already the source of truth for this relationship.
    // However, leaving this as is since it was in the original code.
    await User.findByIdAndUpdate(referrerId, {
      $push: { referredCustomers: referredId },
    });
  } catch (error) {
    console.error("Referral tracking failed:", error);
  }
};

/**
 * Get all referrals belonging to logged-in salesperson
 */
export const getMyReferrals = async (req, res) => {
  try {
    // 🚀 Use the single aggregation pipeline
    const referrals = await getAggregatedReferralData(req.user._id);
    const bulkUpdateOps = [];

    const formattedReferrals = referrals.map((r) => {
      const newStatus = r.salesCount > 0 ? "active" : "pending";
      // If status has changed, add an update operation to our bulk list
      if (r.status !== newStatus) {
        bulkUpdateOps.push({
          updateOne: {
            filter: { _id: r._id },
            update: { $set: { status: newStatus } },
          },
        });
      }

      return {
        id: r._id,
        name: `${r.referred.firstName} ${r.referred.lastName}`,
        email: r.referred.email,
        joinDate: r.referred.createdAt,
        status: newStatus,
        salesCount: r.salesCount,
      };
    });

    // 🚀 Perform all database updates in a single bulk operation
    if (bulkUpdateOps.length > 0) {
      await Referral.bulkWrite(bulkUpdateOps);
    }

    res.json(formattedReferrals);
  } catch (error) {
    console.error("Error fetching referrals:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get referral statistics for the logged-in salesperson
 */
export const getReferralStats = async (req, res) => {
  try {
    // 🚀 Use the single aggregation pipeline
    const referrals = await getAggregatedReferralData(req.user._id);

    let activeReferrals = 0;
    let totalSales = 0;
    let totalRevenue = 0;

    // ✨ No more database calls in the loop! Just process the results.
    for (const r of referrals) {
      if (r.salesCount > 0) {
        activeReferrals++;
      }
      totalSales += r.salesCount;
      totalRevenue += r.totalRevenue;
    }

    // This logic remains the same, but it's now fed by fast, pre-aggregated data.
    const teamHeadProgressCalc = (activeReferrals / 5) * 50 + (totalSales / 75) * 50;

    const stats = {
      totalReferrals: referrals.length,
      activeReferrals,
      totalSales,
      totalRevenue,
      yourBonus: totalRevenue * 0.02,
      progress: {
        referrals: {
          current: activeReferrals,
          target: 5,
          percentage: Math.floor((activeReferrals / 5) * 100),
        },
        sales: {
          current: totalSales,
          target: 75,
          percentage: Math.floor((totalSales / 75) * 100),
        },
      },
      isTeamHead: req.user.role === "team_head",
      teamHeadProgress: Math.floor(Math.min(100, teamHeadProgressCalc)),
    };

    res.json(stats);
  } catch (error) {
    console.error("Error in getReferralStats:", error);
    res.status(500).json({ message: error.message });
  }
};


/**
 * Check referral-based promotion for a salesperson
 * This is now a more logical check based on active referrals and their sales.
 */
export const checkReferralPromotion = async (req, res) => {
  try {
    const { salesPersonId } = req.params;

    // This setting could define what makes a referral "qualified"
    // For now, let's hardcode the logic as:
    // 5 active referrals, and 75 total sales from all referrals.
    // This matches the progress bar logic in getReferralStats.
    const PROMOTION_TARGET = {
        requiredActiveReferrals: 5,
        requiredTotalSales: 75,
    };

    // Use the single aggregation pipeline
    const referrals = await getAggregatedReferralData(salesPersonId);

    let activeReferrals = 0;
    let totalSales = 0;
    
    for (const r of referrals) {
        if (r.salesCount > 0) {
            activeReferrals++;
        }
        totalSales += r.salesCount;
    }

    // ✅ Corrected promotion logic
    if (
      activeReferrals >= PROMOTION_TARGET.requiredActiveReferrals &&
      totalSales >= PROMOTION_TARGET.requiredTotalSales
    ) {
      await User.findByIdAndUpdate(salesPersonId, { role: "team_head" });
      console.log("🎉 Promotion granted to salesperson:", salesPersonId);
      return res.json({ message: "Promotion granted!", promoted: true });
    }

    res.json({ message: "Promotion criteria not met.", promoted: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};