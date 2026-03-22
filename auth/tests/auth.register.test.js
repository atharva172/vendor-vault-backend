const request = require('supertest');
jest.mock('bcrypt', () => ({
    hash: jest.fn(async (password) => `hashed:${password}`)
}));

const app = require('../src/app');
const User = require('../src/models/user.model');

describe('POST /api/auth/register', () => {
    beforeAll(() => {
        process.env.JWT_SECRET = 'test-jwt-secret';
    });

    beforeEach(async () => {
        await User.deleteMany({});
    });

    it('registers a user and stores hashed password in memory database', async () => {
        const payload = {
            username: 'john123',
            email: 'john@example.com',
            password: 'MyStrongPass@123',
            fullName: {
                firstName: 'John',
                lastName: 'Doe'
            }
        };

        const response = await request(app)
            .post('/api/auth/register')
            .send(payload);

        expect(response.statusCode).toBe(201);
        expect(response.body.message).toBe('User registered successfully');
        expect(response.body.user.email).toBe(payload.email);
        expect(response.body.user.password).toBeUndefined();

        const savedUser = await User.findOne({ email: payload.email }).lean();
        expect(savedUser).toBeTruthy();
        expect(savedUser.password).not.toBe(payload.password);
    });

    it('returns 409 when the same email is used twice', async () => {
        const payload = {
            username: 'alice1',
            email: 'alice@example.com',
            password: 'MyStrongPass@123',
            fullName: {
                firstName: 'Alice',
                lastName: 'Smith'
            }
        };

        await request(app)
            .post('/api/auth/register')
            .send(payload);

        const response = await request(app)
            .post('/api/auth/register')
            .send({ ...payload, username: 'alice2' });

        expect(response.statusCode).toBe(409);
        expect(response.body.message).toBe('User already exists');
    });
});