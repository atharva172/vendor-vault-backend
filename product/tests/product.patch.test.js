const request = require('supertest');

jest.mock('../src/models/product.model', () => ({
  findOne: jest.fn(),
}));

jest.mock('../src/services/imagekit.service', () => ({
  uploadImage: jest.fn(),
}));

jest.mock('../src/middleware/auth.middleware', () => ({
  createAuthMiddleware: () => (req, res, next) => {
    req.user = {
      id: req.headers['x-test-user-id'] || 'seller_1',
      role: (req.headers['x-test-role'] || 'seller').toLowerCase(),
    };
    next();
  },
}));

const app = require('../src/app');
const productModel = require('../src/models/product.model');

// NOTE:
// PATCH route/controller is not implemented in the current codebase.
// These tests define expected behavior once `/api/products/:id` PATCH is added.
describe('PATCH /api/products/:id (SELLER)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validProductId = '507f1f77bcf86cd799439011';

  it('should update allowed product fields for owner seller', async () => {
    const set = jest.fn();
    const save = jest.fn().mockResolvedValue();
    const productDoc = {
      _id: validProductId,
      seller: { toString: () => 'seller_1' },
      title: 'Old title',
      description: 'Old description',
      price: { amount: 1000, currency: 'INR' },
      set,
      save,
    };

    productModel.findOne.mockResolvedValue(productDoc);

    const response = await request(app)
      .patch(`/api/products/${validProductId}`)
      .set('x-test-user-id', 'seller_1')
      .set('x-test-role', 'seller')
      .send({
        title: 'New title',
        description: 'Updated description',
        price: {
          amount: 1500,
          currency: 'INR',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Product updated successfully');
    expect(productModel.findOne).toHaveBeenCalledWith({ _id: validProductId });
    expect(set).toHaveBeenCalledWith('title', 'New title');
    expect(set).toHaveBeenCalledWith('description', 'Updated description');
    expect(set).toHaveBeenCalledWith('price.amount', 1500);
    expect(set).toHaveBeenCalledWith('price.currency', 'INR');
    expect(save).toHaveBeenCalled();
  });

  it('should return 404 when product does not exist', async () => {
    productModel.findOne.mockResolvedValue(null);

    const response = await request(app)
      .patch(`/api/products/${validProductId}`)
      .set('x-test-user-id', 'seller_1')
      .set('x-test-role', 'seller')
      .send({ title: 'Any title' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Product not found');
  });

  it('should return 403 when seller tries to update another seller product', async () => {
    productModel.findOne.mockResolvedValue({
      _id: validProductId,
      seller: { toString: () => 'seller_2' },
    });

    const response = await request(app)
      .patch(`/api/products/${validProductId}`)
      .set('x-test-user-id', 'seller_1')
      .set('x-test-role', 'seller')
      .send({ title: 'New title' });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Forbidden: You can only update your own product');
  });

  it('should return 400 when product id is invalid', async () => {
    const response = await request(app)
      .patch('/api/products/invalid-id')
      .set('x-test-user-id', 'seller_1')
      .set('x-test-role', 'seller')
      .send({ title: 'Any title' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid product id');
  });

  it('should return 400 when save fails with validation error', async () => {
    const save = jest.fn().mockRejectedValue({
      name: 'ValidationError',
      message: 'Validation failed in model',
    });
    const productDoc = {
      _id: validProductId,
      seller: { toString: () => 'seller_1' },
      set: jest.fn(),
      save,
    };

    productModel.findOne.mockResolvedValue(productDoc);

    const response = await request(app)
      .patch(`/api/products/${validProductId}`)
      .set('x-test-user-id', 'seller_1')
      .set('x-test-role', 'seller')
      .send({ title: 'New title' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    expect(response.body.error).toBe('Validation failed in model');
  });
});
