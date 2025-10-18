import Target from "../models/Target.js";

// @desc Set or update custom targets (Admin / Super Admin only)
export const setTarget = async (req, res) => {
  try {
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    const { userId, daily, weekly, monthly } = req.body;

    const target = await Target.findOneAndUpdate(
      { user_id: userId },
      {
        daily: daily ?? 30,
        weekly: weekly ?? 210,
        monthly: monthly ?? 900,
        setBy: req.user.id,
      },
      { new: true, upsert: true }
    );

    res.status(201).json(target);
  } catch (error) {
    console.error("Set target error:", error);
    res.status(500).json({ message: "Failed to set target" });
  }
};

// @desc Get a user’s target (admin can view any, user can only view own)
export const getTarget = async (req, res) => {
  try {

    const requestedUserId = req.params.userId || req.user.id;


    if (req.user.role === "salesperson" && requestedUserId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: You can only view your own target" });
    }

    let target = await Target.findOne({ user_id: requestedUserId });

    if (!target) {
      target = { daily: 30, weekly: 210, monthly: 900 };
    }

    res.json(target);
  } catch (error) {
    console.error("Get target error:", error);
    res.status(500).json({ message: "Failed to fetch target", error: error.message });
  }
};


// @desc Delete a user’s custom target (revert to defaults)
export const deleteTarget = async (req, res) => {
  try {
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    await Target.findOneAndDelete({ user_id: req.params.userId });
    res.json({ message: "Custom target deleted, user will fallback to defaults" });
  } catch (error) {
    console.error("Delete target error:", error);
    res.status(500).json({ message: "Failed to delete target" });
  }
};
