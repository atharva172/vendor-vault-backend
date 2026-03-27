const {body, validationResult} = require('express-validator');
const mongoose = require('mongoose');

function validateCartItem(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}

const cartItemValidationRules = [
    body('productId')
        .notEmpty().withMessage('productId is required')
        .custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage('Invalid productId'),
    body('qty')
        .notEmpty().withMessage('qty is required')
        .isInt({ min: 1 }).withMessage('qty must be a positive integer'),
    validateCartItem
];

const cartItemUpdateValidationRules = [
    body('qty')
        .notEmpty().withMessage('qty is required')
        .isInt({ min: 1 }).withMessage('qty must be a positive integer'),
    validateCartItem
];
module.exports = {
    cartItemValidationRules,
    cartItemUpdateValidationRules
}