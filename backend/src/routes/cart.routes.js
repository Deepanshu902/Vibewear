import { Router } from "express";
import {
    addToCart,
    updateCartItemQuantity,
    removeFromCart,
    getCart,
    clearCart
} from "../controllers/cart.controller.js";
import { verifyJWT, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

// All cart routes require authentication
router.use(verifyJWT);

// Cart routes - accessible to buyers and admins
router.route("/")
    .get(
        authorizeRoles("buyer", "admin"),
        getCart
    )
    .post(
        authorizeRoles("buyer", "admin"),
        addToCart
    )
    .delete(
        authorizeRoles("buyer", "admin"),
        clearCart
    );

// Update cart item quantity
router.route("/item/:productId")
    .put(
        authorizeRoles("buyer", "admin"),
        updateCartItemQuantity
    )
    .patch(
        authorizeRoles("buyer", "admin"),
        updateCartItemQuantity
    )
    .delete(
        authorizeRoles("buyer", "admin"),
        removeFromCart
    );

// Alternative routes for better RESTful design
router.route("/add").post(
    authorizeRoles("buyer", "admin"),
    addToCart
);

router.route("/update/:productId").patch(
    authorizeRoles("buyer", "admin"),
    updateCartItemQuantity
);

router.route("/remove/:productId").delete(
    authorizeRoles("buyer", "admin"),
    removeFromCart
);

router.route("/clear").delete(
    authorizeRoles("buyer", "admin"),
    clearCart
);

export default router;