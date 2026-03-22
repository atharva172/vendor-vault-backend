const { body, validationResult } = require('express-validator');

const responseWithValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    return next();
};


const validateRegistration = [
    body('username')
     .isString()
     .isLength({ min: 3, max: 30 })
     .withMessage('Username must be between 3 and 30 characters'),
    body('email')
     .isEmail()
     .withMessage('Invalid email format'),
    body('password')
     .isLength({ min: 8 })
     .withMessage('Password must be at least 8 characters long'),
     body('fullName.firstName')
     .isString()
     .withMessage('First name is required'),
    body('fullName.lastName')
     .isString()
     .withMessage('Last name is required'),
        body('role')
        .optional()
        .isIn(['admin', 'user'])
        .withMessage('Role must be either admin or user'),
     responseWithValidationErrors
]

const validateLogin = [
    body('email')
     .optional()
     .isEmail()
     .withMessage('Invalid email format'),
    body('username')
     .optional()
     .isString()
     .withMessage('Username is required'),
    body('password')
     .isLength({ min: 8 })
     .withMessage('Password must be at least 8 characters long'),
     (req, res, next) => {
        if (!req.body.email && !req.body.username) {
            return res.status(400).json({ message: 'Either email or username is required' });
        }
         responseWithValidationErrors(req, res, next);
     },
    
]

const validateAddress = [
    body('street')
     .isString()
        .withMessage('Street is required'),
    body('city')
     .isString()
        .withMessage('City is required'),
    body('state')
     .isString()
        .withMessage('State is required'),
    body('pincode')
      .isString()
          .withMessage('Pincode is required')
      .matches(/^\d{6}$/)
          .withMessage('Pincode must be a valid 6-digit number'),
    body('country')
     .isString()
        .withMessage('Country is required'),
        body('isDefault')
        .optional()
        .isBoolean()
        .withMessage('isDefault must be a boolean'),
    responseWithValidationErrors
]

module.exports = {
    validateRegistration,
    validateLogin,
    validateAddress
}