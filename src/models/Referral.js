import mongoose from "mongoose";

const referralSchema = new mongoose.Schema(
  {
    // Who referred (the salesperson or user)
    referrer: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },

    // The new customer/user being referred
    referred: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      unique: true // prevents same customer from being referred twice
    },

    // When the referred user activated (registered/purchased)
    activatedAt: { type: Date },

    // Status of referral
    status: { 
      type: String, 
      enum: ["pending", "completed"], 
      default: "pending" 
    }
  },
  { timestamps: true } // adds createdAt + updatedAt
);

export default mongoose.model("Referral", referralSchema);
