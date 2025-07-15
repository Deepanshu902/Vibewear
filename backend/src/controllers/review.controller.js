import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Review } from "../models/review.model.js";
import { Product } from "../models/product.model.js";

const addReview = asyncHandler(async (req, res) => {
    const { productId, rating, title, comment } = req.body;
    const userId = req.user._id;

    if (!productId || !rating) {
        throw new ApiError(400, "Product ID and rating are required");
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ user: userId, product: productId });
    if (existingReview) {
        throw new ApiError(400, "You have already reviewed this product");
    }

    // Create new review
    const review = await Review.create({
        user: userId,
        product: productId,
        rating,
        title,
        comment
    });

    // Update product rating
    await updateProductRating(productId);

    // Add review to product's reviews array
    await Product.findByIdAndUpdate(productId, {
        $push: { reviews: review._id }
    });

    const populatedReview = await Review.findById(review._id).populate("user", "username email");

    return res.status(201).json(new ApiResponse(201, populatedReview, "Review added successfully"));
});

const updateReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { rating, title, comment } = req.body;
    const userId = req.user._id;

    if (!rating) {
        throw new ApiError(400, "Rating is required");
    }

    const review = await Review.findById(reviewId);
    if (!review) {
        throw new ApiError(404, "Review not found");
    }

    // Check if user owns this review
    if (review.user.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only update your own reviews");
    }

    // Update review
    const updatedReview = await Review.findByIdAndUpdate(
        reviewId,
        { rating, title, comment },
        { new: true, runValidators: true }
    ).populate("user", "username email");

    // Update product rating
    await updateProductRating(review.product);

    return res.status(200).json(new ApiResponse(200, updatedReview, "Review updated successfully"));
});

const deleteReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findById(reviewId);
    if (!review) {
        throw new ApiError(404, "Review not found");
    }

    // Check if user owns this review
    if (review.user.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only delete your own reviews");
    }

    const productId = review.product;

    // Delete review
    await Review.findByIdAndDelete(reviewId);

    // Remove review from product's reviews array
    await Product.findByIdAndUpdate(productId, {
        $pull: { reviews: reviewId }
    });

    // Update product rating
    await updateProductRating(productId);

    return res.status(200).json(new ApiResponse(200, {}, "Review deleted successfully"));
});

const getProductReviews = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    const reviews = await Review.find({ product: productId })
        .populate("user", "username email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const totalReviews = await Review.countDocuments({ product: productId });
    const totalPages = Math.ceil(totalReviews / limit);

    const reviewsData = {
        reviews,
        pagination: {
            currentPage: page,
            totalPages,
            totalReviews,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };

    return res.status(200).json(new ApiResponse(200, reviewsData, "Product reviews retrieved successfully"));
});

const getUserReviews = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ user: userId })
        .populate("product", "Productname images")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const totalReviews = await Review.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalReviews / limit);

    const reviewsData = {
        reviews,
        pagination: {
            currentPage: page,
            totalPages,
            totalReviews,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };

    return res.status(200).json(new ApiResponse(200, reviewsData, "User reviews retrieved successfully"));
});

const getReviewById = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId)
        .populate("user", "username email")
        .populate("product", "Productname images");

    if (!review) {
        throw new ApiError(404, "Review not found");
    }

    return res.status(200).json(new ApiResponse(200, review, "Review retrieved successfully"));
});

const getReviewStats = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    const stats = await Review.aggregate([
        { $match: { product: product._id } },
        {
            $group: {
                _id: "$rating",
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: -1 } }
    ]);

    const totalReviews = await Review.countDocuments({ product: productId });
    const averageRating = product.rating || 0;

    // Create rating distribution
    const ratingDistribution = {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0
    };

    stats.forEach(stat => {
        ratingDistribution[stat._id] = stat.count;
    });

    const reviewStats = {
        totalReviews,
        averageRating: parseFloat(averageRating.toFixed(1)),
        ratingDistribution
    };

    return res.status(200).json(new ApiResponse(200, reviewStats, "Review statistics retrieved successfully"));
});

// Helper function to update product rating
const updateProductRating = async (productId) => {
    const result = await Review.aggregate([
        { $match: { product: productId } },
        {
            $group: {
                _id: null,
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 }
            }
        }
    ]);

    const averageRating = result.length > 0 ? result[0].averageRating : 0;

    await Product.findByIdAndUpdate(productId, {
        rating: parseFloat(averageRating.toFixed(1))
    });
};

export { 
    addReview, 
    updateReview, 
    deleteReview, 
    getProductReviews, 
    getUserReviews, 
    getReviewById, 
    getReviewStats 
};