const { mongoose } = require('mongoose');
const productModel = require('../models/product.model');
const { uploadImage } = require('../services/imagekit.service');
const {publishToQueue} = require('../broker/broker');
const createProduct = async (req, res) => {
	try {
		const { title, description, amount, currency, stock } = req.body;
		const seller = req.user?.id;

		if (!seller) {
			return res.status(401).json({
				message: 'Authentication required',
				error: 'Seller id missing in token payload',
			});
		}

		const files = req.files || [];
		const uploadedImages = await Promise.all(
			files.map((file) => uploadImage(file))
		);

		const createdProduct = await productModel.create({
			title,
			description,
			price: {
				amount: Number(amount),
				currency: currency || 'INR',
			},
			stock: Number(stock),
			seller,
			images: uploadedImages,
		});

		await publishToQueue('PRODUCT_SELLER-DASHBOARD.PRODUCT_CREATED', createdProduct);
		await publishToQueue('PRODUCT_NOTIFICATION.PRODUCT_CREATED', {
			email: req.user.email,
			username: req.user.username,
			productId: createdProduct._id,
			sellerId: seller,
		});

		return res.status(201).json({
			message: 'Product created successfully',
			product: createdProduct,
		});
	} catch (error) {
		if (error?.name === 'ValidationError') {
			return res.status(400).json({
				message: 'Validation failed',
				error: error.message,
			});
		}

		return res.status(500).json({
			message: 'Failed to create product',
			error: error.message,
		});
	}
};

const getProducts = async (req, res) => {
	try {
		const { q, minPrice, maxPrice, skip = 0, limit = 20 } = req.query;

		const filter = {};

		if (q) {
			filter.$text = { $search: q };
		}

		if (minPrice) {
			filter['price.amount'] = {
				...filter['price.amount'],
				$gte: Number(minPrice),
			};
		}
		if (maxPrice) {
			filter['price.amount'] = {
				...filter['price.amount'],
				$lte: Number(maxPrice),
			};
		}

		const products = await productModel
			.find(filter)
			.skip(Number(skip))
			.limit(Number(limit));

		return res.status(200).json({
			message: 'Products fetched successfully',
			products,
		});
	} catch (error) {
		return res.status(500).json({
			message: 'Failed to fetch products',
			error: error.message,
		});
	}
};

const getProductById = async (req, res) => {
	try{
		const {id} = req.params;

		const product = await productModel.findById(id);

		if(!product){
			return res.status(404).json({
				message: 'Product not found',
			})
		}

		return res.status(200).json({
			message: 'Product fetched successfully',
			product,
		})
	} catch(error){
		return res.status(500).json({
			message: 'Failed to fetch product',
			error: error.message,
		});
	}
}

const updateProduct = async (req, res) => {
	try{
		const {id} = req.params;

		if(!mongoose.Types.ObjectId.isValid(id)){
			return res.status(400).json({
				message: 'Invalid product id',
			})
		}

		const product = await productModel.findOne({ _id: id });

		if(!product){
			return res.status(404).json({
				message: 'Product not found',
			})
		}

		if(product.seller.toString() !== req.user.id){
			return res.status(403).json({
				message: 'Forbidden: You can only update your own product',
			})
		}

		const updatableFields = ['title', 'description', 'price.amount', 'price.currency'];
		updatableFields.forEach((field) => {
			const fieldParts = field.split('.');
			let current = req.body;
			let productField = product;

			for (let part of fieldParts) {
				if (current[part] === undefined) {
					current = null;
					break;
				}
				current = current[part];

				productField = productField[part];
			}

			if (current !== null) {
				product.set(field, current);
			}
		});

		await product.save();
		return res.status(200).json({
			message: 'Product updated successfully',
			product,
		})
	} catch(error){
		if (error?.name === 'ValidationError') {
			return res.status(400).json({
				message: 'Validation failed',
				error: error.message,
			});
		}
	}
}

const deleteProduct = async (req, res) => {
	try{
		const {id} = req.params;
		if(!mongoose.Types.ObjectId.isValid(id)){
			return res.status(400).json({
				message: 'Invalid product id',
			})
		}
		const product = await productModel.findOne({ _id: id });

		if(!product){
			return res.status(404).json({
				message: 'Product not found',
			})
		}
		if(product.seller.toString() !== req.user.id){
			return res.status(403).json({
				message: 'Forbidden: You can only delete your own product',
			})
		}
		await productModel.deleteOne({ _id: id });
		return res.status(200).json({
			message: 'Product deleted successfully',
		})
	} catch(error){
		return res.status(500).json({
			message: 'Failed to delete product',
			error: error.message,
		});
	}
}

const getSellerProducts = async (req, res) => {
	try {
		const sellerId = req.user?.id;
		const {skip = 0, limit = 20} = req.query;

		if (!sellerId) {
			return res.status(401).json({
				message: 'Authentication required',
				error: 'Seller id missing in token payload',
			});
		}
		const products = await productModel.find({ seller: sellerId })
			.skip(Number(skip))
			.limit(Math.min(Number(limit), 20));


		return res.status(200).json({
			message: 'Seller products fetched successfully',
			products,
		});
	} catch (error) {
		return res.status(500).json({
			message: 'Failed to fetch seller products',
			error: error.message,
		});
	}
}

module.exports = {
	createProduct,
	getProducts,
	getProductById,
	updateProduct,
	deleteProduct,
	getSellerProducts,
};
	
