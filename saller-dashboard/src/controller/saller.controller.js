const userModel = require('../models/user.model');
const productModel = require('../models/product.model');
const orderModel = require('../models/order.model');
const paymentModel = require('../models/payment.model');


async function getMetrics(req, res) {
    // Implement logic to calculate and return seller metrics
    try {
        const sellerId = req.user.id;

        const [summaryRows, topProductsRows] = await Promise.all([
            orderModel.aggregate([
                {
                    $match: {
                        status: { $ne: 'cancelled' },
                    },
                },
                { $unwind: '$items' },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'items.productId',
                        foreignField: '_id',
                        as: 'product',
                    },
                },
                { $unwind: '$product' },
                {
                    $match: {
                        'product.seller': productModel.db.base.Types.ObjectId.createFromHexString(sellerId),
                    },
                },
                {
                    $group: {
                        _id: null,
                        sales: {
                            $sum: '$items.quantity',
                        },
                        revenue: {
                            $sum: {
                                $multiply: ['$items.quantity', '$items.price.amount'],
                            },
                        },
                    },
                },
            ]),
            orderModel.aggregate([
                {
                    $match: {
                        status: { $ne: 'cancelled' },
                    },
                },
                { $unwind: '$items' },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'items.productId',
                        foreignField: '_id',
                        as: 'product',
                    },
                },
                { $unwind: '$product' },
                {
                    $match: {
                        'product.seller': productModel.db.base.Types.ObjectId.createFromHexString(sellerId),
                    },
                },
                {
                    $group: {
                        _id: '$product._id',
                        title: { $first: '$product.title' },
                        sales: { $sum: '$items.quantity' },
                        revenue: {
                            $sum: {
                                $multiply: ['$items.quantity', '$items.price.amount'],
                            },
                        },
                    },
                },
                { $sort: { sales: -1, revenue: -1 } },
                { $limit: 5 },
                {
                    $project: {
                        _id: 0,
                        productId: '$_id',
                        title: 1,
                        sales: 1,
                        revenue: 1,
                    },
                },
            ]),
        ]);

        const summary = summaryRows[0] || { sales: 0, revenue: 0 };

        return res.status(200).json({
            success: true,
            data: {
                sales: summary.sales,
                revenue: summary.revenue,
                topProducts: topProductsRows,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch seller metrics',
            error: error.message,
        });
    }
}

async function getOrders(req, res) {
    try {
        const sellerId = req.user.id;

        const orders = await orderModel.aggregate([
            {
                $match: {
                    status: { $ne: 'cancelled' },
                },
            },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'product',
                },
            },
            { $unwind: '$product' },
            {
                $match: {
                    'product.seller': productModel.db.base.Types.ObjectId.createFromHexString(sellerId),
                },
            },
            {
                $group: {
                    _id: '$_id',
                    user: { $first: '$user' },
                    status: { $first: '$status' },
                    totalprice: { $first: '$totalprice' },
                    shippingAddress: { $first: '$shippingAddress' },
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' },
                    items: {
                        $push: {
                            productId: '$items.productId',
                            quantity: '$items.quantity',
                            price: '$items.price',
                            productTitle: '$product.title',
                        },
                    },
                },
            },
            { $sort: { createdAt: -1 } },
        ]);

        return res.status(200).json({
            success: true,
            data: orders,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
            error: error.message,
        });
    }
}

async function getProducts(req, res) {
    // Implement logic to fetch products for the seller
    try {
        const sellerId = req.user.id;
        const products = await productModel.find({ seller: sellerId }).exec();
        return res.status(200).json({
            success: true,
            data: products,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch products',
            error: error.message,
        });
    }
}

module.exports = {
    getMetrics,
    getOrders,
    getProducts,
}