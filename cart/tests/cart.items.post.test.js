const request = require('supertest');

jest.mock('../src/middleware/auth.middleware', () => ({
    createAuthMiddleware: () => (req, res, next) => {
        const authHeader = req.headers.authorization;

        if (authHeader !== 'Bearer valid-token') {
            return res.status(401).json({ message: 'Authentication token is missing' });
        }

        req.user = { id: '507f1f77bcf86cd799439011', role: 'user' };
        return next();
    },
}));

jest.mock('../src/middleware/validation.middleware', () => ({
    cartItemValidationRules: [
        (req, res, next) => next(),
    ],
    cartItemUpdateValidationRules: [
        (req, res, next) => next(),
    ],
}));

jest.mock('../src/models/cart.model', () => {
    const Cart = jest.fn(function Cart(data) {
        Object.assign(this, data);
        this.save = jest.fn().mockResolvedValue(this);
    });

    Cart.findOne = jest.fn();

    return Cart;
});

const app = require('../src/app');
const Cart = require('../src/models/cart.model');

describe('POST /api/cart/items', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when token is missing', async () => {
        const response = await request(app)
            .post('/api/cart/items')
            .send({
                productId: '507f191e810c19729de860ea',
                qty: 1,
            });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Authentication token is missing');
    });

    it('returns 400 when productId is missing', async () => {
        const response = await request(app)
            .post('/api/cart/items')
            .set('Authorization', 'Bearer valid-token')
            .send({ qty: 2 });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('productId and qty are required');
    });

    it('returns 400 when qty is invalid', async () => {
        const response = await request(app)
            .post('/api/cart/items')
            .set('Authorization', 'Bearer valid-token')
            .send({
                productId: '507f191e810c19729de860ea',
                qty: 0,
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('qty must be a positive integer');
    });

    it('creates a new cart when user has no cart', async () => {
        Cart.findOne.mockResolvedValue(null);

        const response = await request(app)
            .post('/api/cart/items')
            .set('Authorization', 'Bearer valid-token')
            .send({
                productId: '507f191e810c19729de860ea',
                qty: 3,
            });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Item added to cart');
        expect(Cart.findOne).toHaveBeenCalledWith({ user: '507f1f77bcf86cd799439011' });
        expect(Cart).toHaveBeenCalledWith({
            user: '507f1f77bcf86cd799439011',
            items: [{ productId: '507f191e810c19729de860ea', quantity: 3 }],
        });

        const createdCart = Cart.mock.instances[0];
        expect(createdCart.save).toHaveBeenCalledTimes(1);
    });

    it('increments quantity when product already exists in cart', async () => {
        const existingCart = {
            user: '507f1f77bcf86cd799439011',
            items: [
                {
                    productId: '507f191e810c19729de860ea',
                    quantity: 2,
                },
            ],
            save: jest.fn().mockResolvedValue(true),
        };

        Cart.findOne.mockResolvedValue(existingCart);

        const response = await request(app)
            .post('/api/cart/items')
            .set('Authorization', 'Bearer valid-token')
            .send({
                productId: '507f191e810c19729de860ea',
                qty: 4,
            });

        expect(response.status).toBe(200);
        expect(existingCart.items[0].quantity).toBe(6);
        expect(existingCart.save).toHaveBeenCalledTimes(1);
    });

    it('pushes a new item when product does not exist in cart', async () => {
        const existingCart = {
            user: '507f1f77bcf86cd799439011',
            items: [
                {
                    productId: '507f191e810c19729de860ea',
                    quantity: 2,
                },
            ],
            save: jest.fn().mockResolvedValue(true),
        };

        Cart.findOne.mockResolvedValue(existingCart);

        const response = await request(app)
            .post('/api/cart/items')
            .set('Authorization', 'Bearer valid-token')
            .send({
                productId: '507f191e810c19729de860eb',
                qty: 1,
            });

        expect(response.status).toBe(200);
        expect(existingCart.items).toHaveLength(2);
        expect(existingCart.items[1]).toEqual({
            productId: '507f191e810c19729de860eb',
            quantity: 1,
        });
        expect(existingCart.save).toHaveBeenCalledTimes(1);
    });
});
