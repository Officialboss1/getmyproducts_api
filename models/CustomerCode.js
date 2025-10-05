// models/CustomerCode.js
import mongoose from "mongoose";

const customerCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // admin or super admin
  isActive: { type: Boolean, default: true },
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // customers
  usageLimit: { type: Number, default: 1 }, // can set higher if needed
  usageCount: { type: Number, default: 0 },
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // track customers
  usageLog: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        usedAt: { type: Date, default: Date.now }
      }
    ],
  createdAt: { type: Date, default: Date.now }
});


export default mongoose.model("CustomerCode", customerCodeSchema);
