const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    paymentId: {
        type: String,
    },
    RazorpayOrderId: {
        type: String,
        required: true,
    },
    signature: {
        type: String,
    },
    status: {
        type: String,        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    user:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    price:{
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            required: true,
            default: 'INR',
            enum: ['INR', 'USD']
        },
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
})

const paymentModel = mongoose.model('Payment', paymentSchema);

module.exports = paymentModel;