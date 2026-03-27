const express = require('express');
const cartController = require('../controllers/cart.controller');
const  authMiddleware  = require('../middleware/auth.middleware');
const Validation = require('../middleware/validation.middleware');

const router = express.Router();


router.post('/items',Validation.cartItemValidationRules, authMiddleware.createAuthMiddleware(['user']),  cartController.AddItemToCart) 
router.patch('/items/:productId', Validation.cartItemUpdateValidationRules, authMiddleware.createAuthMiddleware(['user']), cartController.UpdateCartItem)
router.get('/', authMiddleware.createAuthMiddleware(['user']), cartController.GetCart)
router.delete('/items/:productId', authMiddleware.createAuthMiddleware(['user']), cartController.DeleteCartItem)
router.delete('/', authMiddleware.createAuthMiddleware(['user']), cartController.ClearCart)
	


module.exports = router;