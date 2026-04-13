const express = require('express');
const sallerController = require('../controller/saller.controller');
const createAuthMiddleware = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/metrics', createAuthMiddleware(['seller']), sallerController.getMetrics);
router.get('/orders', createAuthMiddleware(['seller']), sallerController.getOrders);
router.get('/products', createAuthMiddleware(['seller']), sallerController.getProducts);


module.exports = router;