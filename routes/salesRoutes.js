import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { createSale, getSales, updateSale, deleteSale } from "../controllers/salesController.js";

const router = express.Router();

router.get("/", protect, getSales);
router.post("/", protect, createSale);
router.put("/:id", protect, authorizeRoles("admin", "super_admin"), updateSale);
router.delete("/:id", protect, authorizeRoles("admin", "super_admin"), deleteSale);

export default router;
