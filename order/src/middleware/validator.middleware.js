const {body, validationResult} = require('express-validator');

async function validateError(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}


const validateOrder = [
    body('shippingAddress.street').notEmpty().withMessage('Street is required'),
    body('shippingAddress.city').notEmpty().withMessage('City is required'),
    body('shippingAddress.state').notEmpty().withMessage('State is required'),
    body('shippingAddress.pincode').notEmpty().withMessage('Postal code is required'),
    body('shippingAddress.country').notEmpty().withMessage('Country is required'),
    body('shippingAddress').custom((value, { req }) => {
        if (!value) {
            throw new Error('Shipping address is required');
        }
        if (!value.street || !value.city || !value.state || !value.pincode || !value.country) {
            throw new Error('Shipping address must include street, city, state, postal code, and country');
        }
        return true;
    }),
    validateError
]

const validateAddressUpdate = [
    body('street').notEmpty().withMessage('Street is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('state').notEmpty().withMessage('State is required'),
    body('pincode').notEmpty().withMessage('Postal code is required'),
    body('country').notEmpty().withMessage('Country is required'),
    validateError
]

module.exports = {
    validateOrder,
    validateAddressUpdate
}