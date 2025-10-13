import { body, validationResult } from "express-validator";

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

/**
 * User registration validation
 */
export const validateRegistration = [
  body("firstName")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("First name can only contain letters and spaces"),

  body("lastName")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Last name can only contain letters and spaces"),

  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, and one number"),

  body("role")
    .isIn(["salesperson", "customer"])
    .withMessage("Role must be either salesperson or customer"),

  handleValidationErrors,
];

/**
 * User login validation
 */
export const validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),

  handleValidationErrors,
];

/**
 * Sale creation validation
 */
export const validateSale = [
  body("product_id")
    .isMongoId()
    .withMessage("Invalid product ID"),

  body("receiver_email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid receiver email"),

  body("quantity_sold")
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),

  body("sale_date")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format"),

  handleValidationErrors,
];

/**
 * Password reset validation
 */
export const validatePasswordReset = [
  body("token")
    .notEmpty()
    .withMessage("Reset token is required"),

  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, and one number"),

  handleValidationErrors,
];