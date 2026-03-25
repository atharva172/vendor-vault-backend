const request = require('supertest');
const app = require('../src/app');

jest.mock('../src/models/product.model', () => ({
  create: jest.fn(),
}));

jest.mock('../src/services/imagekit.service', () => ({
  uploadImage: jest.fn(),
}));

jest.mock('../src/middleware/auth.middleware', () => ({
  createAuthMiddleware: () => (req, res, next) => {
    req.user = { id: '64f0a1c2d3e4f5a6b7c8d9e0', role: 'seller' };
    next();
  },
}));

const productModel = require('../src/models/product.model');
const { uploadImage } = require('../src/services/imagekit.service');

describe('POST /api/products', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a product with uploaded images', async () => {
    uploadImage
      .mockResolvedValueOnce({
        id: 'img_1',
        url: 'https://imgkit.io/p1.jpg',
        thumbnail: 'https://imgkit.io/p1-thumb.jpg',
      })
      .mockResolvedValueOnce({
        id: 'img_2',
        url: 'https://imgkit.io/p2.jpg',
        thumbnail: 'https://imgkit.io/p2-thumb.jpg',
      });

    productModel.create.mockResolvedValue({
      _id: 'product_id_1',
      title: 'Keyboard',
      description: 'Mechanical keyboard',
      price: { amount: 1999, currency: 'INR' },
      seller: '64f0a1c2d3e4f5a6b7c8d9e0',
      images: [
        {
          id: 'img_1',
          url: 'https://imgkit.io/p1.jpg',
          thumbnail: 'https://imgkit.io/p1-thumb.jpg',
        },
        {
          id: 'img_2',
          url: 'https://imgkit.io/p2.jpg',
          thumbnail: 'https://imgkit.io/p2-thumb.jpg',
        },
      ],
    });

    const response = await request(app)
      .post('/api/products')
      .field('title', 'Keyboard')
      .field('description', 'Mechanical keyboard')
      .field('amount', '1999')
      .field('currency', 'INR')
      .field('seller', '64f0a1c2d3e4f5a6b7c8d9e0')
      .attach('images', 'tests/fixtures/test-image.txt')
      .attach('images', 'tests/fixtures/test-image.txt');

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Product created successfully');
    expect(uploadImage).toHaveBeenCalledTimes(2);
    expect(productModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Keyboard',
        description: 'Mechanical keyboard',
        seller: '64f0a1c2d3e4f5a6b7c8d9e0',
        price: {
          amount: 1999,
          currency: 'INR',
        },
        images: [
          {
            id: 'img_1',
            url: 'https://imgkit.io/p1.jpg',
            thumbnail: 'https://imgkit.io/p1-thumb.jpg',
          },
          {
            id: 'img_2',
            url: 'https://imgkit.io/p2.jpg',
            thumbnail: 'https://imgkit.io/p2-thumb.jpg',
          },
        ],
      })
    );
  });

  it('should return 400 when required fields are missing', async () => {
    const response = await request(app)
      .post('/api/products')
      .field('title', 'Keyboard');

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: 'description is required' }),
        expect.objectContaining({ msg: 'amount is required' }),
      ])
    );
    expect(productModel.create).not.toHaveBeenCalled();
  });

  it('should return 500 when image upload fails', async () => {
    uploadImage.mockRejectedValue(new Error('ImageKit upload failed'));

    const response = await request(app)
      .post('/api/products')
      .field('title', 'Keyboard')
      .field('description', 'Mechanical keyboard')
      .field('amount', '1999')
      .field('currency', 'INR')
      .field('seller', '64f0a1c2d3e4f5a6b7c8d9e0')
      .attach('images', 'tests/fixtures/test-image.txt');

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Failed to create product');
    expect(response.body.error).toBe('ImageKit upload failed');
    expect(productModel.create).not.toHaveBeenCalled();
  });
});
