import Competition from "../models/Competition.js";
import Sale from "../models/Sale.js";
import User from "../models/User.js";

// 📌 Create competition (Admin / Super Admin only)
export const createCompetition = async (req, res) => {
  try {
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admins can create competitions" });
    }

    const { name, description, metric, product, startDate, endDate } = req.body;

    const competition = await Competition.create({
      name,
      description,
      metric,
      product,
      startDate,
      endDate,
      createdBy: req.user.id,
    });

    res.status(201).json(competition);
  } catch (err) {
    console.error("Competition create error:", err);
    res.status(500).json({ message: "Failed to create competition" });
  }
};

// 📌 Get all active competitions
export const getCompetitions = async (req, res) => {
  try {
    const now = new Date();
    const competitions = await Competition.find({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true,
    });
    res.json(competitions);
  } catch (err) {
    console.error("Competition fetch error:", err);
    res.status(500).json({ message: "Failed to fetch competitions" });
  }
};

// 📌 Leaderboard per competition
export const getCompetitionLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;
    const competition = await Competition.findById(id);
    if (!competition) return res.status(404).json({ message: "Competition not found" });

    const matchStage = {
      sale_date: { $gte: competition.startDate, $lte: competition.endDate },
    };
    if (competition.product) matchStage.product_name = competition.product;

    const leaderboard = await Sale.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$user_id",
          totalUnits: { $sum: "$quantity_sold" },
          totalRevenue: { $sum: "$total_amount" },
        },
      },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      {
        $project: {
          name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
          totalUnits: 1,
          totalRevenue: 1,
        },
      },
      {
        $sort:
          competition.metric === "revenue"
            ? { totalRevenue: -1 }
            : { totalUnits: -1 },
      },
    ]);

    // Add ranking (position field)
    const leaderboardWithRank = leaderboard.map((entry, index) => ({
      position: index + 1,
      ...entry,
    }));

    res.json({ competition, leaderboard: leaderboardWithRank });
  } catch (err) {
    console.error("Competition leaderboard error:", err);
    res.status(500).json({ message: "Failed to fetch competition leaderboard" });
  }
};
