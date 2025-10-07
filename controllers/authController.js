import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import CustomerCode from "../models/CustomerCode.js";
import Referral from "../models/Referral.js";

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" });

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, customerCode, referralCode } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    // Check email duplicate
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Role-specific logic
    if (role === "customer") {
      // Validate customer code
      const regCode = await CustomerCode.findOne({ code: customerCode, isActive: true });
      if (!regCode) {
        return res.status(400).json({ message: "Invalid or inactive customer code" });
      }
      if (regCode.usageLimit && regCode.usageCount >= regCode.usageLimit) {
        return res.status(400).json({ message: "Customer code usage limit reached" });
      }

      // Update usage
      regCode.usageCount += 1;
      if (regCode.usageLimit && regCode.usageCount >= regCode.usageLimit) {
        regCode.isActive = false;
      }
      await regCode.save();
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      firstName,
      lastName,
      email,
      passwordHash,
      role
    });
    await user.save();

    // If salesperson has referral
    if (role === "salesperson" && referralCode) {
      const referrer = await User.findOne({ referralCode, role: "salesperson" });
      if (referrer) {
        await Referral.create({
          referrer: referrer._id,
          referred: user._id,
          activatedAt: new Date()
        });
      }
    }

    // JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Registration successful",
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


// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });


    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });


  } catch (error) {
    console.error("Error in loginUser:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
