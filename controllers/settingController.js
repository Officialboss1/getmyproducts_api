import Setting from "../models/Setting.js";

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
        value: { requiredReferrals: 3, requiredSalesPerReferral: 5 },
      };
    }

    res.json(referral.value);
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

    const { requiredReferrals, requiredSalesPerReferral } = req.body;

    if (!requiredReferrals || !requiredSalesPerReferral) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let referral = await Setting.findOneAndUpdate(
      { key: "referral" },
      { value: { requiredReferrals, requiredSalesPerReferral } },
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
