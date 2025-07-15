import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Cart } from "../models/cart.model.js";
import { Product } from "../models/product.model.js";

const addToCart = asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.user._id;

    console.log("Product Id :", productId);
    console.log("quantity : ", quantity);

    if (!productId || !quantity) {
        throw new ApiError(400, "Product ID and quantity are required");
    }

    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    // Check if product is in stock
    if (product.status === "out_of_stock" || product.stock < quantity) {
        throw new ApiError(400, "Product is out of stock or insufficient quantity");
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
        cart = await Cart.create({ user: userId, items: [], totalAmount: 0 });
    }

    const itemIndex = cart.items.findIndex((item) => item.product.toString() === productId);

    // Get the current price (use sale price if available, otherwise regular price)
    const currentPrice = product.price.sale || product.price.regular;

    if (itemIndex > -1) {
        // Update existing item quantity
        cart.items[itemIndex].quantity += quantity;
        cart.items[itemIndex].price = currentPrice; // Update price in case it changed
    } else {
        // Add new item to cart
        cart.items.push({ 
            product: productId, 
            quantity, 
            price: currentPrice 
        });
    }

    // Calculate total amount using stored prices
    cart.totalAmount = cart.items.reduce((total, item) => {
        return total + (item.quantity * item.price);
    }, 0);

    await cart.save();

    return res.status(200).json(new ApiResponse(200, cart, "Item added to cart"));
});

const updateCartItemQuantity = asyncHandler(async (req, res) => {
    const { quantity } = req.body;
    const { productId } = req.params;
    const userId = req.user._id;

    if (!quantity || quantity < 1) {
        throw new ApiError(400, "Valid quantity is required");
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
        throw new ApiError(404, "Cart not found");
    }

    const itemIndex = cart.items.findIndex((item) => item.product.toString() === productId);

    if (itemIndex > -1) {
        const product = await Product.findById(productId);
        if (!product) {
            throw new ApiError(404, "Product not found");
        }

        // Check stock availability
        if (product.status === "out_of_stock" || product.stock < quantity) {
            throw new ApiError(400, "Product is out of stock or insufficient quantity");
        }

        cart.items[itemIndex].quantity = quantity;
        
        // Update price in case it changed
        const currentPrice = product.price.sale || product.price.regular;
        cart.items[itemIndex].price = currentPrice;
    } else {
        throw new ApiError(404, "Item not found in cart");
    }

    // Calculate total amount using stored prices
    cart.totalAmount = cart.items.reduce((total, item) => {
        return total + (item.quantity * item.price);
    }, 0);

    await cart.save();

    return res.status(200).json(new ApiResponse(200, cart, "Cart item quantity updated"));
});

const removeFromCart = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
        throw new ApiError(404, "Cart not found");
    }

    cart.items = cart.items.filter((item) => item.product.toString() !== productId);

    // Calculate total amount using stored prices
    cart.totalAmount = cart.items.reduce((total, item) => {
        return total + (item.quantity * item.price);
    }, 0);

    await cart.save();

    return res.status(200).json(new ApiResponse(200, cart, "Item removed from cart"));
});

const getCart = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId }).populate("items.product");

    if (!cart) {
        return res.status(200).json(new ApiResponse(200, { items: [], totalAmount: 0 }, "Cart is empty"));
    }

    return res.status(200).json(new ApiResponse(200, cart, "Cart retrieved successfully"));
});

const clearCart = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    await Cart.findOneAndDelete({ user: userId });

    return res.status(200).json(new ApiResponse(200, {}, "Cart cleared"));
});

export { addToCart, updateCartItemQuantity, removeFromCart, getCart, clearCart };