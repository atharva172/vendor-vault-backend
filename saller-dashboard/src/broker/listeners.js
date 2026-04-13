const {consumeFromQueue} = require('./broker');
const userModel = require('../models/user.model');
const productModel = require('../models/product.model');
const orderModel = require('../models/order.model');
const paymentModel = require('../models/payment.model');

module.exports = function (){
   consumeFromQueue('AUTH_SELLER-DASHBOARD.USER_CREATED', async (msg) => {
       if (!msg || !msg.username || !msg.email) {
           console.warn('Skipping USER_CREATED event: missing required fields');
           return;
       }

       const { _id, ...payload } = msg;

       try {
           await userModel.updateOne(
               { username: msg.username },
               { $set: payload },
               { upsert: true, runValidators: true, setDefaultsOnInsert: true }
           );
       } catch (err) {
           if (err && err.code === 11000) {
               console.warn(`Duplicate USER_CREATED event ignored for username: ${msg.username}`);
               return;
           }
           throw err;
       }
   })

   consumeFromQueue('PRODUCT_SELLER-DASHBOARD.PRODUCT_CREATED', async (productData) => {
       await productModel.create(productData);
   })

   consumeFromQueue('ORDER_SELLER-DASHBOARD.ORDER_CREATED', async (orderData) => {
    await orderModel.create(orderData);
   })

   consumeFromQueue('PAYMENT_SELLER-DASHBOARD.PAYMENT_CREATED', async (paymentData) => {
    await paymentModel.create(paymentData);
   })

   consumeFromQueue('PAYMENT_SELLER-DASHBOARD.PAYMENT_UPDATED', async (paymentData) => {
    const { _id, ...updateData } = paymentData;
    await paymentModel.updateOne({ _id }, { $set: updateData });
   })
}