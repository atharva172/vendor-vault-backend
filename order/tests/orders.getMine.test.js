const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

const { createAuthMiddleware } = require('../src/middleware/auth.middleware');

jest.mock('../src/models/order.model', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
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

  app.get('/orders/me', createAuthMiddleware(['user']), async (req, res) => {
    try {
      const rawPage = Number(req.query.page);
      const rawLimit = Number(req.query.limit);
      const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
      const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 10;

      const query = { user: req.user.id };
      const totalOrders = await orderModel.countDocuments(query);
      const orders = await orderModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      return res.status(200).json({
        orders,
        pagination: {
          page,
          limit,
          totalOrders,
          totalPages: Math.ceil(totalOrders / limit),
        },
      });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to fetch customer orders' });
    }
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /orders/me - paginated customer orders', () => {
  test('returns paginated orders with default page=1 and limit=10', async () => {
    const orders = [
      { _id: 'o-1', user: '69b8ed82e51b95688e075431', status: 'pending' },
      { _id: 'o-2', user: '69b8ed82e51b95688e075431', status: 'confirmed' },
    ];

    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(orders),
    };

    orderModel.countDocuments.mockResolvedValue(2);
    orderModel.find.mockReturnValue(chain);

    const response = await request(app)
      .get('/orders/me')
      .set('Cookie', [signAuthCookie()]);

    expect(response.status).toBe(200);
    expect(orderModel.countDocuments).toHaveBeenCalledWith({ user: '69b8ed82e51b95688e075431' });
    expect(orderModel.find).toHaveBeenCalledWith({ user: '69b8ed82e51b95688e075431' });
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(response.body).toEqual({
      orders,
      pagination: {
        page: 1,
        limit: 10,
        totalOrders: 2,
        totalPages: 1,
      },
    });
  });

  test('applies page and limit query params to pagination and skip', async () => {
    const orders = [
      { _id: 'o-3', user: '69b8ed82e51b95688e075431', status: 'shipped' },
      { _id: 'o-4', user: '69b8ed82e51b95688e075431', status: 'delivered' },
    ];

    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(orders),
    };

    orderModel.countDocuments.mockResolvedValue(7);
    orderModel.find.mockReturnValue(chain);

    const response = await request(app)
      .get('/orders/me?page=2&limit=2')
      .set('Cookie', [signAuthCookie()]);

    expect(response.status).toBe(200);
    expect(chain.skip).toHaveBeenCalledWith(2);
    expect(chain.limit).toHaveBeenCalledWith(2);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 2,
      totalOrders: 7,
      totalPages: 4,
    });
  });

  test('returns 401 when authentication cookie is missing', async () => {
    const response = await request(app).get('/orders/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication token is missing' });
    expect(orderModel.find).not.toHaveBeenCalled();
    expect(orderModel.countDocuments).not.toHaveBeenCalled();
  });

  test('returns empty list with totalPages=0 when customer has no orders', async () => {
    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };

    orderModel.countDocuments.mockResolvedValue(0);
    orderModel.find.mockReturnValue(chain);

    const response = await request(app)
      .get('/orders/me')
      .set('Cookie', [signAuthCookie()]);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      orders: [],
      pagination: {
        page: 1,
        limit: 10,
        totalOrders: 0,
        totalPages: 0,
      },
    });
  });

  test('returns 500 when order lookup fails', async () => {
    orderModel.countDocuments.mockRejectedValue(new Error('Database unavailable'));

    const response = await request(app)
      .get('/orders/me')
      .set('Cookie', [signAuthCookie()]);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Failed to fetch customer orders' });
  });

  test('falls back to defaults when page or limit are invalid', async () => {
    const orders = [{ _id: 'o-5', user: '69b8ed82e51b95688e075431', status: 'pending' }];
    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(orders),
    };

    orderModel.countDocuments.mockResolvedValue(1);
    orderModel.find.mockReturnValue(chain);

    const response = await request(app)
      .get('/orders/me?page=0&limit=-3')
      .set('Cookie', [signAuthCookie()]);

    expect(response.status).toBe(200);
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 10,
      totalOrders: 1,
      totalPages: 1,
    });
  });
});
