import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import CustomerCode from "../models/CustomerCode.js";
import Referral from "../models/Referral.js";
import nodemailer from "nodemailer";
import config from "../config/index.js";

const generateToken = (id, role) =>
  jwt.sign({ id, role }, config.jwtSecret, { expiresIn: "30d" });

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
      config.jwtSecret,
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
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate reset token (JWT with short expiration)
    const resetToken = jwt.sign(
      { id: user._id, type: 'password_reset' },
      config.jwtSecret,
      { expiresIn: '15m' }
    );

    // Create transporter with flexible SMTP configuration
    const transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      // Additional options for better compatibility
      tls: {
        rejectUnauthorized: false
      }
    });

    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset for your Sales Tracker account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Password reset email sent" });
  } catch (error) {
    res.status(500).json({ message: "Failed to send reset email" });
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }
    res.status(500).json({ message: "Failed to reset password" });
  }
};
