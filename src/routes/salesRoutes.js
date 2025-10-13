import express from "express";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import { createSale, getSales, updateSale, deleteSale, getSalesSummary } from "../controllers/salesController.js";
import { validateSale } from "../middlewares/validation.js";

const router = express.Router();

router.get("/", protect, getSales);
router.get("/summary", protect, authorizeRoles("super_admin"), getSalesSummary);
router.post("/", protect, validateSale, createSale);
router.put("/:id", protect, authorizeRoles("admin", "super_admin"), updateSale);
router.delete("/:id", protect, authorizeRoles("admin", "super_admin"), deleteSale);

export default router;
