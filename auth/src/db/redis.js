const { Redis } = require('ioredis');

function createInMemoryRedisClient() {
    const store = new Map();

    return {
        async set(key, value) {
            store.set(key, value);
            return 'OK';
        },
        async get(key) {
            return store.has(key) ? store.get(key) : null;
        },
        async del(key) {
            const existed = store.has(key);
            store.delete(key);
            return existed ? 1 : 0;
        },
        on() {
            return this;
        },
        async quit() {
            store.clear();
            return 'OK';
        },
        disconnect() {
            store.clear();
        }
    };
}

let redisClient;

if (process.env.NODE_ENV === 'test') {
    redisClient = createInMemoryRedisClient();
} else {
    redisClient = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
    });

    redisClient.on('connect', () => {
        console.log('Connected to Redis');
    });
}

module.exports = redisClient;