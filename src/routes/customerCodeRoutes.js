// routes/customerCodeRoutes.js
import express from "express";
import { generateCustomerCode, validateCustomerCode, registerCustomer, listCustomerCodes,
  deactivateCustomerCode } from "../controllers/customerCodeController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/generate", protect, generateCustomerCode);   // admin/super_admin only
router.post("/validate", validateCustomerCode);            // anyone can validate before register
router.post("/register", registerCustomer);                // customer registration


// Admin / Super Admin only
router.get("/", protect, listCustomerCodes);
router.put("/:id/deactivate", protect, deactivateCustomerCode);


export default router;
