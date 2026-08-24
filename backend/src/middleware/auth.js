const jwt = require('jsonwebtoken');

// Verifies the JWT sent in the Authorization header
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, email }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// Restricts a route to specific roles, e.g. authorize('admin', 'headteacher')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do this.' });
    }
    next();
  };
}

// For routes with a :id param that refers to a student — if the logged-in
// user has the 'student' role, only allow them through for their own
// record. Staff roles (admin/headteacher/teacher/staff) are unaffected.
function restrictToOwnStudentRecord(req, res, next) {
  if (req.user.role !== 'student') return next();
  if (!req.user.student_id || String(req.user.student_id) !== String(req.params.id)) {
    return res.status(403).json({ message: "You do not have permission to view another student's information." });
  }
  next();
}

// For list-style routes filtered by a `?student_id=` query param — if the
// logged-in user has the 'student' role, they must pass their own
// student_id explicitly (no student_id, or someone else's, is rejected).
// Staff roles are unaffected and may query freely.
function restrictQueryToOwnStudent(req, res, next) {
  if (req.user.role !== 'student') return next();
  if (!req.user.student_id || String(req.query.student_id) !== String(req.user.student_id)) {
    return res.status(403).json({ message: "You do not have permission to view another student's information." });
  }
  next();
}

module.exports = { authenticate, authorize, restrictToOwnStudentRecord, restrictQueryToOwnStudent };
