const express = require('express');
const { connect } = require('./broker/broker');
const setListener = require('./broker/listeners');


connect().then(() => {
    setListener();
}).catch(err => {
    console.error('Failed to connect to RabbitMQ', err);
});

const app = express();

app.get('/', (req, res) => {
    res.status(200).json({message: 'Notification Service is up and running'});
});

module.exports = app;