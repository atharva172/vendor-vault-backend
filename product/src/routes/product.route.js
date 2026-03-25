const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload.middleware');
const productController = require('../controllers/product.controller');
const { createAuthMiddleware } = require('../middleware/auth.middleware');
const {
	createProductValidators,
} = require('../validators/product.validator');



router.post(
	'/',
	createAuthMiddleware(['seller', 'Admin']),
	upload.array('images', 5),
	createProductValidators,
	productController.createProduct
);

router.get('/', productController.getProducts);

router.patch('/:id', createAuthMiddleware(['seller']), productController.updateProduct);
router.delete('/:id', createAuthMiddleware(['seller']), productController.deleteProduct);

router.get('/seller', createAuthMiddleware(['seller']), productController.getSellerProducts);


router.get('/:id', productController.getProductById);


module.exports = router;