const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const orderController = require('../controllers/order.controller');
const validatorMiddleware = require('../middleware/validator.middleware');

router.post("/", authMiddleware.createAuthMiddleware(['user']), validatorMiddleware.validateOrder, orderController.createOrder);
router.get("/:id", authMiddleware.createAuthMiddleware(['user']), orderController.getOrderById);
router.get("/me", authMiddleware.createAuthMiddleware(['user']), orderController.getMyOrders);
router.patch("/:id/address", authMiddleware.createAuthMiddleware(['user']), validatorMiddleware.validateAddressUpdate, orderController.updateOrderAddress);
router.post("/:id/cancel", authMiddleware.createAuthMiddleware(['user']), orderController.cancelOrder);

module.exports = router;