import mongoose from "mongoose";

const targetSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one target config per user
    },
    daily: { type: Number, default: 30 },
    weekly: { type: Number, default: 210 },
    monthly: { type: Number, default: 900 },
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // admin/super_admin who set it
    },
  },
  { timestamps: true }
);

export default mongoose.model("Target", targetSchema);
