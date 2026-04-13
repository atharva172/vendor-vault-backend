require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/db/db');
const {connect} = require('./src/broker/broker');
const setupListeners = require('./src/broker/listeners');


connectDB().then(() => {
    console.log('Database connection established');
}).catch(err => {
    console.error('Failed to connect to database', err);
});

connect().then(() => {
    setupListeners();
}).catch(err => {
    console.error('Failed to connect to RabbitMQ', err);
});





app.listen(3007, () => {
    console.log('seller-dashboard is running on port 3007');
})