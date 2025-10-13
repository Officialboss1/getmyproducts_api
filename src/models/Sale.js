import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    receiver_email: {
      type: String,
      required: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    quantity_sold: { type: Number, required: true, min: 1 },
    price_per_unit_at_sale: { type: Number, required: true },
    total_amount: { type: Number, required: true },
    sale_date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Sale", saleSchema);
