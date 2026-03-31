const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

const { createAuthMiddleware } = require('../src/middleware/auth.middleware');

jest.mock('../src/models/order.model', () => ({
  findById: jest.fn(),
}));

const orderModel = require('../src/models/order.model');
const app = express();

app.use(express.json());
app.use(cookieParser());

function signAuthCookie(payload = { id: '69b8ed82e51b95688e075431', role: 'user' }) {
  const secret = process.env.JWT_SECRET || 'test-secret';
  const token = jwt.sign(payload, secret);
  return `token=${token}`;
}

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

  app.get('/orders/:id', createAuthMiddleware(['user']), async (req, res) => {
    try {
      const order = await orderModel.findById(req.params.id);

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      if (String(order.user) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Forbidden: You can only access your own orders' });
      }

      return res.status(200).json(order);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to fetch order' });
    }
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /orders/:id', () => {
  test('returns 200 with order details when order exists for authenticated user', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-1',
      user: '69b8ed82e51b95688e075431',
      status: 'pending',
      items: [{ productId: 'prod-1', quantity: 1, price: { amount: 100, currency: 'INR' } }],
    });

    const response = await request(app)
      .get('/orders/order-1')
      .set('Cookie', [signAuthCookie()]);

    expect(response.status).toBe(200);
    expect(orderModel.findById).toHaveBeenCalledWith('order-1');
    expect(response.body).toEqual(
      expect.objectContaining({
        _id: 'order-1',
        user: '69b8ed82e51b95688e075431',
        status: 'pending',
      })
    );
  });

  test('returns 401 when authentication cookie is missing', async () => {
    const response = await request(app).get('/orders/order-1');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication token is missing' });
    expect(orderModel.findById).not.toHaveBeenCalled();
  });

  test('returns 404 when order is not found', async () => {
    orderModel.findById.mockResolvedValue(null);

    const response = await request(app)
      .get('/orders/missing-order')
      .set('Cookie', [signAuthCookie()]);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Order not found' });
  });

  test('returns 403 when authenticated user tries to access another user order', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-2',
      user: 'different-user-id',
      status: 'confirmed',
      items: [{ productId: 'prod-2', quantity: 2, price: { amount: 200, currency: 'INR' } }],
    });

    const response = await request(app)
      .get('/orders/order-2')
      .set('Cookie', [signAuthCookie({ id: '69b8ed82e51b95688e075431', role: 'user' })]);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Forbidden: You can only access your own orders' });
  });

  test('returns 500 when data access throws an error', async () => {
    orderModel.findById.mockRejectedValue(new Error('Database unavailable'));

    const response = await request(app)
      .get('/orders/order-3')
      .set('Cookie', [signAuthCookie()]);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Failed to fetch order' });
  });
});
