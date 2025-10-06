import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" });

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


// GET /api/users
export const getAllUsers = async (req, res) => {
  try {
    // Only allow super_admin and admin
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const users = await User.find().select("-passwordHash"); // exclude sensitive info
    res.json(users);
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ message: "Server error" });
  }
};