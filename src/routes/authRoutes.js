import express from "express";
import { register, loginUser, forgotPassword, resetPassword } from "../controllers/authController.js";
import { validateRegistration, validateLogin, validatePasswordReset } from "../middlewares/validation.js";

const router = express.Router();

router.post("/register", validateRegistration, register);
router.post("/login", validateLogin, loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", validatePasswordReset, resetPassword);

export default router;
