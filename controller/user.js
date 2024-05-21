const express = require("express");
const User = require("../model/user");
const router = express.Router();
const cloudinary = require("cloudinary");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const nodemailer = require('nodemailer');
const jwt = require("jsonwebtoken");
const {validateRegistration,validateLogin,validateUpdate,ValidateUserAddresses,ValidateUpdateUserPassword} = require('../validation/userValidation')
const sendMail = require("../utils/sendMail");
const sendToken = require("../utils/jwtToken");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const crypto = require('crypto');
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)


const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smpt.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'villajamarketplace@gmail.com', 
    pass: 'zzccxzuizilhkvhb',   
  },
});



// register
router.post('/register', async (req, res, next) => {
  try {
    const { firstname, lastname, email, phoneNumber, password } = req.body;

    let validation = validateRegistration(req.body);
    if (validation.error) return next(new ErrorHandler(validation.error.details[0].message, 400));

    const userEmail = await User.findOne({ email });

    if (userEmail) {
      return next(new ErrorHandler('User already exists', 400));
    }

    const newUser = await User.create({
      firstname: firstname,
      lastname: lastname,
      email: email,
      phoneNumber: phoneNumber,
      password: password,
      emailVerificationCode: crypto.randomBytes(3).toString('hex').toUpperCase(),
    });

    // Generate a JWT token for the newly registered user
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: '90d', // You can set the token expiration as needed
    });

    const verificationLink = `https://villaja-backend-servers.onrender.com/api/user/verify-email/${newUser._id}/${newUser.emailVerificationCode}`;

    const emailHTML = `
      <html>
      <head>
           <meta charset="UTF-8">
      </head>
        <body>
          <div style="text-align: left; background-color: #f3f3f3; padding: 20px;">
            <h2>Welcome to Villaja!</h2>
            <p>
              Hey there, ${firstname}! My name is Humble, the CEO and co-founder of Villaja. We're absolutely over the moon to welcome you to Villaja, your new online haven for all things tech-tastic! 🎉            
            <p>
            <p>
              Please Click the link to verify your Account:
              <a href="${verificationLink}">Verify Email</a>
            </p>
             Villaja is an online marketplace filled with the latest electronic gadgets, gizmos, and accessories just waiting for you to explore.
             That's what we're all about. Our mission is to make sure you're equipped with the coolest and most cutting-edge tech out there and to ensure what you order is what you get. Continue shopping
             <a href="http://www.villaja.com">www.villaja.com</a>
            </p>
            <p>
              Any questions?<br /> Contact us:<br /><a href="mailto:villajamarketplace@gmail.com">villajamarketplace@gmail.com</a>
            </p>
            <p>
              Warm regards,<br />Asikaogu Humble,<br />CEO, Villaja
            </p>
          </div>
        </body>
      </html>
    `;

    // Send the welcome email to the user
    const sendEmail = () => {
      return new Promise((resolve, reject) => {
        const mailOptions = {
          from: 'villajamarketplace@gmail.com', // Sender email
          to: email, // Receiver email (the user's email)
          subject: 'Welcome to Villaja, Activate Account',
          html: emailHTML, // Use the HTML content for styling and structure
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            reject(error);
          } else {
            resolve('Email sent');
          }
        });
      });
    };

    try {
      await sendEmail(); // Wait for the email to be sent
      console.log('Welcome email sent successfully');
    } catch (error) {
      console.error('Email sending failed:', error);
    }

    // Send the token as part of the JSON response
    res.status(201).json({
      success: true,
      user: newUser,
      token,
    });
  } catch (error) {
    console.log(error);
    return next(new ErrorHandler(error.message, 400));
  }
});

router.get('/verify-email/:userId/:verificationCode', async (req, res, next) => {
  try {
    const { userId, verificationCode } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return next(new ErrorHandler('User not found', 404));
    }

    if (user.isEmailVerified) {
      // HTML content for already verified email
      const alreadyVerifiedHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Already Verified</title>
        </head>
        <body>
          <div style="font-family: 'Arial', sans-serif; text-align: center; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 50px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #28a745;">Email Already Verified</h2>
              <p style="margin-bottom: 20px;">Your email is already verified. Please proceed to log in to your account.</p>
              
              <div style="margin-top: 20px;">
                <a href="http://www.villaja.com/user/login" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: #fff; text-decoration: none; border-radius: 5px; transition: background-color 0.3s ease;"
                  >Log In</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
    
      return res.status(200).send(alreadyVerifiedHTML);
    }

    if (user.emailVerificationCode !== verificationCode) {
      return next(new ErrorHandler('Invalid verification code', 400));
    }

    // Mark the email as verified
    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;

    await user.save();

    // HTML content for email verification success
    const verificationSuccessHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification Success</title>
      </head>
      <body>
        <div style="font-family: 'Arial', sans-serif; text-align: center; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 50px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #007BFF;">Email Verification Success</h2>
            <p style="margin-bottom: 20px;">Your email has been successfully verified. You can now log in to your account.</p>
            
            <div style="margin-top: 20px;">
              <a href="http://www.villaja.com/user/login" style="display: inline-block; padding: 10px 20px; background-color: #007BFF; color: #fff; text-decoration: none; border-radius: 5px; transition: background-color 0.3s ease;"
                >Log In</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    res.status(200).send(verificationSuccessHTML);
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});



// ... (other imports and route handlers)

// Request another email verification code
router.post(
  "/resend-verification-code",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const userEmail = req.body.email;
      const user = await User.findOne({ email: userEmail });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.isEmailVerified) {
        return res.status(200).json({
          success: true,
          message: "Email is already verified",
        });
      }

      // Generate and update a new email verification code
      const newVerificationCode = generateNewVerificationCode();
      user.emailVerificationCode = newVerificationCode;

      // Save the updated user
      await user.save();

      // Send the new verification code to the user's email
      const transporter = nodemailer.createTransport({
        // Configure nodemailer to use your email service
        // (You need to set up nodemailer with your email provider)
        service: "gmail",
        auth: {
          user: "your-email@gmail.com", // replace with your email
          pass: "your-email-password", // replace with your email password
        },
      });

      const mailOptions = {
        from: "your-email@gmail.com", // replace with your email
        to: userEmail,
        subject: "New Email Verification Code",
        text: `Your new verification code is: ${newVerificationCode}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return next(new ErrorHandler("Failed to send verification code", 500));
        }
        console.log("Email sent: " + info.response);
      });

      res.status(200).json({
        success: true,
        message: "New verification code sent successfully",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);



// Function to generate a new verification code
function generateNewVerificationCode() {
  // Implement your code to generate a new verification code (e.g., a random string)
  // Example:
  const length = 6;
  const characters = "0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}





router.post('/login', catchAsyncErrors(async (req, res, next) => {
  try {
    const { email, password } = req.body;

    let validation = validateLogin(req.body);
    if (validation.error) return next(new ErrorHandler(validation.error.details[0].message, 400));

    if (!email || !password) {
      return next(new ErrorHandler('Please provide all fields!', 400));
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return next(new ErrorHandler("User doesn't exist!", 400));
    }

    if (!user.isEmailVerified) {
      return next(new ErrorHandler('Please Activate Your Account through your email and try again', 400));
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return next(new ErrorHandler('Invalid credentials', 400));
    }

    // If the user is valid, generate a JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: '10d', // You can set the token expiration as needed
    });

    // Send a welcome email to the user
    const sendEmail = () => {
      return new Promise((resolve, reject) => {
        const mailOptions = {
          from: 'villajamarketplace@gmail.com', // Sender email
          to: user.email, // Receiver email (the user's email)
          subject: 'You Just Logged In to Villaja',
          html:`<h3>Hello ${user.firstname},</h3> <p>We're verifying a recent sign-in for ${email}</p> <p>Timestamp: ${new Date().toLocaleString()}</p> <p>If you believe that this sign-in is suspicious, please reset your password immediately.</p> <p>Thanks, </br></br> Villaja Team</p>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            reject(error);
          } else {
            resolve('Email sent');
          }
        });
      });
    };

    try {
      await sendEmail(); // Wait for the email to be sent
      console.log('Email sent successfully');
    } catch (error) {
      console.error('Email sending failed:', error);
    }

    // Send the token as a JSON response
    res.status(200).json({
      success: true,
      user,
      token,
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
}));


// load user
router.get(
  "/getuser",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return next(new ErrorHandler("User doesn't exists", 400));
      }

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// log out user
router.get('/logout', catchAsyncErrors(async (req, res, next) => {
  try {
    // In JWT-based authentication, there is no need to clear cookies.
    // Logging out can be as simple as responding with a success message.

    res.status(201).json({
      success: true,
      message: 'Log out successful!',
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
}));


// update user info
router.put(
  "/update-user-info",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email, password, phoneNumber, firstname, lastname } = req.body;

      let validation = validateUpdate(req.body)
      if(validation.error) return next(new ErrorHandler(validation.error.details[0].message, 400));

      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("User not found", 400));
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return next(
          new ErrorHandler("Please provide the correct information", 400)
        );
      }

      user.firstname = firstname;
      user.lastname = lastname;
      user.email = email;
      user.phoneNumber = phoneNumber;

      await user.save();

    
      res.status(201).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);


// Update user info
router.put(
  "/update-user-info",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email, password, phoneNumber, firstname, lastname } = req.body;

      let validation = validateUpdate(req.body);
      if (validation.error) return next(new ErrorHandler(validation.error.details[0].message, 400));

      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("User not found", 400));
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return next(
          new ErrorHandler("Please provide the correct information", 400)
        );
      }

      user.firstname = firstname;
      user.lastname = lastname;
      user.email = email;
      user.phoneNumber = phoneNumber;

      await user.save();

      // Craft the update info email
      const emailHTML = `
        <html>
          <body>
            <div style="text-align: left; background-color: #f3f3f3; padding: 20px;">
              <h2>User Info Updated</h2>
              <p>
                Hey there, ${firstname}! Your user information has been updated at ${new Date()}.
              </p>
              <p>
                If you didn't make this change, please contact our support team. <a href="mailto:villajamarketplace@gmail.com">villajamarketplace@gmail.com</a>
              </p>
              <p>
                Best regards,</br>
                The Villaja Team
              </p>
            </div>
          </body>
        </html>
      `;

      // Send the update info email to the user
      const sendEmail = () => {
        return new Promise((resolve, reject) => {
          const mailOptions = {
            from: 'villajamarketplace@gmail.com',
            to: email,
            subject: 'User Info Updated',
            html: emailHTML,
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              reject(error);
            } else {
              resolve('Email sent');
            }
          });
        });
      };

      try {
        await sendEmail(); // Wait for the email to be sent
        console.log('Update info email sent successfully');
      } catch (error) {
        console.error('Email sending failed:', error);
      }

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);


// update user addresses // or add user adress
router.put(
  "/update-user-addresses",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      let validation = ValidateUserAddresses(req.body)
      if(validation.error) return next(new ErrorHandler(validation.error.details[0].message, 400));

      const user = await User.findById(req.user.id);

      const sameTypeAddress = user.addresses.find(
        (address) => address.addressType === req.body.addressType
      );
      if (sameTypeAddress) {
        return next(
          new ErrorHandler(`${req.body.addressType} address already exists`)
        );
      }

      const existsAddress = user.addresses.find(
        (address) => address._id === req.body._id
      );

      if (existsAddress) {
        Object.assign(existsAddress, req.body);
      } else {
        // add the new address to the array
        user.addresses.push(req.body);
      }

      await user.save();

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);


// delete user address
router.delete(
  "/delete-user-address/:id",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const userId = req.user._id;
      const addressId = req.params.id;

      await User.updateOne(
        {
          _id: userId,
        },
        { $pull: { addresses: { _id: addressId } } }
      );

      const user = await User.findById(userId);

      res.status(200).json({ success: true, user });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.put(
  "/update-user-password",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      let validation = ValidateUpdateUserPassword(req.body);
      if (validation.error) return next(new ErrorHandler(validation.error.details[0].message, 400));

      const user = await User.findById(req.user.id).select("+password");

      const isPasswordMatched = await user.comparePassword(
        req.body.oldPassword
      );

      if (!isPasswordMatched) {
        return next(new ErrorHandler("Old password is incorrect!", 400));
      }

      if (req.body.newPassword !== req.body.confirmPassword) {
        return next(
          new ErrorHandler("Password doesn't match with each other!", 400)
        );
      }
      user.password = req.body.newPassword;

      await user.save();

      // Craft the password update email
      const emailHTML = `
        <html>
          <body>
            <div style="text-align: left; background-color: #f3f3f3; padding: 20px;">
              <h2>Password Updated</h2>
              <p>
                Hey there, ${firstname}! Your password has been updated at ${new Date()}.
              </p>
              <p>
                If you didn't make this change, please contact our support team. <a href="mailto:villajamarketplace@gmail.com">villajamarketplace@gmail.com</a>
              </p>
              <p>
                Best regards, </br>
                The Villaja Team
              </p>
            </div>
          </body>
        </html>
      `;

      // Send the password update email to the user
      const sendEmail = () => {
        return new Promise((resolve, reject) => {
          const mailOptions = {
            from: 'villajamarketplace@gmail.com',
            to: user.email, // Send to the user's email
            subject: 'Password Updated',
            html: emailHTML,
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              reject(error);
            } else {
              resolve('Email sent');
            }
          });
        });
      };

      try {
        await sendEmail(); // Wait for the email to be sent
        console.log('Password update email sent successfully');
      } catch (error) {
        console.error('Email sending failed:', error);
      }

      res.status(200).json({
        success: true,
        message: "Password updated successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// find user infoormation with the userId
router.get(
  "/user-info/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// all users --- for admin
router.get(
  "/admin-all-users",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const users = await User.find().sort({
        createdAt: -1,
      });
      res.status(201).json({
        success: true,
        users,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// delete users --- admin
router.delete(
  "/delete-user/:id",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        return next(
          new ErrorHandler("User is not available with this id", 400)
        );
      }

      // const imageId = user.avatar.public_id;

      // await cloudinary.v2.uploader.destroy(imageId);

      await User.findByIdAndDelete(req.params.id);

      res.status(201).json({
        success: true,
        message: "User deleted successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);




// Define a new route for password reset with validateResetPassword function
router.post('/forgot-password', catchAsyncErrors(async (req, res, next) => {
  try {
    const { email } = req.body;

    // Define the validateResetPassword function
    const validateResetPassword = (data) => {
      const schema = Joi.object({
        email: Joi.string().email().required(),
      });

      return schema.validate(data);
    };

    // Validate the email address
    let validation = validateResetPassword(req.body);
    if (validation.error) return next(new ErrorHandler(validation.error.details[0].message, 400));

    // Generate a reset token and set its expiration time
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // Token expires in 1 hour

    const user = await User.findOne({ email });

    if (!user) {
      return next(new ErrorHandler('User not found', 404));
    }

    // Set the reset token and its expiry in the user document
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;

    await user.save();

    // Send a password reset email to the user
    const resetPasswordLink = `https://villaja-backend-servers.onrender.com/api/user/reset-password/${resetToken}`;

    const emailHTML = `
      <html>
      <body>
        <div style="text-align: left; background-color: #f3f3f3; padding: 20px;">
          <h2>Password Reset</h2>
          <p>
            You have requested a password reset for your Villaja account.
          </p>
          <p>
            To reset your password, click on the following link:
            <a href="${resetPasswordLink}">Reset Password</a>
          </p>
          <p>
            If you didn't request this reset, please ignore this email.
          </p>
          <p>
            Best regards, <br />
            The Villaja Team
          </p>
        </div>
      </body>
      </html>
    `;

    console.log(resetPasswordLink)

    const sendEmail = () => {
      return new Promise((resolve, reject) => {
        const mailOptions = {
          from: 'villaja',
          to: email,
          subject: 'Password Reset Request',
          html: emailHTML,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            reject(error);
          } else {
            resolve('Email sent');
          }
        });
      });
    };

    try {
      await sendEmail();
      console.log('Password reset email sent successfully');
    } catch (error) {
      console.error('Email sending failed:', error);
    }

    res.status(200).json({
      success: true,
      message: 'Password reset email sent. Check your inbox.',
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
}));


router.get('/reset-password/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    // Find the user by the reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return next(new ErrorHandler('Invalid or expired reset token', 400));
    }

    // Render an HTML form for resetting the password
    const resetPasswordForm = `
    <!DOCTYPE html>
    <html lang="en">
    
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Password</title>
    </head>
    
    <body style="font-family: Arial; padding: 20px; margin-top:30px;">
    
      <center>
        <h2 style="margin-bottom: 20px; color: dodgerblue;">Reset Your <i>Villaja</i> Password</h2>
        <form action="https://villaja-backend-servers.onrender.com/api/user/reset-password" method="post" style="max-width: 400px; margin: 0 auto;">
          <input type="hidden" name="token" value="${token}">
          <label for="newPassword" style="display: block; margin-bottom: 10px;">New Password:</label>
          <input type="password" name="newPassword" required style="padding: 10px; border-radius: 6px; margin-bottom: 20px; width: 100%; box-sizing: border-box;">
          <label for="confirmPassword" style="display: block; margin-bottom: 10px;">Confirm Password:</label>
          <input type="password" name="confirmPassword" required style="padding: 10px; border-radius: 6px; margin-bottom: 20px; width: 100%; box-sizing: border-box;"><br />
          <input type="submit" value="Reset Password" style="background-color: #007BFF; border-radius: 6px; color: #fff; padding: 10px 20px; border: none; cursor: pointer;">
        </form>
      </center>
    
      <script>
        if (window.location.search.includes('?success=true')) {
          alert('Password changed successfully');
          window.location.href = 'https://villaja.com/user/login';
        }
      </script>
    
    </body>
    
    </html>
    
    `;

    res.send(resetPasswordForm);
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});



router.post('/reset-password', async (req, res, next) => {
  try {
    const { newPassword, confirmPassword, token } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return next(new ErrorHandler('Invalid or expired reset token', 400));
    }

    if (newPassword !== confirmPassword) {
      return next(new ErrorHandler("Passwords don't match", 400));
    }

    // Update the user's password with the new password
    user.password = newPassword;

    // Clear the reset token and its expiry
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;

    // Save the user document with the new password and without the reset token
    await user.save();

    // Return a styled HTML content for a successful password reset
    const resetSuccessHTML = `
      <html>
      <head>
        <title>Password Reset Successful</title>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="text-align: center; font-family: Arial; padding: 20px;">
        <h3>Password Reset Successful</h3>
        <p>Your password has been successfully reset.</p>
        <a href="https://www.villaja.com/user/login">Click To Login</a>
      </body>
      </html>
    `;

    res.status(200).send(resetSuccessHTML);

  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});





module.exports = router;
