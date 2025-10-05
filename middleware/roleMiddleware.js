// roleMiddleware.js
export const adminOrSuper = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!["admin", "super_admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied: Admins only" });
  }

  next();
};
