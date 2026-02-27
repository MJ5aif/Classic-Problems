/**
 * Role-Based Access Control Middleware
 * Restricts route access based on user roles
 */

/**
 * Authorize specific roles
 * @param {...string} roles - Allowed roles (e.g., 'admin', 'instructor', 'learner')
 * @returns {Function} Express middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user exists on request (set by auth middleware)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Check if user's role is in the allowed roles list
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not authorized to access this resource. Required roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

module.exports = { authorize };
