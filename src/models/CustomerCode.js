// models/CustomerCode.js
import mongoose from "mongoose";

const customerCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },

  // Who created the code (admin or super admin)
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },

  // Whether the code can still be used
  isActive: { type: Boolean, default: true },

  // Users (customers) who have used this code
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // How many times this code can be used
  usageLimit: { type: Number, default: 1 },

  // How many times it has already been used
  usageCount: { type: Number, default: 0 },

  // Detailed usage tracking (which user used it and when)
  usageLog: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      usedAt: { type: Date, default: Date.now },
    },
  ],

  // 🆕 Track last purchase made using this code
  lastPurchaseDate: { type: Date },

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("CustomerCode", customerCodeSchema);
