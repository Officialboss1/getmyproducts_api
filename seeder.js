import mongoose from "mongoose";
import dotenv from "dotenv";
import Setting from "./models/Setting.js";

dotenv.config();

const seedDefaults = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const referral = await Setting.findOne({ key: "referral" });
    if (!referral) {
      await Setting.create({
        key: "referral",
        value: { requiredReferrals: 5, requiredSalesPerReferral: 5 },
      });
      console.log("✅ Referral settings seeded");
    } else {
      console.log("⚡ Referral settings already exist");
    }

    const targets = await Setting.findOne({ key: "targets" });
    if (!targets) {
      await Setting.create({
        key: "targets",
        value: { daily: 30, weekly: 210, monthly: 900 },
      });
      console.log("✅ Target settings seeded");
    } else {
      console.log("⚡ Target settings already exist");
    }

    console.log("🎉 Defaults seeding completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeder failed:", error);
    process.exit(1);
  }
};

seedDefaults();
