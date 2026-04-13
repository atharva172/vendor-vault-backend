const { body, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  return next();
};

const createProductValidators = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('title is required'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('description is required'),
  body('amount')
    .notEmpty()
    .withMessage('amount is required')
    .bail()
    .isFloat({ gt: 0 })
    .withMessage('amount must be a number greater than 0'),
  body('currency')
    .optional()
    .isIn(['INR', 'USA'])
    .withMessage('currency must be INR or USA'),
  body('images')
    .custom((value, { req }) => {
      if (!req.files || req.files.length === 0) {
        throw new Error('At least one image is required');
      }
      return true;
    }),
    body('stock')
    .notEmpty()
    .withMessage('stock is required')
    .bail()
    .isInt({ gt: -1 })
    .withMessage('stock must be a non-negative integer'),
    validateRequest,
];



module.exports = {
  createProductValidators,
};
