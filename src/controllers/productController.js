import Product from '../models/Product.js';
import { Parser } from 'json2csv';

// Get all products (Admin/Super Admin)
export const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, is_active } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ message: 'Invalid pagination parameters' });
    }

    let filter = {};

    // Filter by active status if specified
    if (is_active !== undefined) {
      filter.is_active = is_active === 'true';
    }

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Product.countDocuments(filter);

    res.json({
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Failed to get products' });
  }
};

// Get single product
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Failed to get product' });
  }
};

// Create product (Admin & Super Admin only)
export const createProduct = async (req, res) => {
  try {
    // Check role permissions - allow both admin and super_admin
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Admin or Super Admin role required.' });
    }

    const { name, description, current_price, is_active } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Product name is required' });
    }

    if (current_price === undefined || current_price < 0) {
      return res.status(400).json({ message: 'Valid price is required' });
    }

    // Check if product name already exists
    const existingProduct = await Product.findOne({
      name: { $regex: `^${name.trim()}$`, $options: 'i' }
    });

    if (existingProduct) {
      return res.status(400).json({ message: 'Product name already exists' });
    }

    const product = new Product({
      name: name.trim(),
      description: description?.trim(),
      current_price: parseFloat(current_price),
      is_active: is_active !== undefined ? is_active : true
    });

    await product.save();

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Failed to create product' });
  }
};

// Update product (Admin & Super Admin only)
export const updateProduct = async (req, res) => {
  try {
    // Check role permissions - allow both admin and super_admin
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Admin or Super Admin role required.' });
    }

    const { id } = req.params;
    const { name, description, current_price, is_active } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check name uniqueness if name is being changed
    if (name && name !== product.name) {
      const existingProduct = await Product.findOne({
        name: { $regex: `^${name.trim()}$`, $options: 'i' },
        _id: { $ne: id }
      });

      if (existingProduct) {
        return res.status(400).json({ message: 'Product name already exists' });
      }
    }

    // Update fields
    if (name !== undefined) product.name = name.trim();
    if (description !== undefined) product.description = description?.trim();
    if (current_price !== undefined) product.current_price = parseFloat(current_price);
    if (is_active !== undefined) product.is_active = is_active;

    await product.save();

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Failed to update product' });
  }
};

// Delete product (Admin & Super Admin only)
export const deleteProduct = async (req, res) => {
  try {
    // Check role permissions - allow both admin and super_admin
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Admin or Super Admin role required.' });
    }

    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await Product.findByIdAndDelete(id);

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
};

// Toggle product active status (Admin & Super Admin only)
export const toggleProductStatus = async (req, res) => {
  try {
    // Check role permissions - allow both admin and super_admin
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Admin or Super Admin role required.' });
    }

    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.is_active = !product.is_active;
    await product.save();

    res.json({
      message: `Product ${product.is_active ? 'activated' : 'deactivated'} successfully`,
      product
    });
  } catch (error) {
    console.error('Toggle product status error:', error);
    res.status(500).json({ message: 'Failed to toggle product status' });
  }
};

// Export products
export const exportProducts = async (req, res) => {
  try {
    const { format = 'csv' } = req.query;

    const products = await Product.find({}).sort({ createdAt: -1 });

    const data = products.map(product => ({
      id: product._id,
      name: product.name,
      description: product.description || '',
      price: product.current_price,
      active: product.is_active ? 'Yes' : 'No',
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString()
    }));

    if (format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
      res.send(csv);
    } else {
      res.status(400).json({ message: 'Invalid format. Use csv.' });
    }
  } catch (error) {
    console.error('Export products error:', error);
    res.status(500).json({ message: 'Failed to export products' });
  }
};
