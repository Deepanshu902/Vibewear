import { Router } from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    updateAccountDetails,
    getCurrentUser,
    changeCurrentPassword,
} from "../controllers/user.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public routes (no authentication required)
router.route("/register").post(
    upload.single("profilePhoto"), // Optional profile photo upload
    registerUser
);

router.route("/login").post(loginUser);

// Protected routes (authentication required)
router.route("/logout").post(verifyJWT, logoutUser);

router.route("/current-user").get(verifyJWT, getCurrentUser);

router.route("/update-account").patch(verifyJWT, updateAccountDetails);

router.route("/change-password").post(verifyJWT, changeCurrentPassword);

// Admin only routes (authentication + admin role required)
router.route("/admin/users").get(
    verifyJWT,
    authorizeRoles("admin"),
    // You can add a getAllUsers controller here if needed
);

// Seller routes (authentication + seller role required)
router.route("/seller/dashboard").get(
    verifyJWT,
    authorizeRoles("seller", "admin"),
    // You can add a getSellerDashboard controller here if needed
);

// Buyer routes (authentication + buyer role required)
router.route("/buyer/profile").get(
    verifyJWT,
    authorizeRoles("buyer", "admin"),
    // You can add a getBuyerProfile controller here if needed
);

export default router;