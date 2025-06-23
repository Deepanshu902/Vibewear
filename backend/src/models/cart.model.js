import mongoose from "mongoose";

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },
        price: {
            type: Number,
            required: true 
        }
    }],
    totalAmount: {
        type: Number,
        default: 0
    }
}, {timestamps: true});

cartSchema.index({ user: 1 }, { unique: true }); // for 1 user have only one cart 
// something new learned today 

export const Cart = mongoose.model("Cart", cartSchema);