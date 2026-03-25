const request = require('supertest');

jest.mock('../src/models/product.model', () => ({
  findOne: jest.fn(),
  deleteOne: jest.fn(),
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

describe('DELETE /api/products/:id (SELLER)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validProductId = '507f1f77bcf86cd799439011';

  it('should delete product successfully for owner seller', async () => {
    productModel.findOne.mockResolvedValue({
      _id: validProductId,
      seller: { toString: () => 'seller_1' },
    });

    productModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

    const response = await request(app)
      .delete(`/api/products/${validProductId}`)
      .set('x-test-user-id', 'seller_1')
      .set('x-test-role', 'seller');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Product deleted successfully');
    expect(productModel.findOne).toHaveBeenCalledWith({ _id: validProductId });
    expect(productModel.deleteOne).toHaveBeenCalledWith({ _id: validProductId });
  });

  it('should return 400 when product id is invalid', async () => {
    const response = await request(app)
      .delete('/api/products/invalid-id')
      .set('x-test-user-id', 'seller_1')
      .set('x-test-role', 'seller');

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid product id');
  });

  it('should return 404 when product does not exist', async () => {
    productModel.findOne.mockResolvedValue(null);

    const response = await request(app)
      .delete(`/api/products/${validProductId}`)
      .set('x-test-user-id', 'seller_1')
      .set('x-test-role', 'seller');

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Product not found');
  });

  it('should return 403 when seller tries to delete another seller product', async () => {
    productModel.findOne.mockResolvedValue({
      _id: validProductId,
      seller: { toString: () => 'seller_2' },
    });

    const response = await request(app)
      .delete(`/api/products/${validProductId}`)
      .set('x-test-user-id', 'seller_1')
      .set('x-test-role', 'seller');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Forbidden: You can only delete your own product');
  });

  it('should return 500 when delete operation fails', async () => {
    productModel.findOne.mockRejectedValue(new Error('DB error'));

    const response = await request(app)
      .delete(`/api/products/${validProductId}`)
      .set('x-test-user-id', 'seller_1')
      .set('x-test-role', 'seller');

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Failed to delete product');
    expect(response.body.error).toBe('DB error');
  });
});
