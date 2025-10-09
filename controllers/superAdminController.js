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
      { $group: { _id: null, totalRevenue: { $sum: "$total_amount" } } }
    ]);
    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

    // top performers (by total sales count)
    const topPerformers = await User.aggregate([
      { $match: { role: "salesperson" } },
      { $lookup: {
          from: "sales",
          localField: "_id",
          foreignField: "user_id",
          as: "sales"
        }
      },
      { $addFields: { totalSales: { $size: "$sales" } } },
      { $sort: { totalSales: -1 } },
      { $limit: 5 },
      { $project: {
          _id: 1,
          name: { $concat: ["$firstName", " ", "$lastName"] },
          totalSales: 1
        }
      }
    ]);

    // system health calculation: percentage of salespersons with at least one sale
    const totalSalespersons = await User.countDocuments({ role: "salesperson" });
    const activeSalespersonsAgg = await User.aggregate([
      { $match: { role: "salesperson" } },
      { $lookup: {
          from: "sales",
          localField: "_id",
          foreignField: "user_id",
          as: "sales"
        }
      },
      { $match: { "sales.0": { $exists: true } } },
      { $count: "active" }
    ]);
    const activeCount = activeSalespersonsAgg[0]?.active || 0;
    const systemHealth = totalSalespersons > 0 ? Math.round((activeCount / totalSalespersons) * 100) : 100;

    res.json({
      totalSales,
      totalRevenue,
      topPerformers,
      systemHealth
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
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(activities);
  } catch (err) {
    console.error("Error fetching recent activities:", err);
    res.status(500).json({ message: "Failed to fetch recent activities" });
  }
};
