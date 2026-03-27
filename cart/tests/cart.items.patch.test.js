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

describe('PATCH /api/cart/items/:productId', () => {
    const productId = '507f191e810c19729de860ea';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when token is missing', async () => {
        const response = await request(app)
            .patch(`/api/cart/items/${productId}`)
            .send({ qty: 3 });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Authentication token is missing');
    });

    it('returns 400 when qty is missing', async () => {
        const response = await request(app)
            .patch(`/api/cart/items/${productId}`)
            .set('Authorization', 'Bearer valid-token')
            .send({});

        expect(response.status).toBe(400);
    });

    it('returns 400 when qty is invalid', async () => {
        const response = await request(app)
            .patch(`/api/cart/items/${productId}`)
            .set('Authorization', 'Bearer valid-token')
            .send({ qty: 0 });

        expect(response.status).toBe(400);
    });

    it('returns 404 when cart item does not exist', async () => {
        const existingCart = {
            user: '507f1f77bcf86cd799439011',
            items: [
                { productId: '507f191e810c19729de860eb', quantity: 2 },
            ],
            save: jest.fn().mockResolvedValue(true),
        };

        Cart.findOne.mockResolvedValue(existingCart);

        const response = await request(app)
            .patch(`/api/cart/items/${productId}`)
            .set('Authorization', 'Bearer valid-token')
            .send({ qty: 5 });

        expect(response.status).toBe(404);
    });

    it('updates quantity when cart item exists', async () => {
        const existingCart = {
            user: '507f1f77bcf86cd799439011',
            items: [
                { productId, quantity: 2 },
            ],
            save: jest.fn().mockResolvedValue(true),
        };

        Cart.findOne.mockResolvedValue(existingCart);

        const response = await request(app)
            .patch(`/api/cart/items/${productId}`)
            .set('Authorization', 'Bearer valid-token')
            .send({ qty: 5 });

        expect(response.status).toBe(200);
        expect(existingCart.items[0].quantity).toBe(5);
        expect(existingCart.save).toHaveBeenCalledTimes(1);
    });
});