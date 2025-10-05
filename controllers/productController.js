import Product from "../models/Product.js";

// @desc Get all products (active & inactive for super_admins)
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products" });
  }
};

// @desc Create new product
export const createProduct = async (req, res) => {
  const { name, description, current_price, is_active } = req.body;

  try {
    const exists = await Product.findOne({ name });
    if (exists) return res.status(400).json({ message: "Product already exists" });

    const product = await Product.create({
      name,
      description,
      current_price,
      is_active,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: "Failed to create product" });
  }
};

// @desc Update product (super_admin only)
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.name = req.body.name ?? product.name;
    product.description = req.body.description ?? product.description;
    product.current_price = req.body.current_price ?? product.current_price;
    product.is_active = req.body.is_active ?? product.is_active;

    const updated = await product.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update product" });
  }
};

// @desc Delete product (soft delete = deactivate)
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.is_active = false;
    const updated = await product.save();

    res.json({ message: "Product deactivated", product: updated });
  } catch (error) {
    res.status(500).json({ message: "Failed to deactivate product" });
  }
};
