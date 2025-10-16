import mongoose from "mongoose";
import Sale from "../models/Sale.js";
import User from "../models/User.js";
import Target from "../models/Target.js";
import Customer from "../models/CustomerCode.js";
import Competition from "../models/Competition.js";
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';

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

// SYSTEM ANALYTICS — used by ADMIN DASHBOARD
export const getSystemAnalytics = async (req, res) => {
  try {
    const totalSales = await Sale.countDocuments();
    const totalRevenueAgg = await Sale.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: "$total_amount" } } },
    ]);
    const totalRevenue = totalRevenueAgg[0]?.totalRevenue || 0;

    // Load activity settings (defaults if not set)
    let activitySettings = { salespersonActiveDays: 30, customerActiveDays: 30 };
    try {
      const settingDoc = await import("../models/Setting.js");
      const Setting = settingDoc.default;
      const activity = await Setting.findOne({ key: "activity" });
      if (activity && activity.value) activitySettings = { ...activitySettings, ...activity.value };
    } catch (err) {
      // if settings model import fails for any reason, fall back to defaults
      console.warn("Could not load activity settings, using defaults", err.message);
    }

    const now = new Date();
    const salespersonSince = new Date(now.getTime() - (activitySettings.salespersonActiveDays || 30) * 24 * 60 * 60 * 1000);
    const customerSince = new Date(now.getTime() - (activitySettings.customerActiveDays || 30) * 24 * 60 * 60 * 1000);

    const activeSalespersons = await User.countDocuments({
      role: "salesperson",
      $or: [
        { lastLogin: { $gte: salespersonSince } },
        { lastSaleDate: { $gte: salespersonSince } },
      ],
    });

    const activeCustomers = await User.countDocuments({
      role: "customer",
      lastLogin: { $gte: customerSince },
    });

    // Count competitions that are currently active by flag or by date range
    const nowDate = new Date();
    const ongoingCompetitions = await Competition.countDocuments({
      $or: [
        { isActive: true },
        { startDate: { $lte: nowDate }, endDate: { $gte: nowDate } },
      ],
    });

    // Estimate target achievement (monthly basis)
    // If activeSalespersons is zero, fall back to total registered salespersons
    const totalSalespersonsCount = await User.countDocuments({ role: 'salesperson' });
    const totalTargets = (activeSalespersons > 0 ? activeSalespersons : totalSalespersonsCount) * 900; // default monthly target
    const targetAchievement = totalTargets > 0 ? ((totalSales / totalTargets) * 100).toFixed(1) : 0;

    // Generate sales trend data for charts
    const salesTrend = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthSales = await Sale.aggregate([
        {
          $match: {
            sale_date: { $gte: monthStart, $lte: monthEnd }
          }
        },
        {
          $group: {
            _id: null,
            totalUnits: { $sum: "$quantity_sold" },
            totalRevenue: { $sum: "$total_amount" }
          }
        }
      ]);


      const salesData = monthSales[0] || { totalUnits: 0, totalRevenue: 0 };
      const monthName = months[5 - i];

      salesTrend.push({
        month: monthName,
        sales: salesData.totalUnits,
        revenue: salesData.totalRevenue,
        target: 900 // Default monthly target
      });
    }

    // Product distribution data
    const productDistribution = await Sale.aggregate([
      {
        $group: {
          _id: "$product_name",
          value: { $sum: "$quantity_sold" }
        }
      },
      {
        $project: {
          name: "$_id",
          value: 1,
          _id: 0
        }
      },
      { $sort: { value: -1 } },
      { $limit: 5 }
    ]);

    // Monthly comparison data (current year vs last year)
    const monthlyComparison = [];
    for (let i = 5; i >= 0; i--) {
      const currentYearMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const lastYearMonth = new Date(now.getFullYear() - 1, now.getMonth() - i, 1);

      const currentYearSales = await Sale.aggregate([
        {
          $match: {
            sale_date: {
              $gte: currentYearMonth,
              $lt: new Date(currentYearMonth.getFullYear(), currentYearMonth.getMonth() + 1, 1)
            }
          }
        },
        { $group: { _id: null, totalUnits: { $sum: "$quantity_sold" } } }
      ]);

      const lastYearSales = await Sale.aggregate([
        {
          $match: {
            sale_date: {
              $gte: lastYearMonth,
              $lt: new Date(lastYearMonth.getFullYear(), lastYearMonth.getMonth() + 1, 1)
            }
          }
        },
        { $group: { _id: null, totalUnits: { $sum: "$quantity_sold" } } }
      ]);

      monthlyComparison.push({
        month: months[5 - i],
        currentYear: currentYearSales[0]?.totalUnits || 0,
        lastYear: lastYearSales[0]?.totalUnits || 0
      });
    }

    // Performance insights
    const bestMonth = salesTrend.reduce((best, current) =>
      current.sales > best.sales ? current : best, salesTrend[0]
    );

    const growthRate = salesTrend.length >= 2 ?
      ((salesTrend[salesTrend.length - 1].sales - salesTrend[salesTrend.length - 2].sales) /
       (salesTrend[salesTrend.length - 2].sales || 1) * 100).toFixed(1) : 0;

    const consistencyScore = Math.min(100, Math.max(0,
      100 - (salesTrend.reduce((acc, curr, idx, arr) => {
        if (idx === 0) return 0;
        const prev = arr[idx - 1].sales;
        return acc + Math.abs(curr.sales - prev) / (prev || 1);
      }, 0) / (salesTrend.length - 1 || 1) * 100)
    ));

    res.status(200).json({
      totalSales,
      totalRevenue,
      activeSalespersons,
      activeCustomers,
      ongoingCompetitions,
      targetAchievement: Number(targetAchievement),
      activitySettings,
      salesTrend,
      productDistribution,
      monthlyComparison,
      bestMonth: bestMonth?.month,
      peakSales: bestMonth?.sales || 0,
      growthRate: Number(growthRate),
      consistencyScore: Math.round(consistencyScore),
    });
  } catch (error) {
    console.error("System Analytics Error:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch system analytics", error: error.message });
  }
};

// USER PROGRESS
export const getUserProgress = async (req, res) => {
  try {
    console.log("getUserProgress called with params:", req.params, "query:", req.query);
    console.log("req.user:", req.user);

    const { period = "monthly" } = req.query;
    const start = getPeriodRange(period);
    const requestedUserId = req.params.userId || req.user.id;

    console.log("requestedUserId:", requestedUserId, "period:", period, "start:", start);

    if (req.user.role === "salesperson" && requestedUserId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: You can only view your own progress" });
    }

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

    console.log("Sales aggregation result:", sales);

    const totals = sales[0] || { totalUnits: 0, totalRevenue: 0 };
    let targetDoc = await Target.findOne({ user_id: requestedUserId });
    const defaults = { daily: 30, weekly: 210, monthly: 900 };
    const target = targetDoc && targetDoc[period] ? targetDoc[period] : defaults[period];

    console.log("Target doc:", targetDoc, "target value:", target);

    const percentage = ((totals.totalUnits / target) * 100).toFixed(2);
    const status =
      totals.totalUnits >= target
        ? "Target Met"
        : totals.totalUnits >= target / 2
        ? "On Track"
        : "Needs Boost";

    const result = {
      userId: requestedUserId,
      period,
      totalUnits: totals.totalUnits,
      totalRevenue: totals.totalRevenue,
      target,
      percentage,
      status,
    };

    console.log("Returning result:", result);
    res.json(result);
  } catch (error) {
    console.error("Progress error:", error);
    res.status(500).json({ message: "Failed to fetch user progress", error: error.message });
  }
};

// LEADERBOARD
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

// DAILY SALES (PER USER)
export const getDailySalesByUser = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const dailySales = await Sale.aggregate([
      { $match: { sale_date: { $gte: startOfDay } } },
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

// EXPORT ANALYTICS
export const exportAnalytics = async (req, res) => {
  try {
    const { format = 'csv' } = req.query;

    // Fetch all sales data for analytics export
    const sales = await Sale.find({})
      .populate('user_id', 'firstName lastName')
      .sort({ sale_date: -1 });

    const data = sales.map(sale => ({
      date: sale.sale_date.toISOString().split('T')[0],
      user: `${sale.user_id.firstName} ${sale.user_id.lastName}`,
      product: sale.product_name,
      quantity: sale.quantity_sold,
      amount: sale.total_amount,
      receiver: sale.receiver_email
    }));

    if (format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics.csv"');
      res.send(csv);
    } else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Analytics');
      worksheet.columns = [
        { header: 'Date', key: 'date' },
        { header: 'User', key: 'user' },
        { header: 'Product', key: 'product' },
        { header: 'Quantity', key: 'quantity' },
        { header: 'Amount', key: 'amount' },
        { header: 'Receiver', key: 'receiver' }
      ];
      worksheet.addRows(data);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics.xlsx"');
      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.status(400).json({ message: 'Invalid format. Use csv or excel.' });
    }
  } catch (error) {
    console.error("Export Analytics error:", error);
    res.status(500).json({ message: "Failed to export analytics" });
  }
};
