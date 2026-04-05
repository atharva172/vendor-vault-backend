const orderModel = require('../models/order.model');
const axios = require('axios');


const createOrder = async (req, res) => {
    try {
        const user = req.user;
        const userId = user?.id || user?._id;
        if (!userId) {
            return res.status(401).json({ message: 'Invalid authentication token payload' });
        }
        const token = req.cookies?.token || req.headers?.authorization?.split(' ')[1];
        const cartResponse = await axios.get(`http://localhost:3002/api/cart`, {
            headers: {
                Cookie: req.headers.cookie,
                Authorization: `Bearer ${token}`,
            },
        });

        const products = await Promise.all(cartResponse.data.cart.items.map(async (item) => {
            return (await axios.get(`http://localhost:3001/api/products/${item.productId}`, {
                headers: {
                    Cookie: req.headers.cookie,
                    Authorization: `Bearer ${token}`,
                }
            })).data.product;
        }));

        let priceAmount = 0;

        const orderItems = cartResponse.data.cart.items.map((item, index) => {

          // if not in stock, does not allow to create order
            if (products[index].stock < item.quantity) {
                throw new Error(`Product ${products[index].name} is out of stock`);
            }

            const product = products[index];
            if (!product?.price?.amount || !product?.price?.currency) {
                throw new Error(`Invalid product pricing for product ${item.productId}`);
            }
            const itemTotal = product.price.amount * item.quantity;
            priceAmount += itemTotal;
            return {
                productId: item.productId,
                quantity: item.quantity,
                price: {
                    amount: itemTotal,
                    currency: product.price.currency,
                }
            };
        });

       const order = new orderModel({
          user: userId,
            items: orderItems,
            status: 'pending',
            totalprice: {
                amount: priceAmount,
                currency: products[0].price.currency, // Assuming all products have the same currency
            },
            shippingAddress: req.body.shippingAddress,
        });

        await order.save();

        res.status(201).json({ order });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

const getOrderById = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await orderModel.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        const ownerId = String(order.user || order.userId);
        if (ownerId !== String(req.user.id)) {
            return res.status(403).json({ message: 'Forbidden: You can only access your own orders' });
        }
        res.status(200).json(order);
    }catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ message: 'Internal server error' });
}
}

const getMyOrders = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const query = { user: userId };

        const totalOrders = await orderModel.countDocuments(query);
        const orders = await orderModel
            .find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        res.status(200).json({
            orders,
            pagination: {
                page,
                limit,
                totalOrders,
                totalPages: Math.ceil(totalOrders / limit),
            },
        });
    }catch (error) {
        console.error('Error fetching customer orders:', error);
        res.status(500).json({ message: 'Internal server error' });
}
}

const updateOrderAddress = async (req, res) => {
    try {
        const { street, city, state, pincode, country } = req.body || {};

        if (!street || !city || !state || !pincode || !country) {
            return res.status(400).json({
                message: 'Shipping address must include street, city, state, pincode, and country',
            });
        }
        const order = await orderModel.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        const ownerId = String(order.user || order.userId);
        if (ownerId !== String(req.user.id)) {
            return res.status(403).json({ message: 'Forbidden: You can only update your own orders' });
        }
        if (order.paymentCaptured === true || order.paymentStatus === 'captured') {
            return res.status(409).json({
                message: 'Cannot update address after payment capture',
            });
        }
        order.shippingAddress = { street, city, state, pincode, country };
        if (typeof order.save === 'function') {
            await order.save();
        }
        return res.status(200).json({
            message: 'Delivery address updated successfully',
            order,
        });
    } catch (error) {
        console.error('Error updating delivery address:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

const cancelOrder = async (req, res) => {
    try{
        const order = await orderModel.findById(req.params.id);

        if(!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if(String(order.user) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Forbidden: You can only cancel your own orders' });
        }
        if(order.status === 'cancelled') {
            return res.status(409).json({ message: 'Order is already cancelled' });
        }
        if(!['pending', 'paid'].includes(order.status)) {
            return res.status(409).json({
                message: 'Order cannot be cancelled in its current status',
            });
        }
        if(order.status === 'paid' && order.payment && order.payment.captured === true) {
            return res.status(409).json({
                message: 'Order cannot be cancelled after payment capture',
            });
        }
        order.status = 'cancelled';
        order.cancelledBy = 'buyer';
        order.cancelledReason = req.body.reason || 'Buyer requested cancellation';
        if (typeof order.save === 'function') {
            await order.save();
        }
        return res.status(200).json({
            message: 'Order cancelled successfully',
            order,
        });

    }catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

module.exports = {
    createOrder,
    getOrderById,
    getMyOrders,
    updateOrderAddress,
    cancelOrder
}
