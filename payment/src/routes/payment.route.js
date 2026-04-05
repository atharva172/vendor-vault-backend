const express = require('express');

const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const paymentController = require('../controllers/payment.controller');

router.post('/create/:orderId', authMiddleware.createAuthMiddleware(['user']), paymentController.createPayment);  
router.post('/verify', authMiddleware.createAuthMiddleware(['user']), paymentController.verifyPayment);

module.exports = router;