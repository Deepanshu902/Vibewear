import mongoose from "mongoose";


const productSchema = new mongoose.Schema({
    Productname:{
        type:String,
        trim:true,
        required:true,
        index:true
    },
    seller:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true,
        index:true
    },
    description: {
        short: {
            type: String,
            required: true,
            maxlength:[200,"short description should not exceed 200 characters"]
        },
        detailed: {
            type: String,
            required: true
        }
    },
    price: {
        regular: {
            type: Number,
            required: true,
            min:[0,"Price cannot be negative"]
        },
        sale: {
            type: Number,
            default: null,
            min:[0,"Sale Price cannot be negative"]
        },
        discount: {
            type: Number,
            default: 0,
            min: [0, "Discount cannot be negative"],
            max: [100, "Discount cannot exceed 100%"]
        }
    },
    stock:{
        type:Number,
        required:true,
        min: [0, "Stock cannot be negative"]
    },
    images:[{
        url:{
            type:String,
            required:true
        }
    }],
    category: {
        type: String,
        enum: ["Fashion", "Pharmacy", "Essential", "Grocery"],
        required: true,
        index: true 
    },       
    reviews:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Review"
    }],
    rating:{
        type:Number,
        default:0,
        min:0,
        max:5
    },
    status: {
        type: String,
        enum: ["In_Stock", "out_of_stock"],
        default: "In_Stock"
    },
},{timestamps:true})

export const Product = mongoose.model("Product",productSchema)