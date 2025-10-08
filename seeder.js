import mongoose from "mongoose";
import dotenv from "dotenv";
import Setting from "./models/Setting.js";
import Sale from "./models/Sale.js";
import User from "./models/User.js";
import Product from "./models/Product.js";
import Activity from "./models/Activitymodel.js";

dotenv.config();

const seedActivitiesForExistingSales = async () => {
  try {
    const sales = await Sale.find().populate('user_id product_id');
    console.log(`Found ${sales.length} sales to create activities for`);

    for (const sale of sales) {
      const existingActivity = await Activity.findOne({
        user: sale.user_id,
        action: "create sale",
        createdAt: { $gte: new Date(sale.createdAt.getTime() - 1000), $lte: new Date(sale.createdAt.getTime() + 1000) }
      });

      if (!existingActivity) {
        await Activity.create({
          user: sale.user_id,
          action: "create sale",
          details: `Created sale for ${sale.quantity_sold} units of ${sale.product_id?.name || 'Unknown Product'} to ${sale.receiver_email}`,
          createdAt: sale.createdAt,
          updatedAt: sale.updatedAt
        });
      }
    }

    console.log("✅ Activities seeded for existing sales");
  } catch (error) {
    console.error("❌ Failed to seed activities:", error);
  }
};

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

    // Seed activities for existing sales
    await seedActivitiesForExistingSales();

    console.log("🎉 Defaults seeding completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeder failed:", error);
    process.exit(1);
  }
};

seedDefaults();
