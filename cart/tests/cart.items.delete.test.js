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

describe('DELETE /api/cart/items/:productId', () => {
    const productId = '507f191e810c19729de860ea';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when token is missing', async () => {
        const response = await request(app).delete(`/api/cart/items/${productId}`);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Authentication token is missing');
    });

    it('returns 400 when productId is invalid', async () => {
        const response = await request(app)
            .delete('/api/cart/items/invalid-product-id')
            .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid productId');
    });

    it('returns 404 when cart is not found', async () => {
        Cart.findOne.mockResolvedValue(null);

        const response = await request(app)
            .delete(`/api/cart/items/${productId}`)
            .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Cart not found');
    });

    it('returns 404 when item is not found in cart', async () => {
        const existingCart = {
            user: '507f1f77bcf86cd799439011',
            items: [
                { productId: '507f191e810c19729de860eb', quantity: 2 },
            ],
            save: jest.fn().mockResolvedValue(true),
        };

        Cart.findOne.mockResolvedValue(existingCart);

        const response = await request(app)
            .delete(`/api/cart/items/${productId}`)
            .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Item not found in cart');
        expect(existingCart.save).not.toHaveBeenCalled();
    });

    it('removes the item and returns updated cart', async () => {
        const existingCart = {
            user: '507f1f77bcf86cd799439011',
            items: [
                { productId, quantity: 2 },
                { productId: '507f191e810c19729de860eb', quantity: 1 },
            ],
            save: jest.fn().mockResolvedValue(true),
        };

        Cart.findOne.mockResolvedValue(existingCart);

        const response = await request(app)
            .delete(`/api/cart/items/${productId}`)
            .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Item removed from cart');
        expect(existingCart.items).toHaveLength(1);
        expect(existingCart.items[0]).toEqual({
            productId: '507f191e810c19729de860eb',
            quantity: 1,
        });
        expect(existingCart.save).toHaveBeenCalledTimes(1);
    });

    it('returns 500 when delete operation fails unexpectedly', async () => {
        Cart.findOne.mockRejectedValue(new Error('db error'));

        const response = await request(app)
            .delete(`/api/cart/items/${productId}`)
            .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to remove item from cart');
    });
});
