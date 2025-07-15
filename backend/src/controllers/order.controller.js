import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { Product } from "../models/product.model.js";

// Generate unique order number
const generateOrderNumber = () => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `ORD-${timestamp}-${random}`;
};

const createOrder = asyncHandler(async (req, res) => {
    const { shippingAddress } = req.body;
    const userId = req.user._id;

    if (!shippingAddress) {
        throw new ApiError(400, "Shipping address is required");
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
        throw new ApiError(400, "Cart is empty");
    }

    // Validate stock availability for all items
    for (const item of cart.items) {
        const product = await Product.findById(item.product._id);
        if (!product) {
            throw new ApiError(404, `Product ${item.product.Productname} not found`);
        }
        if (product.status === "out_of_stock" || product.stock < item.quantity) {
            throw new ApiError(400, `Insufficient stock for ${product.Productname}`);
        }
    }

    // Generate unique order number
    let orderNumber;
    let isUnique = false;
    while (!isUnique) {
        orderNumber = generateOrderNumber();
        const existingOrder = await Order.findOne({ orderNumber });
        if (!existingOrder) {
            isUnique = true;
        }
    }

    // Create order
    const order = await Order.create({
        user: userId,
        orderNumber,
        totalAmount: cart.totalAmount,
        orderStatus: "pending",
        shippingAddress: userId, // Using userId as per your model structure
        item: cart._id // Using cart reference as per your model structure
    });

    // Update product stock
    for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.product._id, {
            $inc: { stock: -item.quantity }
        });
    }

    // Populate order details
    const populatedOrder = await Order.findById(order._id)
        .populate("user", "username email")
        .populate({
            path: "item",
            populate: {
                path: "items.product",
                select: "Productname images price"
            }
        });

    return res.status(201).json(new ApiResponse(201, populatedOrder, "Order created successfully"));
});

const getUserOrders = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const skip = (page - 1) * limit;

    // Build query
    const query = { user: userId };
    if (status && ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"].includes(status)) {
        query.orderStatus = status;
    }

    const orders = await Order.find(query)
        .populate("user", "username email")
        .populate({
            path: "item",
            populate: {
                path: "items.product",
                select: "Productname images price"
            }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    const orderData = {
        orders,
        pagination: {
            currentPage: page,
            totalPages,
            totalOrders,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };

    return res.status(200).json(new ApiResponse(200, orderData, "Orders retrieved successfully"));
});

const getOrderById = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findById(orderId)
        .populate("user", "username email")
        .populate({
            path: "item",
            populate: {
                path: "items.product",
                select: "Productname images price description"
            }
        });

    if (!order) {
        throw new ApiError(404, "Order not found");
    }

    // Check if order belongs to user
    if (order.user._id.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only view your own orders");
    }

    return res.status(200).json(new ApiResponse(200, order, "Order retrieved successfully"));
});

const updateOrderStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;
    const userId = req.user._id;

    if (!status) {
        throw new ApiError(400, "Order status is required");
    }

    if (!["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"].includes(status)) {
        throw new ApiError(400, "Invalid order status");
    }

    const order = await Order.findById(orderId);
    if (!order) {
        throw new ApiError(404, "Order not found");
    }

    // Check if order belongs to user (for user updates like cancellation)
    if (order.user.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only update your own orders");
    }

    // Only allow certain status updates by users
    const allowedUserUpdates = ["cancelled"];
    if (!allowedUserUpdates.includes(status)) {
        throw new ApiError(403, "You can only cancel your orders");
    }

    // Don't allow cancellation of shipped/delivered orders
    if (status === "cancelled" && ["shipped", "delivered"].includes(order.orderStatus)) {
        throw new ApiError(400, "Cannot cancel shipped or delivered orders");
    }

    // If cancelling, restore product stock
    if (status === "cancelled") {
        const cart = await Cart.findById(order.item).populate("items.product");
        if (cart) {
            for (const item of cart.items) {
                await Product.findByIdAndUpdate(item.product._id, {
                    $inc: { stock: item.quantity }
                });
            }
        }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { orderStatus: status },
        { new: true }
    ).populate("user", "username email")
     .populate({
        path: "item",
        populate: {
            path: "items.product",
            select: "Productname images price"
        }
    });

    return res.status(200).json(new ApiResponse(200, updatedOrder, "Order status updated successfully"));
});

const getOrderStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const stats = await Order.aggregate([
        { $match: { user: userId } },
        {
            $group: {
                _id: "$orderStatus",
                count: { $sum: 1 },
                totalAmount: { $sum: "$totalAmount" }
            }
        }
    ]);

    const totalOrders = await Order.countDocuments({ user: userId });
    const totalAmountSpent = await Order.aggregate([
        { $match: { user: userId, orderStatus: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    const orderStats = {
        totalOrders,
        totalAmountSpent: totalAmountSpent.length > 0 ? totalAmountSpent[0].total : 0,
        ordersByStatus: {
            pending: 0,
            confirmed: 0,
            shipped: 0,
            delivered: 0,
            cancelled: 0,
            returned: 0
        }
    };

    stats.forEach(stat => {
        orderStats.ordersByStatus[stat._id] = stat.count;
    });

    return res.status(200).json(new ApiResponse(200, orderStats, "Order statistics retrieved successfully"));
});

const getOrderByNumber = asyncHandler(async (req, res) => {
    const { orderNumber } = req.params;
    const userId = req.user._id;

    const order = await Order.findOne({ orderNumber })
        .populate("user", "username email")
        .populate({
            path: "item",
            populate: {
                path: "items.product",
                select: "Productname images price description"
            }
        });

    if (!order) {
        throw new ApiError(404, "Order not found");
    }

    // Check if order belongs to user
    if (order.user._id.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only view your own orders");
    }

    return res.status(200).json(new ApiResponse(200, order, "Order retrieved successfully"));
});

const reorderItems = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findById(orderId).populate({
        path: "item",
        populate: {
            path: "items.product"
        }
    });

    if (!order) {
        throw new ApiError(404, "Order not found");
    }

    // Check if order belongs to user
    if (order.user.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only reorder your own orders");
    }

    // Get or create user's cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
        cart = await Cart.create({ user: userId, items: [], totalAmount: 0 });
    }

    // Add order items to cart
    for (const item of order.item.items) {
        const product = await Product.findById(item.product._id);
        if (product && product.status === "In_Stock" && product.stock >= item.quantity) {
            const existingItemIndex = cart.items.findIndex(
                cartItem => cartItem.product.toString() === item.product._id.toString()
            );

            const currentPrice = product.price.sale || product.price.regular;

            if (existingItemIndex > -1) {
                cart.items[existingItemIndex].quantity += item.quantity;
                cart.items[existingItemIndex].price = currentPrice;
            } else {
                cart.items.push({
                    product: item.product._id,
                    quantity: item.quantity,
                    price: currentPrice
                });
            }
        }
    }

    // Recalculate total
    cart.totalAmount = cart.items.reduce((total, item) => {
        return total + (item.quantity * item.price);
    }, 0);

    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate("items.product");

    return res.status(200).json(new ApiResponse(200, populatedCart, "Items added to cart successfully"));
});

export { 
    createOrder, 
    getUserOrders, 
    getOrderById, 
    updateOrderStatus, 
    getOrderStats, 
    getOrderByNumber, 
    reorderItems 
};