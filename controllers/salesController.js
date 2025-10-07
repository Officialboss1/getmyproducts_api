import Sale from "../models/Sale.js";
import SalesAudit from "../models/SalesAudit.js";
import Product from "../models/Product.js";
import Referral from "../models/Referral.js";
import Team from "../models/Team.js";
import Setting from "../models/Setting.js";

// @desc Create new sale (price is locked at transaction time)
export const createSale = async (req, res) => {
  try {
    const { product_id, receiver_email, quantity_sold, sale_date } = req.body;

    // Validate product
    const product = await Product.findById(product_id);
    if (!product || !product.is_active)
      return res.status(400).json({ message: "Invalid or inactive product" });

    // Lock price at time of sale
    const price_per_unit_at_sale = product.current_price;
    const total_amount = quantity_sold * price_per_unit_at_sale;


    const sale = await Sale.create({
      user_id: req.user._id,
      product_id,
      receiver_email,
      quantity_sold,
      price_per_unit_at_sale,
      total_amount,
      sale_date,
    });


    res.status(201).json(sale);
    await checkPromotion(req.user._id);

  } catch (error) {
    res.status(500).json({ message: "Failed to create sale" });
  }
};

// @desc Get sales (scoped by role)
export const getSales = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "salesperson") filter.user_id = req.user._id;

    const sales = await Sale.find(filter).populate("product_id user_id", "name email firstName lastName");
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sales" });
  }
};

// @desc Update sale (Admin & Super Admin only)
export const updateSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    const beforeData = sale.toObject();

    sale.receiver_email = req.body.receiver_email ?? sale.receiver_email;
    sale.quantity_sold = req.body.quantity_sold ?? sale.quantity_sold;
    sale.total_amount = sale.quantity_sold * sale.price_per_unit_at_sale;

    const updated = await sale.save();

    await SalesAudit.create({
      sale_id: sale._id,
      editor_user_id: req.user._id,
      action_type: "EDIT",
      before_data: beforeData,
      after_data: updated.toObject(),
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update sale" });
  }
};

// @desc Delete sale (Admin & Super Admin only)
export const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    await SalesAudit.create({
      sale_id: sale._id,
      editor_user_id: req.user._id,
      action_type: "DELETE",
      before_data: sale.toObject(),
    });

    await sale.deleteOne();

    res.json({ message: "Sale deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete sale" });
  }
};


const checkPromotion = async (salespersonId) => {
  const referral = await Referral.findOne({ referred: salespersonId });
  if (!referral) return;

  const referrerId = referral.referrer;

  // Get thresholds (default: 3 referrals, 5 sales each)
  const referralSettings = await Setting.findOne({ key: "referral" });
const { requiredReferrals, requiredSalesPerReferral } = referralSettings?.value || { 
  requiredReferrals: 3, 
  requiredSalesPerReferral: 5 
};


  // Get all referrals made by this referrer
  const referrals = await Referral.find({ referrer: referrerId }).populate("referred");

  if (referrals.length < settings.requiredReferrals) return;

  // Check if each referral has enough sales
  const validRefs = [];
  for (let r of referrals) {
    const salesCount = await Sale.countDocuments({ salesperson: r.referred._id });
    if (salesCount >= settings.requiredSalesPerReferral) {
      validRefs.push(r.referred._id);
    }
  }

  // If referrer meets conditions
  if (validRefs.length >= settings.requiredReferrals) {
    // Check if team already exists
    let team = await Team.findOne({ head: referrerId });
    if (!team) {
      team = await Team.create({
        head: referrerId,
        members: validRefs
      });

      // Audit log entry
      await Audit.create({
        user: referrerId,
        action: "PROMOTION",
        details: `User promoted to Team Head with ${validRefs.length} members`
      });
    }
  }
};