const {consumeFromQueue} = require('../broker/broker');
const {sendEmail} = require('../email');

module.exports =  function (){
    consumeFromQueue('AUTH_NOTIFICATION.USER_CREATED', async (data) => {
        
        const emailHTMLTemplate = `<h1>Welcome to Our Service, ${data.fullName.firstName + ' ' + (data.fullName.lastName || '')}!</h1>
<p>Thank you for signing up. We're excited to have you on board.</p>
<p>If you have any questions, feel free to reach out to our support team.</p>
<p>Best regards,<br>Your Company Team</p>
`;
 await sendEmail(data.email, 'Welcome to Our Service!', 'Thank you for signing up. We\'re excited to have you on board.', emailHTMLTemplate);
    });

    consumeFromQueue('PRODUCT_NOTIFICATION.PRODUCT_CREATED', async (data) => {
        const emailHTMLTemplate = `<h1>New Product Alert: ${data.name}</h1>
<p>Dear Customer,</p>
<p>We are excited to announce the launch of our new product: <strong>${data.name}</strong>.</p>
<p>${data.description}</p>
<p>Price: $${data.price}</p>
<p>Don't miss out on this amazing product! Visit our website to learn more and make a purchase.</p>
<p>Best regards,<br>Your Company Team</p>
`;
 await sendEmail(data.email, `New Product Alert: ${data.name}`, `We are excited to announce the launch of our new product: ${data.name}.`, emailHTMLTemplate);
    });

    consumeFromQueue('PAYMENT_NOTIFICATION.PAYMENT_INITIATED', async (data) => {
        const emailHTMLTemplate = `<h1>Payment Initiated</h1>
<p>Dear ${data.username},</p>
<p>We have received your payment initiation for the order #${data.orderId} with the amount of $${data.amount}.</p>
<p>We will process your payment shortly and notify you once it's completed.</p>
<p>Thank you for your purchase! If you have any questions, please contact our support team.</p>
<p>Best regards,<br>Your Company Team</p>
`;
 await sendEmail(data.email, 'Payment Initiated', `We have received your payment initiation for the order #${data.orderId} with the amount of $${data.amount}.`, emailHTMLTemplate);
    })

    consumeFromQueue('PAYMENT_NOTIFICATION.PAYMENT_CREATED', async (data) => {
        const emailHTMLTemplate = `<h1>Payment Confirmation</h1>
<p>Dear ${data.username},</p>
<p>We have received your payment of $${data.amount} for the order #${data.orderId}.</p>
<p>Thank you for your purchase! If you have any questions, please contact our support team.</p>
<p>Best regards,<br>Your Company Team</p>
`;
 await sendEmail(data.email, 'Payment Confirmation', `We have received your payment of $${data.amount} for the order #${data.orderId}.`, emailHTMLTemplate);
    })

    consumeFromQueue('PAYMENT_NOTIFICATION.PAYMENT_FAILED', async (data) => {
        const emailHTMLTemplate = `<h1>Payment Failed</h1>
<p>Dear ${data.username},</p>
<p>Unfortunately, we were unable to process your payment of $${data.amount} for the order #${data.orderId}.</p>
<p>Please check your payment details and try again. If you continue to experience issues, contact our support team for assistance.</p>
<p>Best regards,<br>Your Company Team</p>
`;
 await sendEmail(data.email, 'Payment Failed', `Unfortunately, we were unable to process your payment of $${data.amount} for the order #${data.orderId}.`, emailHTMLTemplate);
    })

}