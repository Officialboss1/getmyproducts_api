import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // e.g., "referral", "targets"
    value: { type: mongoose.Schema.Types.Mixed, required: true }, // JSON object
  },
  { timestamps: true }
);

export default mongoose.model("Setting", settingSchema);
