import User from "../models/User.js";
import Sale from "../models/Sale.js";
import Activity from "../models/Activitymodel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" });

// Helper function to check if user can edit profile
const canEditProfile = (editorRole, targetRole, isOwn) => {
  if (editorRole === 'super_admin') return true;
  if (editorRole === 'admin') {
    const lowerRoles = ['salesperson', 'customer', 'team_head'];
    return isOwn || lowerRoles.includes(targetRole);
  }
  return isOwn;
};

export const registerUser = async (req, res) => {
  try {
    let { firstName, lastName, email, password, role } = req.body;

    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    email = email.toLowerCase();

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 🚨 Prevent arbitrary role escalation
    if (role === "super_admin") role = "salesperson";

    const user = await User.create({ firstName, lastName, email, passwordHash, role });

    // Log activity
    await Activity.create({
      user: user._id,
      action: "register",
      details: `New user registered as ${role}`,
    });

    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error during registration" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

  res.json({
    token: generateToken(user._id, user.role),
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    },
  });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
};



// @desc Update a user's role (Super Admin only)
export const updateUserRole = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Only Super Admin can change roles" });
    }

    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ["salesperson", "admin", "super_admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const previousRole = user.role;
    user.role = role;
    await user.save();

    res.json({
      message: `Role updated from '${previousRole}' to '${role}'`,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Failed to update user role" });
  }
};


// @desc Create a new admin (Super Admin only)
export const createAdmin = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Only Super Admin can create admins" });
    }

    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const emailLower = email.toLowerCase();

    const userExists = await User.findOne({ email: emailLower });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      firstName,
      lastName,
      email: emailLower,
      passwordHash,
      role: "admin"
    });

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: "create admin",
      details: `Created new admin: ${firstName} ${lastName}`,
    });

    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    console.error("Create admin error:", err);
    res.status(500).json({ message: "Server error during admin creation" });
  }
};

// @desc Update a user (Admin or Super Admin)
export const updateUser = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }

    const { id } = req.params;
    const updates = req.body;

    // Prevent non-super_admin from changing roles
    if (updates.role && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Only Super Admin can change roles" });
    }

    // Validate role if provided
    if (updates.role) {
      const validRoles = ["salesperson", "admin", "super_admin", "customer", "team_head"];
      if (!validRoles.includes(updates.role)) {
        return res.status(400).json({ message: "Invalid role specified" });
      }
    }

    // Prevent updating passwordHash directly, email uniqueness, etc.
    delete updates.passwordHash;
    if (updates.email) {
      updates.email = updates.email.toLowerCase();
      const existingUser = await User.findOne({ email: updates.email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    const user = await User.findByIdAndUpdate(id, updates, { new: true }).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: "update user",
      details: `Updated user: ${user.firstName} ${user.lastName}`,
    });

    res.json({
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
};

// @desc Delete a user (Admin or Super Admin)
export const deleteUser = async (req, res) => {
  try {
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }

    const { id } = req.params;

    // Prevent deleting super_admin unless super_admin
    const userToDelete = await User.findById(id);
    if (!userToDelete) return res.status(404).json({ message: "User not found" });

    if (userToDelete.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Cannot delete Super Admin" });
    }

    await User.findByIdAndDelete(id);

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: "delete user",
      details: `Deleted user: ${userToDelete.firstName} ${userToDelete.lastName}`,
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
};

// GET /api/users
export const getAllUsers = async (req, res) => {
  try {
    // Only allow super_admin and admin
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { role, sort, page = 1, limit = 10 } = req.query;

    let filter = {};
    if (role) {
      filter.role = role;
    }

    let sortOption = {};
    if (sort) {
      const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
      const sortOrder = sort.startsWith('-') ? -1 : 1;
      sortOption[sortField] = sortOrder;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .select("-passwordHash"); // exclude sensitive info

    // Calculate totalOrders, totalSpent, and lastOrder for each user
    for (let user of users) {
      const agg = await Sale.aggregate([
        { $match: { user_id: user._id } },
        { $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$total_amount" },
          lastOrder: { $max: "$sale_date" }
        } }
      ]);
      if (agg.length > 0) {
        user.totalOrders = agg[0].totalOrders;
        user.totalSpent = agg[0].totalSpent;
        user.lastOrder = agg[0].lastOrder;
      } else {
        user.totalOrders = 0;
        user.totalSpent = 0;
        user.lastOrder = null;
      }
    }

    const total = await User.countDocuments(filter);

    res.json({
      users: users.map(user => ({
        ...user.toObject(),
        id: user._id.toString() // Ensure id field is available for frontend
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc Send message to user (Super Admin only)
// @route POST /api/users/:id/message
// @access Private (Super Admin)
export const sendMessage = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Only Super Admin can send messages" });
    }

    const { id } = req.params;
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message are required" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

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

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: subject,
      html: `
        <h2>Message from Sales Tracker Admin</h2>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <br>
        <p>This message was sent by a Sales Tracker administrator.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: "send message",
      details: `Sent message to ${user.firstName} ${user.lastName} (${user.email})`,
    });

    res.json({ message: "Message sent successfully" });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};

// @desc Get user profile
// @route GET /api/users/:id/profile
// @access Private
export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const targetUser = await User.findById(id).select("-passwordHash");
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const isOwn = req.user._id.toString() === id;
    if (!canEditProfile(req.user.role, targetUser.role, isOwn)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }

    res.json({ user: targetUser });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({ message: "Failed to get user profile" });
  }
};

// @desc Update user profile with avatar upload
// @route PUT /api/users/:id/profile
// @access Private
export const updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const targetUser = await User.findById(id);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const isOwn = req.user._id.toString() === id;
    if (!canEditProfile(req.user.role, targetUser.role, isOwn)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }

    // Handle avatar upload
    if (req.file) {
      updates.avatar = req.file.path;
    }

    // Prevent updating sensitive fields
    delete updates.passwordHash;
    if (updates.role && req.user.role !== "super_admin") {
      delete updates.role;
    }

    // Validate email uniqueness if provided
    if (updates.email) {
      updates.email = updates.email.toLowerCase();
      const existingUser = await User.findOne({ email: updates.email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    Object.assign(targetUser, updates);
    await targetUser.save();

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: "update profile",
      details: `Updated profile for ${targetUser.firstName} ${targetUser.lastName}`,
    });

    res.json({
      message: "Profile updated successfully",
      user: targetUser,
    });
  } catch (error) {
    console.error("Update user profile error:", error);
    res.status(500).json({ message: "Failed to update user profile" });
  }
};

// @desc Delete user avatar
// @route DELETE /api/users/:id/avatar
// @access Private
export const deleteAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    const targetUser = await User.findById(id);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const isOwn = req.user._id.toString() === id;
    if (!canEditProfile(req.user.role, targetUser.role, isOwn)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }

    if (targetUser.avatar) {
      // Delete the avatar file
      const avatarPath = path.resolve(targetUser.avatar);
      fs.unlink(avatarPath, (err) => {
        if (err) console.error("Error deleting avatar file:", err);
      });
      targetUser.avatar = null;
      await targetUser.save();

      // Log activity
      await Activity.create({
        user: req.user._id,
        action: "delete avatar",
        details: `Deleted avatar for ${targetUser.firstName} ${targetUser.lastName}`,
      });
    }

    res.json({ message: "Avatar deleted successfully" });
  } catch (error) {
    console.error("Delete avatar error:", error);
    res.status(500).json({ message: "Failed to delete avatar" });
  }
};