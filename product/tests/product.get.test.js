const request = require('supertest');

jest.mock('../src/models/product.model', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../src/services/imagekit.service', () => ({
  uploadImage: jest.fn(),
}));

const app = require('../src/app');

const productModel = require('../src/models/product.model');

describe('GET /api/products', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all products', async () => {
    const products = [
      {
        _id: 'product_1',
        title: 'Keyboard',
        description: 'Mechanical keyboard',
        price: { amount: 1999, currency: 'INR' },
      },
      {
        _id: 'product_2',
        title: 'Mouse',
        description: 'Wireless mouse',
        price: { amount: 999, currency: 'INR' },
      },
    ];

    const limit = jest.fn().mockResolvedValue(products);
    const skip = jest.fn().mockReturnValue({ limit });
    productModel.find.mockReturnValue({ skip });

    const response = await request(app).get('/api/products');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Products fetched successfully');
    expect(response.body.products).toEqual(products);
    expect(productModel.find).toHaveBeenCalledWith({});
    expect(skip).toHaveBeenCalledWith(0);
    expect(limit).toHaveBeenCalledWith(20);
  });

  it('should return an empty array when there are no products', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const skip = jest.fn().mockReturnValue({ limit });
    productModel.find.mockReturnValue({ skip });

    const response = await request(app).get('/api/products');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Products fetched successfully');
    expect(response.body.products).toEqual([]);
    expect(productModel.find).toHaveBeenCalledWith({});
    expect(skip).toHaveBeenCalledWith(0);
    expect(limit).toHaveBeenCalledWith(20);
  });

  it('should return 500 when fetching products fails', async () => {
    const limit = jest.fn().mockRejectedValue(new Error('DB error'));
    const skip = jest.fn().mockReturnValue({ limit });
    productModel.find.mockReturnValue({ skip });

    const response = await request(app).get('/api/products');

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Failed to fetch products');
    expect(response.body.error).toBe('DB error');
    expect(productModel.find).toHaveBeenCalledWith({});
    expect(skip).toHaveBeenCalledWith(0);
    expect(limit).toHaveBeenCalledWith(20);
  });
});

describe('GET /api/products/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return product by id', async () => {
    const product = {
      _id: 'product_1',
      title: 'Keyboard',
      description: 'Mechanical keyboard',
      price: { amount: 1999, currency: 'INR' },
    };

    productModel.findById.mockResolvedValue(product);

    const response = await request(app).get('/api/products/product_1');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Product fetched successfully');
    expect(response.body.product).toEqual(product);
    expect(productModel.findById).toHaveBeenCalledWith('product_1');
  });

  it('should return 404 when product is not found', async () => {
    productModel.findById.mockResolvedValue(null);

    const response = await request(app).get('/api/products/product_404');

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Product not found');
    expect(productModel.findById).toHaveBeenCalledWith('product_404');
  });

  it('should return 500 when fetching product by id fails', async () => {
    productModel.findById.mockRejectedValue(new Error('DB error'));

    const response = await request(app).get('/api/products/product_1');

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Failed to fetch product');
    expect(response.body.error).toBe('DB error');
    expect(productModel.findById).toHaveBeenCalledWith('product_1');
  });
});
