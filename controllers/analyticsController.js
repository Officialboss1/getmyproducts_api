import mongoose from "mongoose";
import Sale from "../models/Sale.js";
import User from "../models/User.js";
import Target from "../models/Target.js";

// Helper: get start-of-period date
const getPeriodRange = (period) => {
  const now = new Date();
  let start;

  if (period === "daily") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "weekly") {
    const day = now.getDay(); // 0 = Sunday
    start = new Date(now);
    start.setDate(now.getDate() - day); // go back to Sunday
    start.setHours(0, 0, 0, 0);
  } else if (period === "monthly") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    throw new Error("Invalid period specified");
  }

  return start;
};

// 🎯 USER PROGRESS
export const getUserProgress = async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    const start = getPeriodRange(period);
    const requestedUserId = req.params.userId || req.user.id;

    // Restrict sales_person to only their own progress
    if (req.user.role === "sales_person" && requestedUserId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: You can only view your own progress" });
    }

    // Fetch sales for this user in this period
    const sales = await Sale.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(requestedUserId), sale_date: { $gte: start } } },
      {
        $group: {
          _id: null,
          totalUnits: { $sum: "$quantity_sold" },
          totalRevenue: { $sum: "$total_amount" },
        },
      },
    ]);

    const totals = sales[0] || { totalUnits: 0, totalRevenue: 0 };

    // Step 1: check for custom target
    let targetDoc = await Target.findOne({ user_id: requestedUserId });
    const defaults = { daily: 30, weekly: 210, monthly: 900 };

    const target = targetDoc && targetDoc[period] ? targetDoc[period] : defaults[period];

    // Step 2: calculate percentage & status
    const percentage = ((totals.totalUnits / target) * 100).toFixed(2);
    let status =
      totals.totalUnits >= target
        ? "Target Met"
        : totals.totalUnits >= target / 2
        ? "On Track"
        : "Needs Boost";

    res.json({
      userId: requestedUserId,
      period,
      totalUnits: totals.totalUnits,
      totalRevenue: totals.totalRevenue,
      target,
      percentage,
      status,
    });
  } catch (error) {
    console.error("Progress error:", error);
    res.status(500).json({ message: "Failed to fetch user progress" });
  }
};

// 🏆 LEADERBOARD
export const getLeaderboard = async (req, res) => {
  try {
    const { period = "monthly", metric = "units", product } = req.query;
    const start = getPeriodRange(period);

    const matchStage = { sale_date: { $gte: start } };
    if (product) matchStage.product_name = product;

    const leaderboard = await Sale.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$user_id",
          totalUnits: { $sum: "$quantity_sold" },
          totalRevenue: { $sum: "$total_amount" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$_id",
          name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
          totalUnits: 1,
          totalRevenue: 1,
        },
      },
      { $sort: metric === "revenue" ? { totalRevenue: -1 } : { totalUnits: -1 } },
    ]);

    res.json(leaderboard);
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
};

// 📊 DAILY SALES (PER USER)
export const getDailySalesByUser = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const dailySales = await Sale.aggregate([
      {
        $match: {
          sale_date: { $gte: startOfDay },
        },
      },
      {
        $group: {
          _id: "$user_id",
          totalUnits: { $sum: "$quantity_sold" },
          totalRevenue: { $sum: "$total_amount" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$_id",
          name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
          role: "$user.role",
          totalUnits: 1,
          totalRevenue: 1,
        },
      },
      { $sort: { totalUnits: -1 } },
    ]);

    res.json({
      date: startOfDay.toISOString().split("T")[0],
      count: dailySales.length,
      data: dailySales,
    });
  } catch (error) {
    console.error("Daily Sales error:", error);
    res.status(500).json({ message: "Failed to fetch daily sales per user" });
  }
};
