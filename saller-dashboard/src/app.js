const express = require('express');
const cookieparser = require('cookie-parser');
const sallerRoute = require('./routes/saller.route');


const app = express();
app.use(express.json());
app.use(cookieparser());

app.get('/', (req, res) => {
    res.status(200).json({ message: 'Seller Dashboard is up and running' });
});

app.use('/api/saller/dashboard', sallerRoute);


module.exports = app;