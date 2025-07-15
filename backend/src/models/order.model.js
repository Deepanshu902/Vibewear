import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
      user:{
         type:mongoose.Schema.Types.ObjectId,
         ref:"User",
         required:true
      },
      orderNumber:{
         type:String,
         required:true,
         trim:true,
         unique:true
      },
      totalAmount:{
         type:Number,
         required:true,
      },
      orderStatus:{
         type:String,
         enum:["pending","confirmed","shipped","delivered","cancelled","returned"],
         default:"pending",
         required:true
      },
      shippingAddress: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "User",
         required: true
      },
      items:{
         type:mongoose.Schema.Types.ObjectId,
         ref:"cart",
         required:true
      }
},{timestamps:true})

export const Order = mongoose.model("Order",orderSchema)