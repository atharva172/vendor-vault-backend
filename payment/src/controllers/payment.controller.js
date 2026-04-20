const paymentModel = require('../models/payment.model');
const axios = require('axios');
const { validatePaymentVerification } = require('razorpay/dist/utils/razorpay-utils');
const {publishToQueue} = require('../broker/broker');

require('dotenv').config();
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function getValueAtPath(obj, path) {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function toFiniteNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function firstNumberFromPaths(source, paths) {
    for (const path of paths) {
        const number = toFiniteNumber(getValueAtPath(source, path));
        if (number != null) {
            return number;
        }
    }
    return null;
}

function firstStringFromPaths(source, paths) {
    for (const path of paths) {
        const value = getValueAtPath(source, path);
        if (typeof value === 'string' && value.trim() !== '') {
            return value;
        }
    }
    return null;
}

function normalizeOrderPayload(payload) {
    return payload?.order || payload?.data?.order || payload?.data || payload || {};
}

function buildPaymentAmountDetails(orderPayload) {
    const amountInPaise = firstNumberFromPaths(orderPayload, [
        'amountInPaise',
        'price.amountInPaise',
        'totalprice.amountInPaise',
    ]);

    const amountInRupees = firstNumberFromPaths(orderPayload, [
        'price.amount',
        'totalPrice',
        'totalprice.amount',
        'totalprice',
        'price',
        'amount',
        'totalAmount',
        'grandTotal',
        'payableAmount',
        'total',
    ]);

    const currency = (firstStringFromPaths(orderPayload, ['price.currency', 'totalprice.currency', 'currency']) || 'INR').toUpperCase();

    const amount = amountInPaise != null && amountInPaise > 0
        ? Math.round(amountInPaise)
        : Math.round((amountInRupees ?? NaN) * 100);

    return { amount, currency };
}


async function createPayment(req, res) {
    const token = req.cookies?.token || req.headers?.authorization?.split(' ')[1];
    const orderId = req.params?.orderId || req.body?.orderId;

    if (!orderId) {
        return res.status(400).json({ message: 'orderId is required' });
    }

    try{
         const orderResponse = await axios.get(`vendor-vault-ALB-1065200681.ap-south-1.elb.amazonaws.com/api/orders/${orderId}`, {
             headers: {
                 'Authorization': `Bearer ${token}`
             }
         });
        
      const payload = orderResponse?.data || {};
      const orderPayload = normalizeOrderPayload(payload);
      const { amount, currency } = buildPaymentAmountDetails(orderPayload);

        if (!Number.isFinite(amount) || amount <= 0) {
          const rootKeys = Object.keys(payload || {});
          const dataKeys = payload?.data && typeof payload.data === 'object' ? Object.keys(payload.data) : [];
          console.error('Invalid amount payload from order service:', payload);
          return res.status(400).json({
             message: 'Invalid order amount received from order service',
             debug: {
                rootKeys,
                dataKeys,
             },
          });
        }

        const order = await razorpay.orders.create({
            amount,
            currency,
            receipt: `rcpt_${orderId}`,
        });

        const amountInPaise = order.amount;
        const amountInRupees = Number((amountInPaise / 100).toFixed(2));

        const payment = await paymentModel.create({
            order: orderId,
            RazorpayOrderId: order.id,
            user: req.user.id,
            status: 'pending',
            price: {
                amount: amountInRupees,
                currency: order.currency,
            },
        });

        await publishToQueue('PAYMENT_SELLER-DASHBOARD.PAYMENT_CREATED', payment); 
        await publishToQueue('PAYMENT_NOTIFICATION.PAYMENT_INITIATED', {
            email: req.user.email,
            paymentId: payment._id,
            orderId: payment.order,
            amount: payment.price.amount,
            currency: payment.price.currency,
        });

        return res.status(201).json({
            message: 'Payment created successfully',
            payment: {
                id: payment._id,    
                order: payment.order,
                RazorpayOrderId: payment.RazorpayOrderId,
                price: {
                    amount: payment.price.amount,
                    currency: payment.price.currency,
                },
                status: payment.status,
            },
        });

         
    }catch (err) {
        const status = err?.response?.status || 500;
        const message =
            err?.response?.data?.message ||
            err?.error?.description ||
            err?.message ||
            'Internal server error';

        console.error('Error creating payment:', err?.response?.data || err?.error || err);
        return res.status(status).json({ message });
    }
}

async function verifyPayment(req, res) {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ message: 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required' });
    }

    if (!secret) {
        return res.status(500).json({ message: 'RAZORPAY_KEY_SECRET is not configured' });
    }

    try {
        const isValid = validatePaymentVerification(
            {
                order_id: razorpay_order_id,
                payment_id: razorpay_payment_id,
            },
            razorpay_signature,
            secret
        );

        if (!isValid) {
            return res.status(400).json({ message: 'Invalid payment signature' });
        }

        const payment = await paymentModel.findOne({ RazorpayOrderId: razorpay_order_id, status: 'pending' });
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found or already processed' });
        }

        payment.status = 'completed';
        payment.paymentId = razorpay_payment_id;
        payment.signature = razorpay_signature;
        await payment.save();

        await publishToQueue('PAYMENT_NOTIFICATION.PAYMENT_CREATED', {
                email: payment?.user?.email,
                paymentId: payment._id,
                orderId: payment.order,
                amount: payment.price.amount,
                currency: payment.price.currency,
            })

        await publishToQueue('PAYMENT_SELLER-DASHBOARD.PAYMENT_UPDATED', payment);

        return res.status(200).json({ message: 'Payment verified successfully' });
    } catch (err) {
        console.error('Error verifying payment:', err);

        await publishToQueue('PAYMENT_NOTIFICATION.PAYMENT_VERIFICATION_FAILED', {
            email: payment?.user?.email,
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
        })
        return res.status(500).json({ message: 'Internal server error' });
    }

}

module.exports = {
    createPayment,
    verifyPayment,
};