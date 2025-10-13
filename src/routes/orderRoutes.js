import express from "express";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  updateOrderStatus,
  getAvailableProducts,
  exportOrders,
  getSalespersonOrders,
} from "../controllers/orderController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin and Super Admin can view orders (with role-based filtering)
router.get("/", getOrders);
router.get("/export", authorizeRoles("admin", "super_admin"), exportOrders);

// Salesperson routes for viewing orders
router.get("/salesperson/orders", getSalespersonOrders);

// Get single order (with permissions check)
router.get("/:id", getOrder);

// Get available products for order creation
router.get("/products/available", getAvailableProducts);

// Admin and Super Admin can create orders
router.post("/", authorizeRoles("admin", "super_admin"), createOrder);

// Admin and Super Admin can update orders (with ownership check for admins)
router.put("/:id", authorizeRoles("admin", "super_admin"), updateOrder);

// Update order status (with ownership check for admins)
router.patch("/:id/status", authorizeRoles("admin", "super_admin"), updateOrderStatus);

// Admin and Super Admin can delete orders (with ownership check for admins)
router.delete("/:id", authorizeRoles("admin", "super_admin"), deleteOrder);

export default router;