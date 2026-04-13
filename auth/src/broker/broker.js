const amqplib = require('amqplib');

let channel, connection;

async function connect() {
    if(connection) return connection;

    if(!process.env.RABBIT_URL) {
        return null;
    }

    try{
        connection = await amqplib.connect(process.env.RABBIT_URL);
        console.log('Connected to RabbitMQ');
        channel = await connection.createChannel();
    }catch(err){
        if(process.env.NODE_ENV !== 'test') {
            console.error('Failed to connect to RabbitMQ', err);
        }
    }

    return connection || null;
}

async function publishToQueue(queueName, data) {
    if(!channel) {
        await connect();
    }

    if(!channel) {
        return false;
    }

    try{
        await channel.assertQueue(queueName, { durable: true });
        channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), { persistent: true });
        console.log(`Message sent to queue ${queueName}`);
        return true;
    }catch(err){
        if(process.env.NODE_ENV !== 'test') {
            console.error(`Failed to publish message to queue ${queueName}`, err);
        }
        return false;
    }
}

async function consumeFromQueue(queueName, callback) {
    if(!channel || !connection) {
        await connect();
    }

    if(!channel) {
        return false;
    }

    try{
        await channel.assertQueue(queueName, { durable: true });
        channel.consume(queueName, async (msg) => {
            if(msg !== null) {
                const data = JSON.parse(msg.content.toString());
                await callback(data);
                channel.ack(msg);
            }
        });
        return true;
    }catch(err){
        if(process.env.NODE_ENV !== 'test') {
            console.error(`Failed to consume messages from queue ${queueName}`, err);
        }
        return false;
    }
}

module.exports = {
    connect,
    channel,
    connection,
    publishToQueue,
    consumeFromQueue
}