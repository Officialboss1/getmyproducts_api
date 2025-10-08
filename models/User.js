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
    // Additional fields for super admin pages
    phone: { type: String },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    notes: { type: String },
    lastActive: { type: Date },
    company: { type: String },
    position: { type: String },
    avatar: { type: String },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastOrder: { type: Date },
    joinDate: { type: Date },
    address: { type: String },
    team: { type: String },
    admin: { type: Boolean, default: false },
    performance: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    isTeamHead: { type: Boolean, default: false },

      //Activity tracking
        lastLogin: { type: Date }, 
        lastSaleDate: { type: Date },  
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
