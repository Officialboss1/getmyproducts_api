import SalesAudit from "../models/SalesAudit.js";

// @desc Get audit logs (Admin: team-level, Super Admin: global)
export const getAuditLogs = async (req, res) => {
  try {
    const { saleId, editorId } = req.query;
    let filter = {};

    if (saleId) filter.sale_id = saleId;
    if (editorId) filter.editor_user_id = editorId;

    // 🔹 If role is "admin", in the future we'll scope this to their team
    if (req.user.role === "admin") {
      // TODO: When User has teamId, filter logs for that team only
      // Example: filter.editor_user_id = { $in: teamUserIds }
    }

    const logs = await SalesAudit.find(filter)
      .populate("sale_id", "receiver_email quantity_sold total_amount")
      .populate("editor_user_id", "firstName lastName email role")
      .sort({ createdAt: -1 });

    res.json(logs);
  } catch (error) {
    console.error("Error fetching audit logs:", error.message);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
};
