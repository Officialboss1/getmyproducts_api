import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customer_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    hours_duration: {
      type: Number,
      required: true,
      min: [1, 'Duration must be at least 1 hour'],
      max: [168, 'Duration cannot exceed 168 hours (1 week)']
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'cancelled'],
      default: 'pending'
    },
    total_amount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative']
    },
    start_date: {
      type: Date,
      default: null
    },
    end_date: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

// Index for efficient queries
orderSchema.index({ customer_email: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ created_by: 1 });
orderSchema.index({ product: 1 });

// Pre-save middleware to calculate total_amount and dates
orderSchema.pre('save', async function(next) {
  try {
    if (this.isNew || this.isModified('product') || this.isModified('hours_duration')) {
      const Product = mongoose.model('Product');
      const product = await Product.findById(this.product);

      if (!product) {
        return next(new Error('Product not found'));
      }

      // Calculate total amount based on hourly rate
      this.total_amount = product.current_price * this.hours_duration;

      // Set start and end dates if status is active
      if (this.status === 'active' && !this.start_date) {
        this.start_date = new Date();
        this.end_date = new Date(this.start_date.getTime() + (this.hours_duration * 60 * 60 * 1000));
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model("Order", orderSchema);