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

  app.post('/orders/:id/cancel', createAuthMiddleware(['user']), async (req, res) => {
    try {
      const order = await orderModel.findById(req.params.id);

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      if (String(order.user) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Forbidden: You can only cancel your own orders' });
      }

      if (order.status === 'cancelled') {
        return res.status(409).json({ message: 'Order is already cancelled' });
      }

      if (!['pending', 'paid'].includes(order.status)) {
        return res.status(409).json({
          message: 'Order cannot be cancelled in its current status',
        });
      }

      if (order.status === 'paid' && order.payment && order.payment.captured === true) {
        return res.status(409).json({
          message: 'Order cannot be cancelled after payment capture',
        });
      }

      order.status = 'cancelled';
      order.cancelledBy = 'buyer';
      order.cancelledReason = req.body.reason || 'Buyer requested cancellation';

      if (typeof order.save === 'function') {
        await order.save();
      }

      return res.status(200).json({
        message: 'Order cancelled successfully',
        order,
      });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to cancel order' });
    }
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /orders/:id/cancel - buyer initiated cancellation', () => {
  test('returns 200 and cancels a pending order', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    orderModel.findById.mockResolvedValue({
      _id: 'order-1',
      user: '69b8ed82e51b95688e075431',
      status: 'pending',
      save,
    });

    const response = await request(app)
      .post('/orders/order-1/cancel')
      .set('Cookie', [signAuthCookie()])
      .send({ reason: 'Changed my mind' });

    expect(response.status).toBe(200);
    expect(orderModel.findById).toHaveBeenCalledWith('order-1');
    expect(save).toHaveBeenCalledTimes(1);
    expect(response.body.message).toBe('Order cancelled successfully');
    expect(response.body.order.status).toBe('cancelled');
    expect(response.body.order.cancelledBy).toBe('buyer');
    expect(response.body.order.cancelledReason).toBe('Changed my mind');
  });

  test('returns 200 and cancels a paid order when payment is not captured', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    orderModel.findById.mockResolvedValue({
      _id: 'order-2',
      user: '69b8ed82e51b95688e075431',
      status: 'paid',
      payment: { captured: false },
      save,
    });

    const response = await request(app)
      .post('/orders/order-2/cancel')
      .set('Cookie', [signAuthCookie()])
      .send({});

    expect(response.status).toBe(200);
    expect(save).toHaveBeenCalledTimes(1);
    expect(response.body.order.status).toBe('cancelled');
  });

  test('returns 409 for paid order when payment is already captured', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    orderModel.findById.mockResolvedValue({
      _id: 'order-3',
      user: '69b8ed82e51b95688e075431',
      status: 'paid',
      payment: { captured: true },
      save,
    });

    const response = await request(app)
      .post('/orders/order-3/cancel')
      .set('Cookie', [signAuthCookie()])
      .send({});

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'Order cannot be cancelled after payment capture' });
    expect(save).not.toHaveBeenCalled();
  });

  test('returns 409 when status is neither pending nor paid', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    orderModel.findById.mockResolvedValue({
      _id: 'order-4',
      user: '69b8ed82e51b95688e075431',
      status: 'shipped',
      save,
    });

    const response = await request(app)
      .post('/orders/order-4/cancel')
      .set('Cookie', [signAuthCookie()])
      .send({});

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'Order cannot be cancelled in its current status' });
    expect(save).not.toHaveBeenCalled();
  });

  test('returns 401 when authentication cookie is missing', async () => {
    const response = await request(app).post('/orders/order-1/cancel').send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication token is missing' });
    expect(orderModel.findById).not.toHaveBeenCalled();
  });

  test('returns 404 when order is not found', async () => {
    orderModel.findById.mockResolvedValue(null);

    const response = await request(app)
      .post('/orders/missing-order/cancel')
      .set('Cookie', [signAuthCookie()])
      .send({});

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Order not found' });
  });

  test('returns 403 when buyer tries to cancel another user order', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-5',
      user: 'other-user-id',
      status: 'pending',
      save: jest.fn(),
    });

    const response = await request(app)
      .post('/orders/order-5/cancel')
      .set('Cookie', [signAuthCookie()])
      .send({});

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: 'Forbidden: You can only cancel your own orders',
    });
  });

  test('returns 500 when model operation throws an error', async () => {
    orderModel.findById.mockRejectedValue(new Error('Database unavailable'));

    const response = await request(app)
      .post('/orders/order-6/cancel')
      .set('Cookie', [signAuthCookie()])
      .send({});

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Failed to cancel order' });
  });
});
