const jwt = require('jsonwebtoken');


function createAuthMiddleware(roles =['user']) {
    return function authMiddleware(req, res, next) {
        const token = req.cookies?.token || req.headers?.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Authentication token is missing' });
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const normalizedRole = String(decoded?.role || decoded?.user?.role || '').toLowerCase();
            const allowedRoles = roles.map((role) => String(role).toLowerCase());
            const normalizedUserId =
                decoded?.id ||
                decoded?._id ||
                decoded?.userId ||
                decoded?.sub ||
                decoded?.user?.id ||
                decoded?.user?._id;

            if (!normalizedUserId) {
                return res.status(401).json({ message: 'Invalid authentication token payload' });
            }

            req.user = {
                ...decoded,
                id: normalizedUserId,
                role: normalizedRole || decoded?.role,
            };

            if (!allowedRoles.includes(normalizedRole)) {
                return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
            }
            next();
        } catch (err) {
            return res.status(401).json({ message: 'Invalid authentication token' });
        }
    }
}

module.exports = {
    createAuthMiddleware
}