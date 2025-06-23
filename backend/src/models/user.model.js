import mongoose from "mongoose"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"


const userSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        trim:true,
    },
    email:{
        type:String,
        required:true,
        trim:true,
        unique:true,
        index:true,
        lowercase: true
    },
    phoneNumber:{
        type:String,
        required:true,
        unique:true,
        trim:true
    },
    password:{
        type:String,
        required:true,
        minlength:[6,"Password should be atleast 6 characters"]
    },
    role:{
        type:String,
        enum:["buyer","seller","admin"],
        default:"buyer"
    },
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
        country: String
    },
    profilePhoto: {
        type: String,
        default: null
    },
    refreshToken: {
        type: String
    }
},{timestamps:true})


userSchema.pre("save",async function(next){
    if (!this.isModified("password")){
        return next();
    }
    this.password = await bcrypt.hash(this.password, 10);
    next();
})

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password,this.password)
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
         {
             _id: this._id,
             email:this.email,
             name : this.name,
             role: this.role
         },
         process.env.ACCESS_TOKEN_SECRET,
         {
             expiresIn: process.env.ACCESS_TOKEN_EXPIRY
         }
     )
 
     
 }
 
userSchema.methods.generateRefreshToken = function(){
     return jwt.sign(
         {
             _id: this._id,
         },
         process.env.REFRESH_TOKEN_SECRET,
         {
             expiresIn: process.env.REFRESH_TOKEN_EXPIRY
         }
     )
 }

export const User = mongoose.model("User",userSchema)