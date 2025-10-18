// controllers/competitionController.js
import Competition from "../models/Competition.js";
import Sale from "../models/Sale.js";
import User from "../models/User.js";
import Activity from "../models/Activitymodel.js";

/* =========================================
 * CREATE COMPETITION (Admin / Super Admin only)
 * ========================================= */
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

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: "create competition",
      details: `Created competition: ${name}`,
    });

    res.status(201).json(competition);
  } catch (err) {
    console.error("Competition create error:", err);
    res.status(500).json({ message: "Failed to create competition", error: err.message });
  }
};

/* =========================================
 * CREATE GLOBAL COMPETITION (Super Admin only)
 * Accessible to all users (participants array empty)
 * ========================================= */
export const createGlobalCompetition = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Only super admins can create global competitions" });
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
      // participants: [] // empty array means all users participate
    });

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: "create global competition",
      details: `Created global competition: ${name}`,
    });

    res.status(201).json(competition);
  } catch (err) {
    console.error("Global competition create error:", err);
    res.status(500).json({ message: "Failed to create global competition", error: err.message });
  }
};

/* =========================================
  * GET ONGOING COMPETITIONS
  * (Active or within date range)
  * ========================================= */
export const getCompetitions = async (req, res) => {
  try {

    const now = new Date();
    const competitions = await Competition.find({
      $or: [{ isActive: true }, { startDate: { $lte: now }, endDate: { $gte: now } }],
    })
      .populate("participants.user", "firstName lastName email role")
      .sort({ startDate: -1 });

    res.json(competitions);
  } catch (err) {
    console.error("Competition fetch error:", err);
    res.status(500).json({ message: "Failed to fetch competitions", error: err.message });
  }
};

/* =========================================
 * GET COMPETITION LEADERBOARD
 * ========================================= */
export const getCompetitionLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;
    const competition = await Competition.findById(id);
    if (!competition) return res.status(404).json({ message: "Competition not found" });

    // Collect participant IDs
    const participantIds = (competition.participants || []).map((p) => p.user).filter(Boolean);

    // Build sales query filter - show all-time data for competition leaderboard
    const match = {
      sale_date: { $gte: competition.startDate, $lte: competition.endDate },
    };
    if (participantIds.length) match.user_id = { $in: participantIds };

    // Aggregate leaderboard data
    const leaderboard = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$user_id",
          totalUnits: { $sum: "$quantity_sold" },
          totalRevenue: { $sum: "$total_amount" },
        },
      },
      { $sort: { totalUnits: -1, totalRevenue: -1 } },
      { $limit: 50 },
    ]);

    // Populate user info
    const populated = await User.populate(leaderboard, {
      path: "_id",
      select: "firstName lastName email role",
    });

    const mapped = populated.map((row, idx) => ({
      rank: idx + 1,
      user: {
        _id: row._id,
        name:
          `${row._id?.firstName || ""} ${row._id?.lastName || ""}`.trim() ||
          row._id?.email,
        email: row._id?.email,
        role: row._id?.role,
      },
      units: row.totalUnits || 0,
      revenue: row.totalRevenue || 0,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Competition leaderboard error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch competition leaderboard", error: err.message });
  }
};

// Get a single competition by id
export const getCompetitionById = async (req, res) => {
  try {
    const { id } = req.params;
    const competition = await Competition.findById(id).populate("participants.user", "firstName lastName email role");
    if (!competition) return res.status(404).json({ message: "Competition not found" });
    res.json(competition);
  } catch (err) {
    console.error("Get competition error:", err);
    res.status(500).json({ message: "Failed to fetch competition", error: err.message });
  }
};

/* =========================================
 * JOIN COMPETITION
 * ========================================= */
export const joinCompetition = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user && (req.user._id || req.user.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const competition = await Competition.findById(id);
    if (!competition) return res.status(404).json({ message: "Competition not found" });

    const alreadyJoined = (competition.participants || []).some(
      (p) => String(p.user) === String(userId)
    );
    if (alreadyJoined)
      return res.status(200).json({ message: "Already joined competition" });

    competition.participants.push({ user: userId });
    await competition.save();

    res.json({ message: "Joined competition successfully", competitionId: competition._id });
  } catch (err) {
    console.error("Join competition error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* =========================================
 * LEAVE COMPETITION
 * ========================================= */
export const leaveCompetition = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user && (req.user._id || req.user.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const competition = await Competition.findById(id);
    if (!competition) return res.status(404).json({ message: "Competition not found" });

    competition.participants = (competition.participants || []).filter(
      (p) => String(p.user) !== String(userId)
    );
    await competition.save();

    res.json({ message: "Left competition successfully", competitionId: competition._id });
  } catch (err) {
    console.error("Leave competition error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* =========================================
 * EXPORT ALL FUNCTIONS
 * ========================================= */
export default {
  createCompetition,
  createGlobalCompetition,
  getCompetitions,
  getCompetitionLeaderboard,
  getCompetitionById,
  joinCompetition,
  leaveCompetition,
};
