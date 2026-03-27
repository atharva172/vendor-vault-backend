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

describe('GET /api/cart', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when token is missing', async () => {
        const response = await request(app).get('/api/cart');

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Authentication token is missing');
    });

    it('returns 404 when cart is not found for user', async () => {
        Cart.findOne.mockResolvedValue(null);

        const response = await request(app)
            .get('/api/cart')
            .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Cart not found');
        expect(Cart.findOne).toHaveBeenCalledWith({ user: '507f1f77bcf86cd799439011' });
    });

    it('returns current cart with items and totals', async () => {
        const existingCart = {
            user: '507f1f77bcf86cd799439011',
            items: [
                { productId: '507f191e810c19729de860ea', quantity: 2 },
                { productId: '507f191e810c19729de860eb', quantity: 3 },
            ],
        };

        Cart.findOne.mockResolvedValue(existingCart);

        const response = await request(app)
            .get('/api/cart')
            .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(200);
        expect(response.body.cart.items).toEqual(existingCart.items);
        expect(response.body.totals).toEqual({
            totalItems: 2,
            totalQuantity: 5,
        });
    });
});
