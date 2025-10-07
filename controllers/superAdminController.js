import Sale from "../models/Sale.js";
import User from "../models/User.js";
import Activity from "../models/Activitymodel.js";

// GET /api/sales/summary
export const getSalesSummary = async (req, res) => {
  try {
    // total number of sales
    const totalSales = await Sale.countDocuments();

    // total revenue from all sales
    const revenueAgg = await Sale.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } }
    ]);
    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

    // top performers (by total sales count)
    const topPerformers = await User.aggregate([
      { $match: { role: "salesperson" } },
      { $lookup: {
          from: "sales",
          localField: "_id",
          foreignField: "salesperson",
          as: "sales"
        }
      },
      { $addFields: { totalSales: { $size: "$sales" } } },
      { $sort: { totalSales: -1 } },
      { $limit: 5 },
      { $project: { name: 1, totalSales: 1 } }
    ]);

    res.json({
      totalSales,
      totalRevenue,
      topPerformers
    });
  } catch (err) {
    console.error("Error fetching sales summary:", err);
    res.status(500).json({ message: "Failed to fetch sales summary" });
  }
};

// GET /api/activities/recent
export const getRecentActivities = async (req, res) => {
  try {
    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(activities);
  } catch (err) {
    console.error("Error fetching recent activities:", err);
    res.status(500).json({ message: "Failed to fetch recent activities" });
  }
};
