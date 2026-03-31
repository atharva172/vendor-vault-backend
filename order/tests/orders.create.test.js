const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../src/app');
const { createAuthMiddleware } = require('../src/middleware/auth.middleware');

jest.mock('../src/models/order.model', () => ({
  create: jest.fn(),
}));

const orderModel = require('../src/models/order.model');

const cartService = {
  getCurrentCart: jest.fn(),
  clearCart: jest.fn(),
};

const inventoryService = {
  reserveItems: jest.fn(),
};

const TAX_RATE = 0.1;
const SHIPPING_FLAT = 50;

function round2(value) {
  return Number(value.toFixed(2));
}

function signAuthCookie(payload = { id: '69b8ed82e51b95688e075431', role: 'user' }) {
  const secret = process.env.JWT_SECRET || 'test-secret';
  const token = jwt.sign(payload, secret);
  return `token=${token}`;
}

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

  app.post('/orders', createAuthMiddleware(['user']), async (req, res) => {
    try {
      const userId = req.user.id;
      const cart = await cartService.getCurrentCart(userId);

      if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        return res.status(400).json({ message: 'Cart is empty' });
      }

      const copiedPricedItems = cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: {
          amount: item.price.amount,
          currency: item.price.currency,
        },
      }));

      const subtotal = copiedPricedItems.reduce(
        (sum, item) => sum + item.price.amount * item.quantity,
        0
      );
      const taxes = round2(subtotal * TAX_RATE);
      const shipping = SHIPPING_FLAT;
      const total = round2(subtotal + taxes + shipping);

      await inventoryService.reserveItems(
        copiedPricedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
      );

      const payload = {
        user: userId,
        items: copiedPricedItems,
        status: 'pending',
        totalprice: {
          amount: total,
          currency: cart.currency || 'INR',
        },
        pricingBreakdown: {
          subtotal: round2(subtotal),
          taxes,
          shipping,
        },
        shippingAddress: req.body.shippingAddress || cart.shippingAddress,
      };

      const createdOrder = await orderModel.create(payload);
      await cartService.clearCart(userId);

      return res.status(201).json(createdOrder);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to create order' });
    }
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /orders - create from current cart', () => {
  test('creates order with copied priced items, computes tax/shipping, sets pending, and reserves inventory', async () => {
    cartService.getCurrentCart.mockResolvedValue({
      currency: 'INR',
      shippingAddress: {
        street: '1 Main St',
        pincode: '400001',
        city: 'Mumbai',
        state: 'MH',
        country: 'India',
      },
      items: [
        {
          productId: 'prod-1',
          quantity: 2,
          price: { amount: 100, currency: 'INR' },
        },
        {
          productId: 'prod-2',
          quantity: 1,
          price: { amount: 150, currency: 'INR' },
        },
      ],
    });

    inventoryService.reserveItems.mockResolvedValue({ ok: true });

    orderModel.create.mockImplementation(async (order) => ({
      _id: 'order-1',
      ...order,
    }));

    const response = await request(app)
      .post('/orders')
      .set('Cookie', [signAuthCookie()])
      .send({});

    expect(response.status).toBe(201);
    expect(inventoryService.reserveItems).toHaveBeenCalledWith([
      { productId: 'prod-1', quantity: 2 },
      { productId: 'prod-2', quantity: 1 },
    ]);

    expect(orderModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: '69b8ed82e51b95688e075431',
        status: 'pending',
        totalprice: {
          amount: 435,
          currency: 'INR',
        },
      })
    );

    expect(response.body.status).toBe('pending');
    expect(response.body.pricingBreakdown).toEqual({
      subtotal: 350,
      taxes: 35,
      shipping: 50,
    });
  });

  test('returns 401 when authentication cookie is missing', async () => {
    const response = await request(app).post('/orders').send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication token is missing' });
    expect(orderModel.create).not.toHaveBeenCalled();
  });

  test('returns 400 when cart has no items', async () => {
    cartService.getCurrentCart.mockResolvedValue({ items: [] });

    const response = await request(app)
      .post('/orders')
      .set('Cookie', [signAuthCookie()])
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Cart is empty' });
    expect(inventoryService.reserveItems).not.toHaveBeenCalled();
    expect(orderModel.create).not.toHaveBeenCalled();
  });

  test('returns 500 and does not create order when inventory reservation fails', async () => {
    cartService.getCurrentCart.mockResolvedValue({
      currency: 'INR',
      shippingAddress: {
        street: '1 Main St',
        pincode: '400001',
        city: 'Mumbai',
        state: 'MH',
        country: 'India',
      },
      items: [
        {
          productId: 'prod-1',
          quantity: 1,
          price: { amount: 99, currency: 'INR' },
        },
      ],
    });

    inventoryService.reserveItems.mockRejectedValue(new Error('Insufficient stock'));

    const response = await request(app)
      .post('/orders')
      .set('Cookie', [signAuthCookie()])
      .send({});

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Failed to create order' });
    expect(orderModel.create).not.toHaveBeenCalled();
  });
});
