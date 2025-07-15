import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Payment } from "../models/payment.model.js";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";

const createPayment = asyncHandler(async (req, res) => {
    const { orderId, amount, paymentMethod, transactionId } = req.body;
    const userId = req.user._id;

    if (!orderId || !amount || !paymentMethod) {
        throw new ApiError(400, "Order ID, amount, and payment method are required");
    }

    // Check if order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) {
        throw new ApiError(404, "Order not found");
    }

    // Verify order belongs to the user (assuming Order model has user field)
    if (order.user.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only make payments for your own orders");
    }

    // Check if payment already exists for this order
    const existingPayment = await Payment.findOne({ orderId });
    if (existingPayment) {
        throw new ApiError(400, "Payment already exists for this order");
    }

    // Validate amount matches order total
    if (amount !== order.totalAmount) {
        throw new ApiError(400, "Payment amount does not match order total");
    }

    // Create payment record
    const payment = await Payment.create({
        orderId,
        amount,
        paymentMethod,
        transactionId,
        status: 'pending'
    });

    // Populate order details
    const populatedPayment = await Payment.findById(payment._id).populate({
        path: 'orderId',
        populate: {
            path: 'items.product',
            select: 'Productname images price'
        }
    });

    return res.status(201).json(new ApiResponse(201, populatedPayment, "Payment created successfully"));
});

const updatePaymentStatus = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const { status, transactionId } = req.body;

    if (!status) {
        throw new ApiError(400, "Payment status is required");
    }

    if (!['success', 'failed', 'pending'].includes(status)) {
        throw new ApiError(400, "Invalid payment status");
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
        throw new ApiError(404, "Payment not found");
    }

    // Update payment status
    const updatedPayment = await Payment.findByIdAndUpdate(
        paymentId,
        { 
            status,
            ...(transactionId && { transactionId }),
            ...(status === 'success' && { paymentDate: new Date() })
        },
        { new: true }
    ).populate({
        path: 'orderId',
        populate: {
            path: 'items.product',
            select: 'Productname images price'
        }
    });

    // Update order status based on payment status
    if (status === 'success') {
        await Order.findByIdAndUpdate(payment.orderId, {
            status: 'confirmed',
            paymentStatus: 'paid'
        });

        // Clear user's cart after successful payment
        const order = await Order.findById(payment.orderId);
        if (order && order.user) {
            await Cart.findOneAndDelete({ user: order.user });
        }
    } else if (status === 'failed') {
        await Order.findByIdAndUpdate(payment.orderId, {
            status: 'cancelled',
            paymentStatus: 'failed'
        });
    }

    return res.status(200).json(new ApiResponse(200, updatedPayment, "Payment status updated successfully"));
});

const getPaymentById = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const userId = req.user._id;

    const payment = await Payment.findById(paymentId).populate({
        path: 'orderId',
        populate: {
            path: 'items.product',
            select: 'Productname images price'
        }
    });

    if (!payment) {
        throw new ApiError(404, "Payment not found");
    }

    // Check if payment belongs to user
    const order = await Order.findById(payment.orderId);
    if (order.user.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only view your own payments");
    }

    return res.status(200).json(new ApiResponse(200, payment, "Payment retrieved successfully"));
});

const getPaymentsByOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user._id;

    // Check if order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) {
        throw new ApiError(404, "Order not found");
    }

    if (order.user.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only view payments for your own orders");
    }

    const payments = await Payment.find({ orderId }).populate({
        path: 'orderId',
        populate: {
            path: 'items.product',
            select: 'Productname images price'
        }
    }).sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, payments, "Order payments retrieved successfully"));
});

const getUserPayments = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status; // Optional filter by status
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (status && ['success', 'failed', 'pending'].includes(status)) {
        query.status = status;
    }

    // Get user's orders first
    const userOrders = await Order.find({ user: userId }).select('_id');
    const orderIds = userOrders.map(order => order._id);

    // Find payments for user's orders
    const payments = await Payment.find({ 
        orderId: { $in: orderIds },
        ...query 
    })
    .populate({
        path: 'orderId',
        populate: {
            path: 'items.product',
            select: 'Productname images price'
        }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const totalPayments = await Payment.countDocuments({ 
        orderId: { $in: orderIds },
        ...query 
    });
    const totalPages = Math.ceil(totalPayments / limit);

    const paymentData = {
        payments,
        pagination: {
            currentPage: page,
            totalPages,
            totalPayments,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };

    return res.status(200).json(new ApiResponse(200, paymentData, "User payments retrieved successfully"));
});

const getPaymentStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Get user's orders
    const userOrders = await Order.find({ user: userId }).select('_id');
    const orderIds = userOrders.map(order => order._id);

    // Calculate payment statistics
    const stats = await Payment.aggregate([
        { $match: { orderId: { $in: orderIds } } },
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
                totalAmount: { $sum: "$amount" }
            }
        }
    ]);

    const totalPayments = await Payment.countDocuments({ orderId: { $in: orderIds } });
    const totalAmountSpent = await Payment.aggregate([
        { $match: { orderId: { $in: orderIds }, status: 'success' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const paymentStats = {
        totalPayments,
        totalAmountSpent: totalAmountSpent.length > 0 ? totalAmountSpent[0].total : 0,
        paymentsByStatus: {
            success: 0,
            failed: 0,
            pending: 0
        }
    };

    stats.forEach(stat => {
        paymentStats.paymentsByStatus[stat._id] = stat.count;
    });

    return res.status(200).json(new ApiResponse(200, paymentStats, "Payment statistics retrieved successfully"));
});

const processRefund = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const { refundAmount, reason } = req.body;
    const userId = req.user._id;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
        throw new ApiError(404, "Payment not found");
    }

    // Check if payment belongs to user
    const order = await Order.findById(payment.orderId);
    if (order.user.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only request refunds for your own payments");
    }

    // Check if payment is successful
    if (payment.status !== 'success') {
        throw new ApiError(400, "Can only refund successful payments");
    }

    // Validate refund amount
    if (refundAmount > payment.amount) {
        throw new ApiError(400, "Refund amount cannot exceed payment amount");
    }

    // Create refund record (you might want to create a separate Refund model)
    const refundData = {
        originalPaymentId: paymentId,
        refundAmount: refundAmount || payment.amount,
        reason,
        status: 'pending',
        requestedAt: new Date()
    };

    // Update order status to refund requested
    await Order.findByIdAndUpdate(payment.orderId, {
        status: 'refund_requested'
    });

    // Here you would typically integrate with your payment gateway to process the refund
    // For now, we'll just return the refund request details

    return res.status(200).json(new ApiResponse(200, refundData, "Refund request submitted successfully"));
});

const verifyPayment = asyncHandler(async (req, res) => {
    const { paymentId, transactionId } = req.body;

    if (!paymentId || !transactionId) {
        throw new ApiError(400, "Payment ID and transaction ID are required");
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
        throw new ApiError(404, "Payment not found");
    }

    // Here you would typically verify the payment with your payment gateway
    // For now, we'll simulate verification
    const isVerified = payment.transactionId === transactionId;

    if (isVerified) {
        const updatedPayment = await Payment.findByIdAndUpdate(
            paymentId,
            { status: 'success', paymentDate: new Date() },
            { new: true }
        ).populate('orderId');

        // Update order status
        await Order.findByIdAndUpdate(payment.orderId, {
            status: 'confirmed',
            paymentStatus: 'paid'
        });

        return res.status(200).json(new ApiResponse(200, updatedPayment, "Payment verified successfully"));
    } else {
        return res.status(400).json(new ApiResponse(400, null, "Payment verification failed"));
    }
});

export { 
    createPayment, 
    updatePaymentStatus, 
    getPaymentById, 
    getPaymentsByOrder, 
    getUserPayments, 
    getPaymentStats, 
    processRefund, 
    verifyPayment 
};