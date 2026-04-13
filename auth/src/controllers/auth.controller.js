const userModel = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const redisClient = require('../db/redis');
const { publishToQueue } = require('../broker/broker');


async function register(req, res){
    const { username, email, password, fullName: { firstName, lastName }, role } = req.body;
     
    const isExistingUser = await userModel.findOne({
        $or: [
            { email },
            { username }
        ]
    })
    if(isExistingUser){
        return res.status(409).json({ message: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await userModel.create({
        username,
        email,
        password: hashedPassword,
        fullName: {
            firstName,
            lastName
        },
        role: role || 'user'
    });

    // Publish user registration event to RabbitMQ
    await Promise.all([
        publishToQueue('AUTH_NOTIFICATION.USER_CREATED', {
            userId: newUser._id,
            username: newUser.username,
            email: newUser.email,
            fullName: newUser.fullName,
            registeredAt: new Date()
        }),
        publishToQueue('AUTH_SELLER-DASHBOARD.USER_CREATED', newUser)
    ]);

    const token = jwt.sign({ 
        userId: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
     }, process.env.JWT_SECRET, { expiresIn: '1d' });
    
    res.cookie('token', token, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
     });
    res.status(201).json({
        message: 'User registered successfully',
        user: {
            id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            fullName: newUser.fullName,
            role: newUser.role,
            addresses: newUser.addresses
        }
    })
    
}

async function login(req, res){
    try{
        const { username, email, password } = req.body;
        const user = await userModel.findOne({
            $or: [
                { email },
                { username }
            ]
        }).select('+password');
        if(!user){
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        const token = jwt.sign({ 
            userId: user._id,
            username: user.username,
            email: user.email,
            role: user.role
         }, process.env.JWT_SECRET, { expiresIn: '1d' });


        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 1 day
         });


        res.status(200).json({
            message: 'Login successful',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                addresses: user.addresses
            }
        })

    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });

    }
}

async function getProfile(req, res){
    return res.status(200).json({
        message: 'User profile retrieved successfully',
        user: req.user
    })
}

async function logout(req, res) {
   const token = req.cookies.token;
   if (token) {
       await redisClient.set(`blacklist:${token}`, 'true', 'EX', 24 * 60 * 60); // Blacklist token for 1 day
   }
    res.clearCookie('token',{
        httpOnly: true,
        secure: true,
    });
    return res.status(200).json({ message: 'Logged out successfully' });

}

async function getAddresses(req, res) {
    const id = req.user.userId;

    const user = await userModel.findById(id).select('addresses');

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({
        message: 'Addresses retrieved successfully',
        addresses: user.addresses
    });

}

async function addAddress(req, res) {
    const id = req.user.userId;
    const { street, city, state, pincode, country, isDefault } = req.body;

    const user = await userModel.findOneAndUpdate(
        { _id: id },
        { $push: { addresses: { street, city, state, pincode, country, isDefault } } },
        { returnDocument: 'after' }
    ).select('addresses');

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    return res.status(201).json({
        message: 'Address added successfully',
        address: user.addresses[user.addresses.length - 1]
    });

}

async function deleteAddress(req, res) {
    const id = req.user.userId;
    const { addressID } = req.params;

    const isAddressExists = await userModel.findOne({ _id: id, 'addresses._id': addressID }).select('addresses');

    if (!isAddressExists) {
        return res.status(404).json({ message: 'Address not found' });
    }

    const user = await userModel.findOneAndUpdate(
        { _id: id },
        { $pull: { addresses: { _id: addressID } } },
        { returnDocument: 'after' }
    ).select('addresses');

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    const addressExists = user.addresses.some(address => address._id.toString() === addressID);

    if (addressExists) {
        return res.status(404).json({ message: 'Address not found' });
    }

    return res.status(200).json({
        message: 'Address deleted successfully',
        addresses: user.addresses
    });
}

module.exports = {
    register,
    login,
    getProfile,
    logout,
    getAddresses,
    addAddress,
    deleteAddress
}
