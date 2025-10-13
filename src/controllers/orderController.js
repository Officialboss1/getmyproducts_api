import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { Parser } from 'json2csv';
import mongoose from 'mongoose';

// Get all orders (Admin/Super Admin)
export const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, customer_email } = req.query;
    const currentUser = req.user;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ message: 'Invalid pagination parameters' });
    }

    let filter = {};

    // Filter by status if specified
    if (status) {
      filter.status = status;
    }

    // Filter by customer email if specified
    if (customer_email) {
      filter.customer_email = { $regex: customer_email, $options: 'i' };
    }

    // Search filter (customer email or product name)
    if (search) {
      filter.$or = [
        { customer_email: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    // Role-based filtering: admins can only see orders they created
    if (currentUser.role === 'admin') {
      filter.created_by = currentUser._id;
    }
    // Super admins can see all orders

    const skip = (pageNum - 1) * limitNum;

    const orders = await Order.find(filter)
      .populate('product', 'name current_price')
      .populate('created_by', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Failed to get orders' });
  }
};

// Get orders for salespeople (active, expired, cancelled)
export const getSalespersonOrders = async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const currentUser = req.user;

    // Only salespeople can access this endpoint
    if (currentUser.role !== 'salesperson') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    let filter = {};

    // Filter by status
    if (status === 'active') {
      filter.status = 'active';
    } else if (status === 'expired') {
      // Orders that are active but end_date has passed
      filter.status = 'active';
      filter.end_date = { $lt: new Date() };
    } else if (status === 'cancelled') {
      filter.status = 'cancelled';
    } else if (status === 'completed') {
      filter.status = 'completed';
    }

    const orders = await Order.find(filter)
      .populate('product', 'name current_price description')
      .populate('created_by', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Add computed fields for frontend
    const ordersWithStatus = orders.map(order => {
      const orderObj = order.toObject();
      if (status === 'expired' && order.end_date < new Date()) {
        orderObj.isExpired = true;
      }
      return orderObj;
    });

    res.json({ orders: ordersWithStatus });
  } catch (error) {
    console.error('Get salesperson orders error:', error);
    res.status(500).json({ message: 'Failed to get orders' });
  }
};

// Get single order
export const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const order = await Order.findById(id)
      .populate('product', 'name current_price description')
      .populate('created_by', 'firstName lastName email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check permissions: admins can only view orders they created
    if (currentUser.role === 'admin' && order.created_by._id.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Failed to get order' });
  }
};

// Create order
export const createOrder = async (req, res) => {
  try {
    const { customer_email, product, hours_duration, notes } = req.body;
    const currentUser = req.user;

    // Validation
    if (!customer_email || !customer_email.trim()) {
      return res.status(400).json({ message: 'Customer email is required' });
    }

    if (!product) {
      return res.status(400).json({ message: 'Product is required' });
    }

    if (!hours_duration || hours_duration < 1) {
      return res.status(400).json({ message: 'Valid duration in hours is required' });
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(customer_email.trim())) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check if product exists and is active
    const productDoc = await Product.findById(product);
    if (!productDoc) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (!productDoc.is_active) {
      return res.status(400).json({ message: 'Product is not available' });
    }

    // Total amount is just the product price (no multiplication by hours)
    const total_amount = productDoc.current_price;

    const order = new Order({
      customer_email: customer_email.trim().toLowerCase(),
      product,
      hours_duration: parseInt(hours_duration),
      total_amount,
      notes: notes?.trim(),
      created_by: currentUser._id
    });

    await order.save();

    // Populate the created order for response
    await order.populate('product', 'name current_price');
    await order.populate('created_by', 'firstName lastName email');

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
};

// Update order
export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_email, product, hours_duration, status, notes } = req.body;
    const currentUser = req.user;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check permissions: admins can only update orders they created
    if (currentUser.role === 'admin' && order.created_by.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    // Validate email if provided
    if (customer_email) {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(customer_email.trim())) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      order.customer_email = customer_email.trim().toLowerCase();
    }

    // Validate product if provided
    if (product) {
      const productDoc = await Product.findById(product);
      if (!productDoc) {
        return res.status(404).json({ message: 'Product not found' });
      }
      if (!productDoc.is_active) {
        return res.status(400).json({ message: 'Product is not available' });
      }
      order.product = product;
    }

    // Update duration if needed (but don't recalculate total amount)
    if (hours_duration !== undefined) {
      if (hours_duration < 1) {
        return res.status(400).json({ message: 'Valid duration in hours is required' });
      }
      order.hours_duration = parseInt(hours_duration);
      // Total amount remains the same (product price only)
    }

    // Update status if provided
    if (status) {
      const validStatuses = ['pending', 'active', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      order.status = status;
    }

    // Update notes if provided
    if (notes !== undefined) {
      order.notes = notes?.trim();
    }

    await order.save();

    // Populate for response
    await order.populate('product', 'name current_price');
    await order.populate('created_by', 'firstName lastName email');

    res.json({
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ message: 'Failed to update order' });
  }
};

// Delete order
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check permissions: admins can only delete orders they created
    if (currentUser.role === 'admin' && order.created_by.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this order' });
    }

    await Order.findByIdAndDelete(id);

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Failed to delete order' });
  }
};

// Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const currentUser = req.user;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check permissions: admins can only update orders they created
    if (currentUser.role === 'admin' && order.created_by.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    const validStatuses = ['pending', 'active', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const previousStatus = order.status;
    order.status = status;
    await order.save();

    // Populate for response
    await order.populate('product', 'name current_price');
    await order.populate('created_by', 'firstName lastName email');

    // Notify salespeople when order becomes active
    if (status === 'active' && previousStatus !== 'active') {
      const io = req.app.get('io');
      if (io) {
        // Get all salespeople
        const User = mongoose.model('User');
        const salespeople = await User.find({ role: 'salesperson' }).select('_id');

        // Emit notification to all salespeople
        salespeople.forEach(salesperson => {
          io.to(salesperson._id.toString()).emit('new_active_order', {
            order: {
              id: order._id,
              customer_email: order.customer_email,
              product_name: order.product.name,
              hours_duration: order.hours_duration,
              total_amount: order.total_amount,
              start_date: order.start_date,
              end_date: order.end_date,
              notes: order.notes
            },
            message: `New active order: ${order.product.name} for ${order.customer_email}`
          });
        });
      }
    }

    res.json({
      message: `Order status updated to ${status}`,
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
};

// Get available products for order creation
export const getAvailableProducts = async (req, res) => {
  try {
    const products = await Product.find({ is_active: true })
      .select('name current_price description')
      .sort({ name: 1 });

    res.json({ products });
  } catch (error) {
    console.error('Get available products error:', error);
    res.status(500).json({ message: 'Failed to get available products' });
  }
};

// Export orders
export const exportOrders = async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    const currentUser = req.user;

    let filter = {};

    // Role-based filtering for export
    if (currentUser.role === 'admin') {
      filter.created_by = currentUser._id;
    }

    const orders = await Order.find(filter)
      .populate('product', 'name current_price')
      .populate('created_by', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const data = orders.map(order => ({
      id: order._id,
      customer_email: order.customer_email,
      product_name: order.product?.name || 'N/A',
      product_price: order.product?.current_price || 0,
      hours_duration: order.hours_duration,
      total_amount: order.total_amount,
      status: order.status,
      start_date: order.start_date ? order.start_date.toISOString() : '',
      end_date: order.end_date ? order.end_date.toISOString() : '',
      notes: order.notes || '',
      created_by: `${order.created_by?.firstName || ''} ${order.created_by?.lastName || ''}`.trim() || order.created_by?.email || 'N/A',
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString()
    }));

    if (format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
      res.send(csv);
    } else {
      res.status(400).json({ message: 'Invalid format. Use csv.' });
    }
  } catch (error) {
    console.error('Export orders error:', error);
    res.status(500).json({ message: 'Failed to export orders' });
  }
};