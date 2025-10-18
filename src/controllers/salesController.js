import Sale from "../models/Sale.js";
import SalesAudit from "../models/SalesAudit.js";
import Product from "../models/Product.js";
import Referral from "../models/Referral.js";
import Team from "../models/Team.js";
import Setting from "../models/Setting.js";
import Activity from "../models/Activitymodel.js";
import User from "../models/User.js";

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

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: "create sale",
      details: `Created sale for ${quantity_sold} units of ${product.name} to ${receiver_email}`,
    });

    res.status(201).json(sale);
    await checkPromotion(req.user._id);

  } catch (error) {
    res.status(500).json({ message: "Failed to create sale" });
  }
};

// @desc Get sales (scoped by role and optional userId filter)
export const getSales = async (req, res) => {
  try {
    let filter = {};

    // Role-based filtering: salespeople can only see their own sales
    // Admin and Super Admin can see all sales
    if (req.user.role === "salesperson") {
      filter.user_id = req.user._id;
    }
    // Admin and Super Admin can see all sales (no filter applied)

    // Optional userId filter for admins (to view specific user's sales)
    const { userId, startDate, endDate, productId, page = 1, limit = 50 } = req.query;
    if (userId && (req.user.role === "admin" || req.user.role === "super_admin")) {
      filter.user_id = userId;
    }

    // Additional filters
    if (startDate) filter.sale_date = { $gte: new Date(startDate) };
    if (endDate) filter.sale_date = { ...filter.sale_date, $lte: new Date(endDate) };
    if (productId) filter.product_id = productId;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sales = await Sale.find(filter)
      .populate("product_id user_id", "name email firstName lastName")
      .sort({ sale_date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Sale.countDocuments(filter);

    res.json({
      sales,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
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


// @desc Get sales summary for dashboard
export const getSalesSummary = async (req, res) => {
  try {
    // Only super admins can access this endpoint
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied. Super admin only.' });
    }

    // Get user counts by role
    const [totalCustomers, totalSalespersons, totalAdmins] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'salesperson' }),
      User.countDocuments({ role: 'admin' })
    ]);

    // Get top performers (top 5 salespersons by total sales amount)
    const topPerformers = await Sale.aggregate([
      {
        $group: {
          _id: '$user_id',
          totalSales: { $sum: '$total_amount' }
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'salesperson'
        }
      },
      { $unwind: '$salesperson' },
      {
        $project: {
          name: { $concat: ['$salesperson.firstName', ' ', '$salesperson.lastName'] },
          totalSales: 1
        }
      }
    ]);

    res.json({
      totalCustomers,
      totalSalespersons,
      totalAdmins,
      topPerformers
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sales summary' });
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

  if (referrals.length < requiredReferrals) return;

  // Check if each referral has enough sales
  const validRefs = [];
  for (let r of referrals) {
    const salesCount = await Sale.countDocuments({ user_id: r.referred._id });
    if (salesCount >= requiredSalesPerReferral) {
      validRefs.push(r.referred._id);
    }
  }

  // If referrer meets conditions
  if (validRefs.length >= requiredReferrals) {
    // Check if team already exists
    let team = await Team.findOne({ head: referrerId });
    if (!team) {
      team = await Team.create({
        head: referrerId,
        members: validRefs
      });

      // Activity log entry
      await Activity.create({
        user: referrerId,
        action: "promotion",
        details: `User promoted to Team Head with ${validRefs.length} members`
      });
    }
  }
};