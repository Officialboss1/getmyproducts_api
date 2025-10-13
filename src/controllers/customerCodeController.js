import CustomerCode from "../models/CustomerCode.js";
import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Admin/Super Admin: generate new code
export const generateCustomerCode = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const code = Math.random().toString(36).substring(2, 10).toUpperCase(); // 8-char code

    const newCode = await CustomerCode.create({
      code,
      createdBy: req.user._id,
      usageLimit: 1,         // default one-time use (can be adjusted later)
      usageCount: 0,
      isActive: true,
    });

    res.status(201).json(newCode);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Validate code before customer registers
export const validateCustomerCode = async (req, res) => {
  try {
    const { code } = req.body;
    const found = await CustomerCode.findOne({ code, isActive: true });

    if (!found) {
      return res.status(400).json({ message: "Invalid or inactive code" });
    }

    if (found.usageLimit && found.usageCount >= found.usageLimit) {
      return res.status(400).json({ message: "Code usage limit reached" });
    }

    res.json({ valid: true, code: found });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Register customer using code (your cleaned-up version)
export const registerCustomer = async (req, res) => {
  try {
    const { firstName, lastName, email, password, code } = req.body;

    // 1. Validate code
    const regCode = await CustomerCode.findOne({ code, isActive: true });
    if (!regCode) {
      return res.status(400).json({ message: "Invalid or inactive code" });
    }
    if (regCode.usageLimit && regCode.usageCount >= regCode.usageLimit) {
      return res.status(400).json({ message: "Code usage limit reached" });
    }

    // 2. Check duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Create user with customer role
    const user = new User({
      firstName,
      lastName,
      email,
      passwordHash,
      role: "customer"
    });
    await user.save();

  // 5. Update code usage
regCode.usageCount += 1;
regCode.usedBy.push(user._id);
regCode.usageLog.push({ user: user._id, usedAt: new Date() });

if (regCode.usageLimit && regCode.usageCount >= regCode.usageLimit) {
  regCode.isActive = false;
}
await regCode.save();

    // 6. Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ 
      message: "Customer registered successfully", 
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// GET all codes (Admin / Super Admin)
export const listCustomerCodes = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const codes = await CustomerCode.find()
      .populate("createdBy", "firstName lastName role email")
      .populate("usedBy", "firstName lastName email")
      .populate("usageLog.user", "firstName lastName email");

    res.json(codes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }

  console.log("listCustomerCodes hit by:", req.user?.role);
};




// PUT deactivate code
export const deactivateCustomerCode = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const code = await CustomerCode.findById(id);

    if (!code) return res.status(404).json({ message: "Code not found" });

    code.isActive = false;
    await code.save();

    res.json({ message: "Code deactivated successfully", code });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
