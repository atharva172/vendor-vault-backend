require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/db/db');
const {connect} = require('./src/broker/broker');

// Connect to MongoDB
connectDB();
// Connect to RabbitMQ
connect();


app.listen(3004, () => {
    console.log('Payment service is running on port 3004');
})