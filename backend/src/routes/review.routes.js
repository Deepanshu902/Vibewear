import { Router } from "express";
import {
    addReview,
    updateReview,
    deleteReview,
    getProductReviews,
    getUserReviews,
    getReviewById,
    getReviewStats
} from "../controllers/review.controller.js";
import { verifyJWT, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

// All review routes require authentication
router.use(verifyJWT);

// Review CRUD operations
router.route("/")
    .post(
        authorizeRoles("buyer", "admin"),
        addReview
    );

router.route("/:reviewId")
    .get(
        authorizeRoles("buyer", "seller", "admin"),
        getReviewById
    )
    .put(
        authorizeRoles("buyer", "admin"),
        updateReview
    )
    .patch(
        authorizeRoles("buyer", "admin"),
        updateReview
    )
    .delete(
        authorizeRoles("buyer", "admin"),
        deleteReview
    );

// Product-specific review routes
router.route("/product/:productId")
    .get(
        authorizeRoles("buyer", "seller", "admin"),
        getProductReviews
    );

router.route("/product/:productId/stats")
    .get(
        authorizeRoles("buyer", "seller", "admin"),
        getReviewStats
    );

// User-specific review routes
router.route("/user/my-reviews")
    .get(
        authorizeRoles("buyer", "admin"),
        getUserReviews
    );

// Alternative routes for better clarity
router.route("/add").post(
    authorizeRoles("buyer", "admin"),
    addReview
);

router.route("/update/:reviewId").patch(
    authorizeRoles("buyer", "admin"),
    updateReview
);

router.route("/delete/:reviewId").delete(
    authorizeRoles("buyer", "admin"),
    deleteReview
);

// Admin-specific routes for review management
router.route("/admin/all")
    .get(
        authorizeRoles("admin"),
        // You can add an admin controller to get all reviews if needed
    );

router.route("/admin/:reviewId/approve")
    .patch(
        authorizeRoles("admin"),
        // You can add an admin controller to approve reviews if needed
    );

router.route("/admin/:reviewId/reject")
    .patch(
        authorizeRoles("admin"),
        // You can add an admin controller to reject reviews if needed
    );

export default router;