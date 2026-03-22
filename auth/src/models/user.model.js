const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    street: String,
    pincode: String,
    city: String,
    state: String,
    country: String,
    isDefault: {
        type: Boolean,
        default: false
    }
});

const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true,
        unique:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        select: false,
    },
    fullName:{
        firstName:{
            type:String,
            required:true
        },
        lastName:{
            type:String,
            required:true
        }
    },
    role:{
        type:String,
        enum:['admin','user'],
        default:'user'
    },
    addresses:[addressSchema]
}, {
    timestamps: true
});

const userModel = mongoose.model('User', userSchema);

module.exports = userModel;