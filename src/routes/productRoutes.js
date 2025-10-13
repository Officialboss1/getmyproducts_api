import express from "express";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  exportProducts,
} from "../controllers/productController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin and Super Admin can view products
router.get("/", getProducts);
router.get("/export", authorizeRoles("admin", "super_admin"), exportProducts);

// Get single product
router.get("/:id", getProduct);

// Super Admin only for create/update/delete
router.post("/", authorizeRoles("super_admin"), createProduct);
router.put("/:id", authorizeRoles("super_admin"), updateProduct);
router.delete("/:id", authorizeRoles("super_admin"), deleteProduct);

// Toggle product status (Super Admin only)
router.patch("/:id/toggle-status", authorizeRoles("super_admin"), toggleProductStatus);

export default router;
