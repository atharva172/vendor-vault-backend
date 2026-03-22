const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const User = require('../src/models/user.model');

describe('Address APIs', () => {
    beforeAll(() => {
        process.env.JWT_SECRET = 'test-jwt-secret';
    });

    beforeEach(async () => {
        await User.deleteMany({});
    });

    async function createUser(overrides = {}) {
        return User.create({
            username: 'john123',
            email: 'john@example.com',
            password: 'hashed:MyStrongPass@123',
            fullName: {
                firstName: 'John',
                lastName: 'Doe'
            },
            addresses: [],
            ...overrides
        });
    }

    function createTokenCookie(user) {
        const token = jwt.sign(
            {
                userId: user._id.toString(),
                username: user.username,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        return `token=${token}`;
    }

    describe('GET /api/auth/users/me/addresses', () => {
        it('lists saved addresses and marks one address as default', async () => {
            const user = await createUser({
                addresses: [
                    {
                        street: '12 MG Road',
                        city: 'Bengaluru',
                        state: 'Karnataka',
                        pincode: '560001',
                        country: 'India',
                        isDefault: false
                    },
                    {
                        street: '45 Park Street',
                        city: 'Kolkata',
                        state: 'West Bengal',
                        pincode: '700016',
                        country: 'India',
                        isDefault: true
                    }
                ]
            });

            const response = await request(app)
                .get('/api/auth/users/me/addresses')
                .set('Cookie', [createTokenCookie(user)]);

            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body.addresses)).toBe(true);
            expect(response.body.addresses.length).toBe(2);

            const defaultAddresses = response.body.addresses.filter((address) => address.isDefault === true);
            expect(defaultAddresses.length).toBe(1);
        });

        it('returns 401 when token cookie is missing', async () => {
            const response = await request(app).get('/api/auth/users/me/addresses');

            expect(response.statusCode).toBe(401);
            expect(response.body.message).toMatch(/access denied|unauthorized|token/i);
        });
    });

    describe('POST /api/auth/users/me/addresses', () => {
        it('adds a new address with a valid pincode', async () => {
            const user = await createUser();

            const payload = {
                street: '221B Baker Street',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001',
                country: 'India',
                isDefault: true
            };

            const response = await request(app)
                .post('/api/auth/users/me/addresses')
                .set('Cookie', [createTokenCookie(user)])
                .send(payload);

            expect(response.statusCode).toBe(201);
            expect(response.body.message).toMatch(/address added|created/i);
            expect(response.body.address).toBeTruthy();

            const savedUser = await User.findById(user._id).lean();
            expect(savedUser.addresses.length).toBe(1);
            expect(savedUser.addresses[0].pincode).toBe(payload.pincode);
        });

        it('returns 400 for invalid pincode', async () => {
            const user = await createUser();

            const payload = {
                street: '221B Baker Street',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '40A001',
                country: 'India',
                isDefault: true
            };

            const response = await request(app)
                .post('/api/auth/users/me/addresses')
                .set('Cookie', [createTokenCookie(user)])
                .send(payload);

            expect(response.statusCode).toBe(400);

            const errorText = JSON.stringify(response.body);
            expect(errorText).toMatch(/pincode|zip|invalid/i);
        });
    });

    describe('DELETE /api/auth/users/me/addresses/:addressID', () => {
        it('removes an address by addressID', async () => {
            const user = await createUser({
                addresses: [
                    {
                        street: '10 Residency Road',
                        city: 'Chennai',
                        state: 'Tamil Nadu',
                        pincode: '600001',
                        country: 'India',
                        default: false
                    }
                ]
            });

            const addressID = user.addresses[0]._id.toString();

            const response = await request(app)
                .delete(`/api/auth/users/me/addresses/${addressID}`)
                .set('Cookie', [createTokenCookie(user)]);

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toMatch(/removed|deleted/i);

            const savedUser = await User.findById(user._id).lean();
            expect(savedUser.addresses.length).toBe(0);
        });

        it('returns 404 when addressID does not exist', async () => {
            const user = await createUser();
            const missingAddressID = '507f191e810c19729de860ea';

            const response = await request(app)
                .delete(`/api/auth/users/me/addresses/${missingAddressID}`)
                .set('Cookie', [createTokenCookie(user)]);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toMatch(/not found|address/i);
        });
    });
});
