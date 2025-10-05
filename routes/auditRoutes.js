import express from "express";
import { getAuditLogs } from "../controllers/auditController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOrSuper } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Only Admin and Super Admin should access this
router.get("/", protect, adminOrSuper, getAuditLogs);

export default router;
