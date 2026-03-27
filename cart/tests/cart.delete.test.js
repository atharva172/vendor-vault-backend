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

describe('DELETE /api/cart', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when token is missing', async () => {
        const response = await request(app).delete('/api/cart');

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Authentication token is missing');
    });

    it('returns 404 when cart is not found', async () => {
        Cart.findOne.mockResolvedValue(null);

        const response = await request(app)
            .delete('/api/cart')
            .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Cart not found');
        expect(Cart.findOne).toHaveBeenCalledWith({ user: '507f1f77bcf86cd799439011' });
    });

    it('clears cart items and returns success', async () => {
        const existingCart = {
            user: '507f1f77bcf86cd799439011',
            items: [
                { productId: '507f191e810c19729de860ea', quantity: 2 },
                { productId: '507f191e810c19729de860eb', quantity: 1 },
            ],
            save: jest.fn().mockResolvedValue(true),
        };

        Cart.findOne.mockResolvedValue(existingCart);

        const response = await request(app)
            .delete('/api/cart')
            .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Cart cleared');
        expect(existingCart.items).toEqual([]);
        expect(existingCart.save).toHaveBeenCalledTimes(1);
    });

    it('returns 500 when clear cart fails unexpectedly', async () => {
        Cart.findOne.mockRejectedValue(new Error('db error'));

        const response = await request(app)
            .delete('/api/cart')
            .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to clear cart');
    });
});
