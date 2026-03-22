const request = require('supertest');

jest.mock('../src/db/redis', () => ({
    set: jest.fn().mockResolvedValue('OK')
}));

const app = require('../src/app');

describe('GET /api/auth/logout', () => {
    it('clears the auth token cookie and returns success', async () => {
        const response = await request(app)
            .get('/api/auth/logout')
            .set('Cookie', ['token=some-valid-token']);

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toMatch(/logged out/i);
        expect(response.headers['set-cookie']).toBeDefined();
        expect(response.headers['set-cookie'][0]).toContain('token=');
    });
});
