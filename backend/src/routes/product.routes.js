import { Router } from "express";
import {
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
} from "../controllers/product.controller.js";
import { verifyJWT, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

// Public routes (no authentication required)
router.route("/")
    .get(getAllProducts); // Get all products with filters, search, pagination

router.route("/featured")
    .get(getFeaturedProducts); // Get featured products

router.route("/category/:category")
    .get(getProductsByCategory); // Get products by category

router.route("/:productId")
    .get(getProductById); // Get single product by ID

// Protected routes (authentication required)
// Seller routes - Create and manage products
router.route("/seller/create")
    .post(
        verifyJWT,
        authorizeRoles("seller", "admin"),
        createProduct
    );

router.route("/seller/my-products")
    .get(
        verifyJWT,
        authorizeRoles("seller", "admin"),
        getSellerProducts
    );

router.route("/seller/stats")
    .get(
        verifyJWT,
        authorizeRoles("seller", "admin"),
        getProductStats
    );

router.route("/seller/:productId")
    .put(
        verifyJWT,
        authorizeRoles("seller", "admin"),
        updateProduct
    )
    .patch(
        verifyJWT,
        authorizeRoles("seller", "admin"),
        updateProduct
    )
    .delete(
        verifyJWT,
        authorizeRoles("seller", "admin"),
        deleteProduct
    );

router.route("/seller/:productId/stock")
    .patch(
        verifyJWT,
        authorizeRoles("seller", "admin"),
        updateProductStock
    );

// Alternative routes for better clarity
router.route("/create")
    .post(
        verifyJWT,
        authorizeRoles("seller", "admin"),
        createProduct
    );

router.route("/update/:productId")
    .patch(
        verifyJWT,
        authorizeRoles("seller", "admin"),
        updateProduct
    );

router.route("/delete/:productId")
    .delete(
        verifyJWT,
        authorizeRoles("seller", "admin"),
        deleteProduct
    );

router.route("/stock/:productId")
    .patch(
        verifyJWT,
        authorizeRoles("seller", "admin"),
        updateProductStock
    );

// Admin routes for product management
router.route("/admin/all")
    .get(
        verifyJWT,
        authorizeRoles("admin"),
        getAllProducts // Admin can see all products including out of stock
    );

router.route("/admin/:productId/approve")
    .patch(
        verifyJWT,
        authorizeRoles("admin"),
        // You can add admin approval controller here if needed
    );

router.route("/admin/:productId/reject")
    .patch(
        verifyJWT,
        authorizeRoles("admin"),
        // You can add admin rejection controller here if needed
    );

router.route("/admin/stats")
    .get(
        verifyJWT,
        authorizeRoles("admin"),
        // You can add admin stats controller here if needed
    );
    
// Search and filter routes
router.route("/search")
    .get(getAllProducts); // Search products (uses query parameters)

router.route("/filter")
    .get(getAllProducts); // Filter products (uses query parameters)

export default router;