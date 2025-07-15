import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/product.model.js";
import { Review } from "../models/review.model.js";

const createProduct = asyncHandler(async (req, res) => {
    const {
        Productname,
        description,
        price,
        stock,
        images,
        category
    } = req.body;
    const sellerId = req.user._id;

    if (!Productname || !description || !price || !stock || !images || !category) {
        throw new ApiError(400, "All required fields must be provided");
    }

    if (!description.short || !description.detailed) {
        throw new ApiError(400, "Both short and detailed descriptions are required");
    }

    if (!price.regular || price.regular <= 0) {
        throw new ApiError(400, "Valid regular price is required");
    }

    if (!Array.isArray(images) || images.length === 0) {
        throw new ApiError(400, "At least one product image is required");
    }

    // Validate sale price if provided
    if (price.sale && price.sale >= price.regular) {
        throw new ApiError(400, "Sale price must be less than regular price");
    }

    // Calculate discount if sale price is provided
    let discount = 0;
    if (price.sale) {
        discount = Math.round(((price.regular - price.sale) / price.regular) * 100);
    }

    const product = await Product.create({
        Productname,
        seller: sellerId,
        description,
        price: {
            regular: price.regular,
            sale: price.sale || null,
            discount
        },
        stock,
        images,
        category,
        status: stock > 0 ? "In_Stock" : "out_of_stock"
    });

    const populatedProduct = await Product.findById(product._id).populate("seller", "username email");

    return res.status(201).json(new ApiResponse(201, populatedProduct, "Product created successfully"));
});

const getAllProducts = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const category = req.query.category;
    const search = req.query.search;
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || Infinity;
    const rating = parseFloat(req.query.rating) || 0;
    const status = req.query.status;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (category && ["Fashion", "Pharmacy", "Essential", "Grocery"].includes(category)) {
        query.category = category;
    }

    if (search) {
        query.$or = [
            { Productname: { $regex: search, $options: "i" } },
            { "description.short": { $regex: search, $options: "i" } },
            { "description.detailed": { $regex: search, $options: "i" } }
        ];
    }

    if (status && ["In_Stock", "out_of_stock"].includes(status)) {
        query.status = status;
    }

    // Price range filter
    query.$and = [
        { "price.regular": { $gte: minPrice } },
        { "price.regular": { $lte: maxPrice } }
    ];

    if (rating > 0) {
        query.rating = { $gte: rating };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder;

    const products = await Product.find(query)
        .populate("seller", "username email")
        .populate("reviews")
        .sort(sort)
        .skip(skip)
        .limit(limit);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const productData = {
        products,
        pagination: {
            currentPage: page,
            totalPages,
            totalProducts,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        filters: {
            category,
            search,
            minPrice,
            maxPrice,
            rating,
            status
        }
    };

    return res.status(200).json(new ApiResponse(200, productData, "Products retrieved successfully"));
});

const getProductById = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const product = await Product.findById(productId)
        .populate("seller", "username email")
        .populate({
            path: "reviews",
            populate: {
                path: "user",
                select: "username email"
            }
        });

    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    return res.status(200).json(new ApiResponse(200, product, "Product retrieved successfully"));
});

const updateProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const sellerId = req.user._id;
    const updateData = req.body;

    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    // Check if user is the seller
    if (product.seller.toString() !== sellerId.toString()) {
        throw new ApiError(403, "You can only update your own products");
    }

    // Handle price updates
    if (updateData.price) {
        if (updateData.price.sale && updateData.price.sale >= updateData.price.regular) {
            throw new ApiError(400, "Sale price must be less than regular price");
        }

        // Calculate discount
        let discount = 0;
        if (updateData.price.sale) {
            discount = Math.round(((updateData.price.regular - updateData.price.sale) / updateData.price.regular) * 100);
        }
        updateData.price.discount = discount;
    }

    // Update stock status
    if (updateData.stock !== undefined) {
        updateData.status = updateData.stock > 0 ? "In_Stock" : "out_of_stock";
    }

    const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        updateData,
        { new: true, runValidators: true }
    ).populate("seller", "username email");

    return res.status(200).json(new ApiResponse(200, updatedProduct, "Product updated successfully"));
});

const deleteProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const sellerId = req.user._id;

    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    // Check if user is the seller
    if (product.seller.toString() !== sellerId.toString()) {
        throw new ApiError(403, "You can only delete your own products");
    }

    // Delete associated reviews
    await Review.deleteMany({ product: productId });

    // Delete the product
    await Product.findByIdAndDelete(productId);

    return res.status(200).json(new ApiResponse(200, {}, "Product deleted successfully"));
});

const getSellerProducts = asyncHandler(async (req, res) => {
    const sellerId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const status = req.query.status;
    const skip = (page - 1) * limit;

    const query = { seller: sellerId };
    if (status && ["In_Stock", "out_of_stock"].includes(status)) {
        query.status = status;
    }

    const products = await Product.find(query)
        .populate("reviews")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const productData = {
        products,
        pagination: {
            currentPage: page,
            totalPages,
            totalProducts,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };

    return res.status(200).json(new ApiResponse(200, productData, "Seller products retrieved successfully"));
});

const getProductsByCategory = asyncHandler(async (req, res) => {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    if (!["Fashion", "Pharmacy", "Essential", "Grocery"].includes(category)) {
        throw new ApiError(400, "Invalid category");
    }

    const products = await Product.find({ category, status: "In_Stock" })
        .populate("seller", "username email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const totalProducts = await Product.countDocuments({ category, status: "In_Stock" });
    const totalPages = Math.ceil(totalProducts / limit);

    const productData = {
        products,
        pagination: {
            currentPage: page,
            totalPages,
            totalProducts,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        category
    };

    return res.status(200).json(new ApiResponse(200, productData, `${category} products retrieved successfully`));
});

const getFeaturedProducts = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 8;

    // Get products with high ratings and recent reviews
    const products = await Product.find({ 
        status: "In_Stock",
        rating: { $gte: 4 }
    })
    .populate("seller", "username email")
    .sort({ rating: -1, createdAt: -1 })
    .limit(limit);

    return res.status(200).json(new ApiResponse(200, products, "Featured products retrieved successfully"));
});

const getProductStats = asyncHandler(async (req, res) => {
    const sellerId = req.user._id;

    const stats = await Product.aggregate([
        { $match: { seller: sellerId } },
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
                totalStock: { $sum: "$stock" }
            }
        }
    ]);

    const categoryStats = await Product.aggregate([
        { $match: { seller: sellerId } },
        {
            $group: {
                _id: "$category",
                count: { $sum: 1 }
            }
        }
    ]);

    const totalProducts = await Product.countDocuments({ seller: sellerId });
    const averageRating = await Product.aggregate([
        { $match: { seller: sellerId } },
        { $group: { _id: null, avgRating: { $avg: "$rating" } } }
    ]);

    const productStats = {
        totalProducts,
        averageRating: averageRating.length > 0 ? parseFloat(averageRating[0].avgRating.toFixed(1)) : 0,
        productsByStatus: {
            In_Stock: 0,
            out_of_stock: 0
        },
        productsByCategory: {
            Fashion: 0,
            Pharmacy: 0,
            Essential: 0,
            Grocery: 0
        }
    };

    stats.forEach(stat => {
        productStats.productsByStatus[stat._id] = stat.count;
    });

    categoryStats.forEach(stat => {
        productStats.productsByCategory[stat._id] = stat.count;
    });

    return res.status(200).json(new ApiResponse(200, productStats, "Product statistics retrieved successfully"));
});

const updateProductStock = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { stock } = req.body;
    const sellerId = req.user._id;

    if (stock === undefined || stock < 0) {
        throw new ApiError(400, "Valid stock quantity is required");
    }

    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    // Check if user is the seller
    if (product.seller.toString() !== sellerId.toString()) {
        throw new ApiError(403, "You can only update your own products");
    }

    const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        { 
            stock, 
            status: stock > 0 ? "In_Stock" : "out_of_stock" 
        },
        { new: true }
    ).populate("seller", "username email");

    return res.status(200).json(new ApiResponse(200, updatedProduct, "Product stock updated successfully"));
});

export { 
    createProduct, 
    getAllProducts, 
    getProductById, 
    updateProduct, 
    deleteProduct, 
    getSellerProducts, 
    getProductsByCategory, 
    getFeaturedProducts, 
    getProductStats, 
    updateProductStock 
};