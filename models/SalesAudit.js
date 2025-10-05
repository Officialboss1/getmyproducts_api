import mongoose from "mongoose";

const salesAuditSchema = new mongoose.Schema(
  {
    sale_id: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
    editor_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action_type: { type: String, enum: ["EDIT", "DELETE"], required: true },
    before_data: { type: Object, required: true },
    after_data: { type: Object },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("SalesAudit", salesAuditSchema);
