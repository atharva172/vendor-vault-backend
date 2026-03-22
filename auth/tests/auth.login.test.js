const request = require('supertest');

jest.mock('bcrypt', () => ({
    compare: jest.fn(async (plainTextPassword, hashedPassword) => hashedPassword === `hashed:${plainTextPassword}`)
}));

const app = require('../src/app');
const User = require('../src/models/user.model');

describe('POST /api/auth/login', () => {
    beforeAll(() => {
        process.env.JWT_SECRET = 'test-jwt-secret';
    });

    beforeEach(async () => {
        await User.deleteMany({});
    });

    it('logs in an existing user with valid credentials', async () => {
        const password = 'MyStrongPass@123';
        await User.create({
            username: 'john123',
            email: 'john@example.com',
            password: `hashed:${password}`,
            fullName: {
                firstName: 'John',
                lastName: 'Doe'
            }
        });

        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'john@example.com', password });

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toMatch(/login/i);
        expect(response.body.user).toBeTruthy();
        expect(response.body.user.email).toBe('john@example.com');
        expect(response.body.user.password).toBeUndefined();
        expect(response.headers['set-cookie']).toBeDefined();
    });

    it('returns 401 for an unknown email', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'missing@example.com', password: 'MyStrongPass@123'  });

        expect(response.statusCode).toBe(401);
    });

    it('returns 401 when password is incorrect', async () => {
        await User.create({
            username: 'alice1',
            email: 'alice@example.com',
            password: 'hashed:CorrectPass@123',
            fullName: {
                firstName: 'Alice',
                lastName: 'Smith'
            }
        });

        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'alice@example.com', password: 'WrongPass@123' });

        expect(response.statusCode).toBe(401);
    });
});