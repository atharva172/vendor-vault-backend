const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    street: String,
    pincode: String,
    city: String,
    state: String,
    country: String,
});

const orderSchema = new mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    items:[
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
        },     quantity: {
                type: Number,
                default: 1,
                min: 1,
        },
            price: {
                amount: {
                    type: Number,
                    required: true,
                },
                currency: {
                    type: String,
                    enum: ['USD', 'INR'], // Example currencies, adjust as needed
                    required: true
                }
            }
    }
    ],
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    totalprice: {
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            enum: ['USD', 'INR'], // Example currencies, adjust as needed
            required: true
        }
    },
    shippingAddress: {
        type: addressSchema,
        required: true
    }
}, { timestamps: true });


const orderModel = mongoose.model('Order', orderSchema);
module.exports = orderModel;
