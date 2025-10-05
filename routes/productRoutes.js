import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

const router = express.Router();

router.get("/", protect, getProducts);
router.post("/", protect, authorizeRoles("super_admin"), createProduct);
router.put("/:id", protect, authorizeRoles("super_admin"), updateProduct);
router.delete("/:id", protect, authorizeRoles("super_admin"), deleteProduct);

export default router;
