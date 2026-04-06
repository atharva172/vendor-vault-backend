const { tool } = require('@langchain/core/tools');
const {z} = require('zod');
const axios = require('axios');

const searchProduct = tool(async ({query, token}) => {
    const response = await axios.get(`http://localhost:3001/api/products?q=${query}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return JSON.stringify(response.data);
},{
    name: 'searchProduct',
    description: 'Search for products in the e-commerce store. Use this tool to find products based on a search query.',
    schema: z.object({
        query: z.string().describe('The search query for finding products.')
    }).passthrough()
});

const addProductToCart = tool(async ({productId, token, qty}) => {
    const response = await axios.post(`http://localhost:3002/api/cart/items`, {
        productId,
        qty
    }, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return JSON.stringify(response.data);
},{
    name: 'addProductToCart',
    description: 'Add a product to the shopping cart. Use this tool to add items to the cart with a specified quantity.',
    schema: z.object({
        productId: z.string().describe('The ID of the product to add to the cart.'),
        qty: z.number().describe('The quantity of the product to add.')
    }).passthrough()
});

module.exports = {
    searchProduct,
    addProductToCart
};
