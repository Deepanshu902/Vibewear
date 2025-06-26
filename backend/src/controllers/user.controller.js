import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {uploadOnCloudinary,deleteCloudinaryFile} from "../utils/cloudinary.js"


const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { refreshToken, accessToken, role: user.role };
    } catch (error) {
        throw new ApiError(501, "Something went wrong while generating refresh and access token ");
    }
};

const options = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
};

const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, address, phoneNumber,role } = req.body;

    if (!name || !email || !password || !address || !phoneNumber) {
        throw new ApiError(400, "name, email, password, address and phone number are required");
    }

    const existedUser = await User.findOne({ email });

    if (existedUser) {
        throw new ApiError(409, "Already Exist");
    }

    let profilePhotoUrl = null;
    if (req.file) {
        try {
            const response = await uploadOnCloudinary(req.file.buffer);
            if (response && response.secure_url) {
                profilePhotoUrl = response.secure_url;
            }
        } catch (error) {
            console.error("Profile photo upload failed:", error);
            // Don't throw error - photo is optional, continue with registration
        }
    }

    

    const user = await User.create({
        name,
        email,
        password,
        role: role || "buyer",
        address, 
        phoneNumber,
        profilePhoto: profilePhotoUrl
    });

    if (!user) {
        throw new ApiError(500, "Server error while creating user");
    }

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong ");
    }
    
    return res.status(200).json(new ApiResponse(200, createdUser, "User Registered"));
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new ApiError(401, "Email and Password is required");
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(500, "No user exist");
    }

    const correctPassword = await user.isPasswordCorrect(password);

    if (!correctPassword) {
        throw new ApiError(401, "Password is not correct");
    }

    const { refreshToken, accessToken, role } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
   
    return res
        .status(200)
        .cookie("refreshToken", refreshToken,options)
        .cookie("accessToken", accessToken,options)
        .json(new ApiResponse(200, { ...loggedInUser.toObject(), role }, "User Logged in successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,
            },
        },
        {
            new: true,
        }
    );

    return res
        .status(200)
        .clearCookie("refreshToken", options)
        .clearCookie("accessToken", options)
        .json(new ApiResponse(200, {}, "User Logged out Successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { name, address, phoneNumber } = req.body;

    if (!name && !address && !phoneNumber ) {
        throw new ApiError(401, "At least one field is required");
    }

    const updateFields = {
        name,
        address, 
        phoneNumber, 
    };

    const user = await User.findOneAndUpdate(
        { _id: req.user._id },
        { $set: updateFields },
        { new: true }
    ).select("-password");

    if (!user) {
        throw new ApiError(500, "Error while Updating");
    }
 
    return res.status(200).json(new ApiResponse(200, user, "Details updated Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, req.user, "CurrentUser Fetch successfully"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldpassword, newpassword } = req.body;

    if (!oldpassword || !newpassword) {
        throw new ApiError(401, "Old and new password is required");
    }

    if (newpassword.length < 6) {
    throw new ApiError(401, "New password should be at least 6 characters");
    }

    const user = await User.findById(req.user._id);
    const correctPassword = await user.isPasswordCorrect(oldpassword);

    if (!correctPassword) {
        throw new ApiError(401, "Old password is incorrect");
    }

    user.password = newpassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, {}, "Password changed Successfully"));
});

export {
    registerUser,
    loginUser,
    logoutUser,
    updateAccountDetails,
    getCurrentUser,
    changeCurrentPassword,
};