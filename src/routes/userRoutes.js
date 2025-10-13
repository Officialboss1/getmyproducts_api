import express from "express";
import { registerUser, loginUser, getAllUsers, createAdmin, updateUser, deleteUser, sendMessage, getUserProfile, updateUserProfile, deleteAvatar } from "../controllers/userController.js";
import { updateUserRole } from "../controllers/userController.js";
import { protect } from "../middlewares/authMiddleware.js";
import avatarUpload from "../middlewares/avatarUploadMiddleware.js";

const router = express.Router();

console.log('userRoutes loaded');

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/admin", protect, createAdmin);
router.put("/:id", protect, updateUser);
router.put("/:id/role", protect, updateUserRole);
router.post("/:id/message", protect, sendMessage);
router.delete("/:id", protect, deleteUser);

// GET all users (super_admin / admin only)
router.get("/", protect, getAllUsers);

// Profile CRUD routes
router.get("/:id/profile", protect, getUserProfile);
router.put("/:id/profile", protect, avatarUpload, updateUserProfile);
router.delete("/:id/avatar", protect, deleteAvatar);

export default router;
