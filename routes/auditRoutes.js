import express from "express";
import { getAuditLogs, getRecentActivities} from "../controllers/auditController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOrSuper } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Debug: print NODE_ENV when routes are loaded (dev troubleshooting)
console.log('auditRoutes loaded, NODE_ENV=', process.env.NODE_ENV);

// Only Admin and Super Admin should access this
router.get("/", protect, adminOrSuper, getAuditLogs);
router.get("/recent", protect, adminOrSuper, getRecentActivities);

// Dev-only: expose a non-protected recent activities route for local testing
if (process.env.NODE_ENV !== 'production') {
	router.get('/dev/recent', async (req, res) => {
		try {
			// Reuse controller logic by calling the controller function directly is awkward here,
			// so replicate minimal logic to avoid importing middleware or auth.
			const limit = parseInt(req.query.limit, 10) || 10;
			const SalesAudit = (await import('../models/SalesAudit.js')).default;
			const recent = await SalesAudit.find({})
				.sort({ createdAt: -1 })
				.limit(limit)
				.populate('editor_user_id', 'firstName lastName role')
				.populate('sale_id', 'receiver_email quantity_sold total_amount');

			res.status(200).json(recent);
		} catch (err) {
			console.error('Dev recent activities error:', err);
			res.status(500).json({ message: 'Dev: Failed to fetch recent activities' });
		}
	});
}

export default router;
