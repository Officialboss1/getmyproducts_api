import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    head: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdAt: { type: Date, default: Date.now }
  }
);

export default mongoose.model("Team", teamSchema);
