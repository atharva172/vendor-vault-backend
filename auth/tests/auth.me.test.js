const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const User = require('../src/models/user.model');

describe('GET /api/auth/me', () => {
    beforeAll(() => {
        process.env.JWT_SECRET = 'test-jwt-secret';
    });

    beforeEach(async () => {
        await User.deleteMany({});
    });

    async function createUser() {
        return User.create({
            username: 'john123',
            email: 'john@example.com',
            password: 'hashed:MyStrongPass@123',
            fullName: {
                firstName: 'John',
                lastName: 'Doe'
            }
        });
    }

    function createTokenCookie(userId) {
        const token = jwt.sign(
            {
                userId,
                username: 'john123',
                email: 'john@example.com',
                role: 'user'
            },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        return `token=${token}`;
    }

    it('returns authenticated user profile for a valid token cookie', async () => {
        const user = await createUser();
        const cookie = createTokenCookie(user._id.toString());

        const response = await request(app)
            .get('/api/auth/me')
            .set('Cookie', [cookie]);

        expect(response.statusCode).toBe(200);
        expect(response.body.user).toBeTruthy();
        expect(response.body.user.email).toBe('john@example.com');
        expect(response.body.user.password).toBeUndefined();
    });

    it('returns 401 when token cookie is missing', async () => {
        const response = await request(app).get('/api/auth/me');

        expect(response.statusCode).toBe(401);
        expect(response.body.message).toMatch(/unauthorized|token/i);
    });

    it('returns 401 when token is invalid', async () => {
        const response = await request(app)
            .get('/api/auth/me')
            .set('Cookie', ['token=invalid-token']);

        expect(response.statusCode).toBe(401);
        expect(response.body.message).toMatch(/unauthorized|invalid|token/i);
    });

    it('returns 200 when token is valid even if user is not in database', async () => {
        const fakeUserId = '507f1f77bcf86cd799439011';
        const cookie = createTokenCookie(fakeUserId);

        const response = await request(app)
            .get('/api/auth/me')
            .set('Cookie', [cookie]);

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toMatch(/profile/i);
        expect(response.body.user).toBeTruthy();
        expect(response.body.user.userId).toBe(fakeUserId);
    });
});
