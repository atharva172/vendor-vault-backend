const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({ 
    title:{
        type: String,
        required: true,
    },
    description:{
        type: String,
        required: true,
    },
    price:{
       amount: {
            type: Number,
            required: true,
       },
         currency: {
            type: String,
            enum: ['USA', 'INR'],
            default: 'INR'
       }
         },
         seller:{
            type: mongoose.Schema.Types.ObjectId,
            required: true,
         },
         images:[
             {
                url: String,
                thumbnail: String,
                id: String,
             }
            ],
            stock:{
                type: Number,
                required: true,
            }
})

productSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);;