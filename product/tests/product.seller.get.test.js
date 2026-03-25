const request = require('supertest');

jest.mock('../src/models/product.model', () => ({
  find: jest.fn(),
}));

jest.mock('../src/services/imagekit.service', () => ({
  uploadImage: jest.fn(),
}));

jest.mock('../src/middleware/auth.middleware', () => ({
  createAuthMiddleware: () => (req, res, next) => {
    if (req.headers['x-test-no-user'] === 'true') {
      req.user = undefined;
      return next();
    }

    req.user = {
      id: req.headers['x-test-user-id'] || '64f0a1c2d3e4f5a6b7c8d9e0',
      role: (req.headers['x-test-role'] || 'seller').toLowerCase(),
    };
    next();
  },
}));

const app = require('../src/app');
const productModel = require('../src/models/product.model');

describe('GET /api/products/seller (SELLER)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return products of authenticated seller', async () => {
    const sellerId = '64f0a1c2d3e4f5a6b7c8d9e0';
    const sellerProducts = [
      {
        _id: 'product_1',
        title: 'Keyboard',
        seller: sellerId,
        price: { amount: 1999, currency: 'INR' },
      },
      {
        _id: 'product_2',
        title: 'Mouse',
        seller: sellerId,
        price: { amount: 999, currency: 'INR' },
      },
    ];

    const limit = jest.fn().mockResolvedValue(sellerProducts);
    const skip = jest.fn().mockReturnValue({ limit });
    productModel.find.mockReturnValue({ skip });

    const response = await request(app)
      .get('/api/products/seller')
      .set('x-test-user-id', sellerId)
      .set('x-test-role', 'seller');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Seller products fetched successfully');
    expect(response.body.products).toEqual(sellerProducts);
    expect(productModel.find).toHaveBeenCalledWith({ seller: sellerId });
    expect(skip).toHaveBeenCalledWith(0);
    expect(limit).toHaveBeenCalledWith(20);
  });

  it('should return an empty array when seller has no products', async () => {
    const sellerId = '64f0a1c2d3e4f5a6b7c8d9e0';
    const limit = jest.fn().mockResolvedValue([]);
    const skip = jest.fn().mockReturnValue({ limit });
    productModel.find.mockReturnValue({ skip });

    const response = await request(app)
      .get('/api/products/seller')
      .set('x-test-user-id', sellerId)
      .set('x-test-role', 'seller');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Seller products fetched successfully');
    expect(response.body.products).toEqual([]);
    expect(productModel.find).toHaveBeenCalledWith({ seller: sellerId });
    expect(skip).toHaveBeenCalledWith(0);
    expect(limit).toHaveBeenCalledWith(20);
  });

  it('should return 401 when seller id is missing', async () => {
    const response = await request(app)
      .get('/api/products/seller')
      .set('x-test-no-user', 'true')
      .set('x-test-role', 'seller');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication required');
    expect(response.body.error).toBe('Seller id missing in token payload');
    expect(productModel.find).not.toHaveBeenCalled();
  });

  it('should return 500 when fetching seller products fails', async () => {
    const sellerId = '64f0a1c2d3e4f5a6b7c8d9e0';
    const limit = jest.fn().mockRejectedValue(new Error('DB error'));
    const skip = jest.fn().mockReturnValue({ limit });
    productModel.find.mockReturnValue({ skip });

    const response = await request(app)
      .get('/api/products/seller')
      .set('x-test-user-id', sellerId)
      .set('x-test-role', 'seller');

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Failed to fetch seller products');
    expect(response.body.error).toBe('DB error');
    expect(productModel.find).toHaveBeenCalledWith({ seller: sellerId });
    expect(skip).toHaveBeenCalledWith(0);
    expect(limit).toHaveBeenCalledWith(20);
  });
});
