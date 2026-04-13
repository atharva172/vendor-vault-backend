const express = require('express');
const cookieParser = require('cookie-parser');
const paymentRoute = require('./routes/payment.route');

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
    res.status(200).json({message: 'Payment Service is up and running'});
});
app.use('/api/payment', paymentRoute);


module.exports = app;