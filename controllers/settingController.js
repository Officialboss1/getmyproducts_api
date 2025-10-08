import Setting from "../models/Setting.js";
import Referral from "../models/Referral.js";
import User from "../models/User.js";
import Sale from "../models/Sale.js";

// GET referral settings
export const getReferralSettings = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    let referral = await Setting.findOne({ key: "referral" });
    if (!referral) {
      // if not seeded yet, return defaults
      referral = {
        key: "referral",
        value: {
          requiredReferrals: 3,
          requiredSalesPerReferral: 5,
          referralBonus: 0.02, // percentage
          teamHeadBonus: 0.05, // percentage
          maxReferralBonus: 1000,
          autoPromotion: true,
          notificationEnabled: true,
          enabled: true,
        },
      };
    }

    // Calculate stats
    const totalReferrals = await Referral.countDocuments();
    const activeReferrals = await Referral.countDocuments({ status: "completed" });
    const teamHeads = await User.countDocuments({ role: "team_head" });
    const totalSalesResult = await Sale.aggregate([
      { $group: { _id: null, total: { $sum: "$total_amount" } } }
    ]);
    const totalRevenue = totalSalesResult[0]?.total || 0;
    const totalBonuses = totalRevenue * (referral.value.referralBonus || 0.02);

    const stats = {
      totalReferrals,
      activeReferrals,
      teamHeads,
      totalBonuses: Math.round(totalBonuses * 100) / 100, // round to 2 decimals
    };

    // Get history: recent 20 referrals with sales count and bonus
    const history = await Referral.aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: "users",
          localField: "referrer",
          foreignField: "_id",
          as: "referrerInfo",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "referred",
          foreignField: "_id",
          as: "referredInfo",
        },
      },
      {
        $lookup: {
          from: "sales",
          localField: "referred",
          foreignField: "user_id",
          as: "sales",
        },
      },
      {
        $project: {
          _id: 1,
          status: 1,
          createdAt: 1,
          referrer: {
            $concat: [
              { $arrayElemAt: ["$referrerInfo.firstName", 0] },
              " ",
              { $arrayElemAt: ["$referrerInfo.lastName", 0] },
            ],
          },
          referred: {
            $concat: [
              { $arrayElemAt: ["$referredInfo.firstName", 0] },
              " ",
              { $arrayElemAt: ["$referredInfo.lastName", 0] },
            ],
          },
          salesCount: { $size: "$sales" },
          totalRevenue: { $sum: "$sales.total_amount" },
        },
      },
    ]).then((refs) =>
      refs.map((r) => ({
        id: r._id,
        referrer: r.referrer,
        referred: r.referred,
        date: r.createdAt,
        status: r.status,
        sales: r.salesCount,
        bonus: Math.round(r.totalRevenue * (referral.value.referralBonus || 0.02) * 100) / 100,
      }))
    );

    res.json({
      ...referral.value,
      stats,
      history,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE referral settings
export const updateReferralSettings = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const {
      requiredReferrals,
      requiredSalesPerReferral,
      referralBonus,
      teamHeadBonus,
      maxReferralBonus,
      autoPromotion,
      notificationEnabled,
      enabled,
    } = req.body;

    if (requiredReferrals === undefined || requiredSalesPerReferral === undefined) {
      return res.status(400).json({ message: "Missing required fields: requiredReferrals and requiredSalesPerReferral" });
    }

    // Validation
    if (typeof requiredReferrals !== 'number' || requiredReferrals < 1) {
      return res.status(400).json({ message: "requiredReferrals must be a number >= 1" });
    }
    if (typeof requiredSalesPerReferral !== 'number' || requiredSalesPerReferral < 1) {
      return res.status(400).json({ message: "requiredSalesPerReferral must be a number >= 1" });
    }
    if (referralBonus !== undefined && (typeof referralBonus !== 'number' || referralBonus < 0 || referralBonus > 1)) {
      return res.status(400).json({ message: "referralBonus must be a number between 0 and 1" });
    }
    if (teamHeadBonus !== undefined && (typeof teamHeadBonus !== 'number' || teamHeadBonus < 0 || teamHeadBonus > 1)) {
      return res.status(400).json({ message: "teamHeadBonus must be a number between 0 and 1" });
    }
    if (maxReferralBonus !== undefined && (typeof maxReferralBonus !== 'number' || maxReferralBonus < 0)) {
      return res.status(400).json({ message: "maxReferralBonus must be a number >= 0" });
    }
    if (autoPromotion !== undefined && typeof autoPromotion !== 'boolean') {
      return res.status(400).json({ message: "autoPromotion must be a boolean" });
    }
    if (notificationEnabled !== undefined && typeof notificationEnabled !== 'boolean') {
      return res.status(400).json({ message: "notificationEnabled must be a boolean" });
    }
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return res.status(400).json({ message: "enabled must be a boolean" });
    }

    const value = {
      requiredReferrals,
      requiredSalesPerReferral,
      referralBonus: referralBonus ?? 0.02,
      teamHeadBonus: teamHeadBonus ?? 0.05,
      maxReferralBonus: maxReferralBonus ?? 1000,
      autoPromotion: autoPromotion ?? true,
      notificationEnabled: notificationEnabled ?? true,
      enabled: enabled ?? true,
    };

    let referral = await Setting.findOneAndUpdate(
      { key: "referral" },
      { value },
      { new: true, upsert: true }
    );

    res.json({
      message: "Referral settings updated successfully",
      referral: referral.value,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET activity settings (who counts as 'active')
export const getActivitySettings = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    let activity = await Setting.findOne({ key: "activity" });
    if (!activity) {
      // defaults: consider users active if they logged in or had sales in the last 30 days
      activity = {
        key: "activity",
        value: { salespersonActiveDays: 30, customerActiveDays: 30 },
      };
    }

    res.json(activity.value);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE activity settings
export const updateActivitySettings = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { salespersonActiveDays, customerActiveDays } = req.body;

    if (typeof salespersonActiveDays !== 'number' || typeof customerActiveDays !== 'number') {
      return res.status(400).json({ message: "Invalid payload - expected numeric days" });
    }

    const activity = await Setting.findOneAndUpdate(
      { key: "activity" },
      { value: { salespersonActiveDays, customerActiveDays } },
      { new: true, upsert: true }
    );

    res.json({ message: "Activity settings updated", activity: activity.value });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET global targets
export const getGlobalTargets = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    let targets = await Setting.findOne({ key: "targets" });
    if (!targets) {
      // defaults
      targets = {
        key: "targets",
        value: { daily: 30, weekly: 210, monthly: 900 },
      };
    }

    res.json(targets.value);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE global targets
export const updateGlobalTargets = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { daily, weekly, monthly } = req.body;

    if (typeof daily !== 'number' || typeof weekly !== 'number' || typeof monthly !== 'number') {
      return res.status(400).json({ message: "Invalid payload - expected numeric values for daily, weekly, monthly" });
    }

    const targets = await Setting.findOneAndUpdate(
      { key: "targets" },
      { value: { daily, weekly, monthly } },
      { new: true, upsert: true }
    );

    res.json({
      message: "Global targets updated successfully",
      targets: targets.value,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET system settings
export const getSystemSettings = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    let system = await Setting.findOne({ key: "system" });
    if (!system) {
      // defaults
      system = {
        key: "system",
        value: { appName: "Sales Tracker", version: "1.0.0", maintenanceMode: false },
      };
    }

    res.json(system.value);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE system settings
export const updateSystemSettings = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { appName, version, maintenanceMode } = req.body;

    if (typeof appName !== 'string' || typeof version !== 'string' || typeof maintenanceMode !== 'boolean') {
      return res.status(400).json({ message: "Invalid payload - expected string for appName and version, boolean for maintenanceMode" });
    }

    const system = await Setting.findOneAndUpdate(
      { key: "system" },
      { value: { appName, version, maintenanceMode } },
      { new: true, upsert: true }
    );

    res.json({
      message: "System settings updated successfully",
      system: system.value,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
