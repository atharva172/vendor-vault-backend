
const Cart = require('../models/cart.model');
const mongoose = require('mongoose');


async function AddItemToCart(req, res) {
    try {
		const { productId, qty } = req.body;


		if (!productId || qty === undefined) {
			return res.status(400).json({ message: 'productId and qty are required' });
		}

		if (!mongoose.Types.ObjectId.isValid(productId)) {
			return res.status(400).json({ message: 'Invalid productId' });
		}

		const parsedQty = Number(qty);
		if (!Number.isInteger(parsedQty) || parsedQty < 1) {
			return res.status(400).json({ message: 'qty must be a positive integer' });
		}

		const userId = req.user.id;
		let cart = await Cart.findOne({ user: userId });

		if (!cart) {
			cart = new Cart({
				user: userId,
				items: [{ productId, quantity: parsedQty }],
			});
		} else {
			const itemIndex = cart.items.findIndex(
				(item) => String(item.productId) === String(productId)
			);

			if (itemIndex >= 0) {
				cart.items[itemIndex].quantity += parsedQty;
			} else {
				cart.items.push({ productId, quantity: parsedQty });
			}
		}

		await cart.save();

		return res.status(200).json({
			message: 'Item added to cart',
			cart,
		});
	} catch (error) {
		return res.status(500).json({ message: 'Failed to add item to cart' });
	}
}

async function UpdateCartItem(req, res) {
	try {
		const { productId } = req.params;
		const { qty } = req.body;
		if (qty === undefined) {
			return res.status(400).json({ message: 'qty is required' });
		}
		if (!mongoose.Types.ObjectId.isValid(productId)) {
			return res.status(400).json({ message: 'Invalid productId' });
		}
		const parsedQty = Number(qty);
		if (!Number.isInteger(parsedQty) || parsedQty < 1) {
			return res.status(400).json({ message: 'qty must be a positive integer' });
		}
		const userId = req.user.id;
		const cart = await Cart.findOne({ user: userId });
		if (!cart) {
			return res.status(404).json({ message: 'Cart not found' });
		}
		const itemIndex = cart.items.findIndex(
			(item) => String(item.productId) === String(productId)
		);
		if (itemIndex < 0) {
			return res.status(404).json({ message: 'Item not found in cart' });
		}
		cart.items[itemIndex].quantity = parsedQty;
		await cart.save();
		return res.status(200).json({
			message: 'Item quantity updated',
			cart,
		});
	} catch (error) {
		return res.status(500).json({ message: 'Failed to update item quantity' });	
	}
}

async function GetCart(req, res) {
	try{
		const userId = req.user.id;
		const cart = await Cart.findOne({ user: userId });
		if (!cart) {
			return res.status(404).json({ message: 'Cart not found' });
		}
		const totalItems = cart.items.length;
		const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);

		return res.status(200).json({
			cart,
			totals: {
				totalItems,
				totalQuantity
			},
		});
	} catch (error) {
		return res.status(500).json({ message: 'Failed to retrieve cart' });
	}
}

async function DeleteCartItem(req, res) {
	try{
		const { productId } = req.params;
		if (!mongoose.Types.ObjectId.isValid(productId)) {
			return res.status(400).json({ message: 'Invalid productId' });
		}
		const userId = req.user.id;
		const cart = await Cart.findOne({ user: userId });
		if (!cart) {
			return res.status(404).json({ message: 'Cart not found' });
		}
		const itemIndex = cart.items.findIndex(
			(item) => String(item.productId) === String(productId)
		);
		if (itemIndex < 0) {
			return res.status(404).json({ message: 'Item not found in cart' });
		}
		cart.items.splice(itemIndex, 1);
		await cart.save();
		return res.status(200).json({
			message: 'Item removed from cart',
			cart,
		});
	} catch (error) {
		return res.status(500).json({ message: 'Failed to remove item from cart' });

	}
}

async function ClearCart(req, res) {
	try{
		const userId = req.user.id;
		const cart = await Cart.findOne({ user: userId });
		if (!cart) {
			return res.status(404).json({ message: 'Cart not found' });
		}
		cart.items = [];
		await cart.save();
		return res.status(200).json({
			message: 'Cart cleared',
			cart,
		});
	} catch (error) {
		return res.status(500).json({ message: 'Failed to clear cart' });
	}
}

module.exports = {
    AddItemToCart,
    UpdateCartItem,
    GetCart,
    DeleteCartItem,
	ClearCart
};
	