const express = require('express');
const validator = require('../middlewares/validator.middleware');
const authController = require('../controllers/auth.controller');
const authMiddlewares = require('../middlewares/auth.middleware');


const router = express.Router();

router.post('/register', validator.validateRegistration, authController.register);
router.post('/login', validator.validateLogin, authController.login);
router.get('/me', authMiddlewares.authMiddleware, authController.getProfile);
router.get('/logout', authController.logout);
router.get('/users/me/addresses', authMiddlewares.authMiddleware, authController.getAddresses);
router.post('/users/me/addresses', authMiddlewares.authMiddleware, validator.validateAddress, authController.addAddress);
router.delete('/users/me/addresses/:addressID', authMiddlewares.authMiddleware, authController.deleteAddress);

module.exports = router;