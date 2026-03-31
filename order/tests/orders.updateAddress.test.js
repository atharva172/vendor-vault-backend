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

  app.patch('/orders/:id/address', createAuthMiddleware(['user']), async (req, res) => {
    try {
      const { street, city, state, pincode, country } = req.body || {};

      if (!street || !city || !state || !pincode || !country) {
        return res.status(400).json({
          message: 'Shipping address must include street, city, state, pincode, and country',
        });
      }

      const order = await orderModel.findById(req.params.id);

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const ownerId = String(order.user || order.userId);
      if (ownerId !== String(req.user.id)) {
        return res.status(403).json({ message: 'Forbidden: You can only update your own orders' });
      }

      if (order.paymentCaptured === true || order.paymentStatus === 'captured') {
        return res.status(409).json({
          message: 'Cannot update address after payment capture',
        });
      }

      order.shippingAddress = { street, city, state, pincode, country };
      if (typeof order.save === 'function') {
        await order.save();
      }

      return res.status(200).json({
        message: 'Delivery address updated successfully',
        order,
      });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to update delivery address' });
    }
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PATCH /orders/:id/address - update delivery address before payment capture', () => {
  const updatedAddress = {
    street: '22 Lake View Road',
    city: 'Pune',
    state: 'MH',
    pincode: '411001',
    country: 'India',
  };

  test('returns 200 and updates delivery address when payment is not captured', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const order = {
      _id: 'order-1',
      user: '69b8ed82e51b95688e075431',
      paymentCaptured: false,
      shippingAddress: {
        street: 'Old Street',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001',
        country: 'India',
      },
      save,
    };

    orderModel.findById.mockResolvedValue(order);

    const response = await request(app)
      .patch('/orders/order-1/address')
      .set('Cookie', [signAuthCookie()])
      .send(updatedAddress);

    expect(response.status).toBe(200);
    expect(orderModel.findById).toHaveBeenCalledWith('order-1');
    expect(save).toHaveBeenCalledTimes(1);
    expect(order.shippingAddress).toEqual(updatedAddress);
    expect(response.body.message).toBe('Delivery address updated successfully');
  });

  test('returns 401 when authentication cookie is missing', async () => {
    const response = await request(app)
      .patch('/orders/order-1/address')
      .send(updatedAddress);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication token is missing' });
    expect(orderModel.findById).not.toHaveBeenCalled();
  });

  test('returns 404 when order is not found', async () => {
    orderModel.findById.mockResolvedValue(null);

    const response = await request(app)
      .patch('/orders/missing-order/address')
      .set('Cookie', [signAuthCookie()])
      .send(updatedAddress);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Order not found' });
  });

  test('returns 403 when authenticated user tries to update another user order', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-2',
      user: 'another-user-id',
      paymentCaptured: false,
      shippingAddress: updatedAddress,
      save: jest.fn().mockResolvedValue(undefined),
    });

    const response = await request(app)
      .patch('/orders/order-2/address')
      .set('Cookie', [signAuthCookie()])
      .send(updatedAddress);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: 'Forbidden: You can only update your own orders',
    });
  });

  test('returns 409 when payment is already captured', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    orderModel.findById.mockResolvedValue({
      _id: 'order-3',
      user: '69b8ed82e51b95688e075431',
      paymentCaptured: true,
      shippingAddress: updatedAddress,
      save,
    });

    const response = await request(app)
      .patch('/orders/order-3/address')
      .set('Cookie', [signAuthCookie()])
      .send(updatedAddress);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'Cannot update address after payment capture' });
    expect(save).not.toHaveBeenCalled();
  });

  test('returns 400 when required address fields are missing', async () => {
    const response = await request(app)
      .patch('/orders/order-4/address')
      .set('Cookie', [signAuthCookie()])
      .send({
        street: 'Only Street',
        city: 'Pune',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: 'Shipping address must include street, city, state, pincode, and country',
    });
    expect(orderModel.findById).not.toHaveBeenCalled();
  });

  test('returns 500 when data access throws an error', async () => {
    orderModel.findById.mockRejectedValue(new Error('Database unavailable'));

    const response = await request(app)
      .patch('/orders/order-5/address')
      .set('Cookie', [signAuthCookie()])
      .send(updatedAddress);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Failed to update delivery address' });
  });
});
