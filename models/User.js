import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    passwordHash: { type: String, required: true },
    role: { 
      type: String, 
      enum: ["super_admin", "admin", "salesperson", "customer", "team_head"],
      default: "salesperson",
      required: true 
    },

    // 🔑 Auto-generated for salespersons
    referralCode: {
      type: String,
      unique: true,
      sparse: true
    },

    // Track customers referred by this salesperson
    referredCustomers: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    ],

    // Team linkage
    team_id: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
  },
  { timestamps: true }
);

// ✅ Pre-save hook to generate referralCode automatically for salespersons
userSchema.pre("save", function (next) {
  if (this.isNew && this.role === "salesperson" && !this.referralCode) {
    this.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

export default mongoose.model("User", userSchema);
