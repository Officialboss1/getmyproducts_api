import mongoose from "mongoose";

const competitionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    metric: { type: String, enum: ["units", "revenue"], default: "units" },
    product: { type: String }, // optional: focus on one product
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Competition", competitionSchema);
