import { Router } from "express";
import { 
    createOrder, 
    getUserOrders, 
    getOrderById, 
    updateOrderStatus, 
    getOrderStats, 
    getOrderByNumber, 
    reorderItems 
} from "../controllers/order.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(verifyJWT);

// Order routes
router.route("/create").post(createOrder);
router.route("/").get(getUserOrders);
router.route("/stats").get(getOrderStats);
router.route("/:orderId").get(getOrderById);
router.route("/:orderId/status").patch(updateOrderStatus);
router.route("/number/:orderNumber").get(getOrderByNumber);
router.route("/:orderId/reorder").post(reorderItems);

export default router;