import express from "express";
import { setTarget, getTarget, deleteTarget } from "../controllers/targetsController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin / Super Admin: create/update target
router.post("/", protect, setTarget);

// Get target (own or any user depending on role)
router.get("/", protect, getTarget);          // current user
router.get("/:userId", protect, getTarget);   // specific user

// Admin / Super Admin: delete target
router.delete("/:userId", protect, deleteTarget);

export default router;
