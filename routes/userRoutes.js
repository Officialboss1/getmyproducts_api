import express from "express";
import { registerUser, loginUser, getAllUsers } from "../controllers/userController.js";
import { updateUserRole } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.put("/:id/role", protect, updateUserRole);

// GET all users (super_admin / admin only)
router.get("/", protect, getAllUsers);

export default router;
