import { Router } from "express";
import { 
    createPayment, 
    updatePaymentStatus, 
    getPaymentById, 
    getPaymentsByOrder, 
    getUserPayments, 
    getPaymentStats, 
    processRefund, 
    verifyPayment 
} from "../controllers/payment.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(verifyJWT);

// Payment routes
router.route("/create").post(createPayment);
router.route("/").get(getUserPayments);
router.route("/stats").get(getPaymentStats);
router.route("/verify").post(verifyPayment);
router.route("/:paymentId").get(getPaymentById);
router.route("/:paymentId/status").patch(updatePaymentStatus);
router.route("/:paymentId/refund").post(processRefund);
router.route("/order/:orderId").get(getPaymentsByOrder);

export default router;