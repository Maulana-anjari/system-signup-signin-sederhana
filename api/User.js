const express = require('express')
const router = express.Router()

// ? USING MODEL ? //
// *mongodb user model
const User = require('./../models/User')
// *mongodb user verification model
const UserVerification = require('./../models/UserVerification')
// *mongodb password reset model
const PasswordReset = require('./../models/PasswordReset')
// ? END USING MODEL ? //

// ? USING HANDLER ? //
// *password handler (crypt)
const bcrypt = require('bcrypt')
// *email handler
const nodemailer = require('nodemailer')
// *unique string (TOKEN) handler
const { v4: uuidv4 } = require('uuid')
// ? END USING HANDLER ? //

// *env variables
require('dotenv').config()

// *path for static verified page
const path = require('path')


// *notmailer stuff
let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS
    }
})

// ? TESTING TRANSPORTER ? //
transporter.verify((error, success) => {
    if (error) {
        console.log(error)
    } else {
        console.log("Ready to send message")
        console.log("Success: " + success)
    }
})

// ? ROUTER: Sign up ? //
router.post('/signup', (req, res) => {
    let { name, email, password, dateOfBirth } = req.body
    name = name.trim()
    email = email.trim()
    password = password.trim()
    dateOfBirth = dateOfBirth.trim()
    // validation form
    // if empty input value
    if (name == "" || email == "" || password == "" || dateOfBirth == "") {
        res.json({
            status: "FAILED",
            message: "Empty input fields!"
        })
        // if name value is invalid
    } else if (!/^[a-zA-Z ]*$/.test(name)) {
        res.json({
            status: "FAILED",
            message: "Invalid name entered!"
        })
    } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        res.json({
            status: "FAILED",
            message: "Invalid email  entered!"
        })
    } else if (!new Date(dateOfBirth).getTime()) {
        res.json({
            status: "FAILED",
            message: "Invalid date of birth entered!"
        })
    } else if (password.length < 8) {
        res.json({
            status: "FAILED",
            message: "Password is to short!"
        })
    } else {
        // Checking if user already exists
        User.find({ email }).then(result => {
            if (result.length) {
                res.json({
                    status: "FAILED",
                    message: "User with the provided email already exists!"
                })
            } else {
                // Try to create new user
                // password handling
                const saltRounds = 10
                bcrypt.hash(password, saltRounds).then(hashedPassword => {
                    const newUser = new User({
                        name,
                        email,
                        password: hashedPassword,
                        dateOfBirth,
                        verified: false
                    })
                    newUser.save().then(result => {
                        // res.json({
                        //     status: "SUCCESS",
                        //     message: "Signup successful!",
                        //     data: result,
                        // })
                        // ? Handle account verification
                        sendVerificationEmail(result, res)
                    })
                        .catch(err => {
                            res.json({
                                status: "FAILED",
                                message: "An error occurred while saving new user!",
                                err
                            })
                        })
                })
                    .catch(err => {
                        res.json({
                            status: "FAILED",
                            message: "An error occurred while hashing password!"
                        })
                    })
            }
        }).catch(err => {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "An error occurred while checking for existing user!"
            })
        })
    }
})

// ? FUNCTION: Send verification email ? //
const sendVerificationEmail = ({ _id, email }, res) => {
    // url to be used in the email
    const currentUrl = "http://localhost:3000/"
    const token = uuidv4() + _id // ? unique string
    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email, // put from param result
        subject: "[NO REPLY] Verify Your Email",
        html: `<p>Verify yout email address to complete the signup and login into your account.</p>
                <p>This link <b>expires in 6 hours</b></p>
                <p>Press <a href=${currentUrl + "user/verify/" + _id + "/" + token}>here</a> to process.</p>`
    }
    const saltRounds = 10
    bcrypt
        .hash(token, saltRounds)
        .then((hashedToken) => {
            // set values in to userverification collection
            const newVerification = new UserVerification({
                userId: _id,
                token: hashedToken,
                createdAt: Date.now(),
                expiresAt: Date.now() + 21600000
            })
            newVerification
                .save()
                .then(() => {
                    transporter
                        .sendMail(mailOptions)
                        .then(() => {
                            // email sent and verification record saved
                            res.json({
                                status: "PENDING",
                                message: "Verification email sent"
                            })
                        })
                        .catch((error) => {
                            console.log(error)
                            res.json({
                                status: "FAILED",
                                message: "Verification email failed!"
                            })
                        })
                })
                .catch((error) => {
                    console.log(error)
                    res.json({
                        status: "FAILED",
                        message: "Couldn't save verification email data!"
                    })
                })
        })
        .catch(() => {
            res.json({
                status: "FAILED",
                message: "An error occured while hashing email data!"
            })
        })
}

// ? ROUTER: Verify Email ? //
router.get('/verify/:userId/:token', (req, res) => {
    let { userId, token } = req.params
    UserVerification
        .find({ userId })
        .then((result) => {
            if (result.length > 0) {
                // user verification record exists so we proceed
                const { expiresAt } = result[0]
                const hashedToken = result[0].token
                // checking for expired token (unique string)
                if (expiresAt < Date.now()) {
                    // record has expired so we delete it
                    UserVerification
                        .deleteOne({ userId })
                        .then(result => {
                            User
                                .deleteOne({ _id: userId })
                                .then(result => {
                                    let message = "Link has expired. Please sign up again"
                                    res.redirect(`/user/verified/error=true&message=${message}`)
                                })
                                .catch(error => {
                                    let message = "Clearing user eith expired token failed"
                                    res.redirect(`/user/verified/error=true&message=${message}`)
                                })
                        })
                        .catch((error) => {
                            console.log(error)
                            let message = "An error occurred while clearing expired user verification record"
                            res.redirect(`/user/verified/error=true&message=${message}`)
                        })
                } else {
                    // valid record exists so we validate the user token
                    // first compare the hashed unique string (token)
                    bcrypt
                        .compare(token, hashedToken)
                        .then(result => {
                            if (result) {
                                // string match, then update verified field to true
                                User
                                    .updateOne({ _id: userId }, { verified: true })
                                    .then(() => {
                                        UserVerification
                                            .deleteOne({ userId })
                                            .then(() => {
                                                res.sendFile(path.join(__dirname, "./../views/verified.html"))
                                            })
                                            .catch(error => {
                                                console.log(error)
                                                let message = "An error occurred while finalizing successful verification"
                                                res.redirect(`/user/verified/error=true&message=${message}`)
                                            })
                                    })
                                    .catch(error => {
                                        console.log(error)
                                        let message = "An error occurred while updating user record to show verified"
                                        res.redirect(`/user/verified/error=true&message=${message}`)
                                    })
                            } else {
                                // existing record but incorrect verification details passed
                                let message = "Invalid verification details passed. Check your inbox."
                                res.redirect(`/user/verified/error=true&message=${message}`)
                            }
                        })
                        .catch(error => {
                            let message = "An error occurred while comparing token/unique string"
                            res.redirect(`/user/verified/error=true&message=${message}`)
                        })
                }
            } else {
                // user verification record doesn't exists
                let message = "Account record doesn't exist or has been verified already. Please sign up or log in."
                res.redirect(`/user/verified/error=true&message=${message}`)
            }
        })
        .catch((error) => {
            console.log(error)
            let message = "An error occurred while checking for existing user verification record"
            res.redirect(`/user/verified/error=true&message=${message}`)
        })
})

// ? ROUTER: Verified Page ? //
router.get('/verified', (req, res) => {
    res.sendFile(path.join(__dirname, "./../views/verified.html"))
})

// ? ROUTER: Sign in ? //
router.post('/signin', (req, res) => {
    let { email, password } = req.body
    email = email.trim()
    password = password.trim()
    // check if input is Empty
    if (email == "" || password == "") {
        res.json({
            status: "FAILED",
            message: "Empty credentials supplied"
        })
    } else {
        // check if user exist
        User.find({ email })
            .then(data => {
                if (data.length) {
                    // User exist
                    // check if user is verified
                    if (!data[0].verified) {
                        res.json({
                            status: "FAILED",
                            message: "Email hasn't been verified yet. Check your inbox!"
                        })
                    } else {
                        const hashedPassword = data[0].password
                        bcrypt.compare(password, hashedPassword)
                            .then(result => {
                                if (result) {
                                    // ? password match
                                    res.json({
                                        status: "SUCCESS",
                                        message: "Signin successful!",
                                        data: data
                                    })
                                } else {
                                    // ? password not match
                                    res.json({
                                        status: "FAILED",
                                        message: "Invalid password entered!"
                                    })
                                }
                            })
                            .catch(err => {
                                res.json({
                                    status: "FAILED",
                                    message: "An error occurred while comparing passwords"
                                })
                            })
                    }
                } else {
                    res.json({
                        status: "FAILED",
                        message: "Email is not registered!"
                    })
                }
            })
            .catch(err => {
                res.json({
                    status: "FAILED",
                    message: "An error occurred while checking for existing user"
                })
            })
    }
})
// ? ROUTER: Reset Password ? //
router.post('/requestPasswordReset', (req, res) => {
    const { email, redirectUrl } = req.body

    // TODO: check if email exists
    User
        .find({ email })
        .then((data) => {
            if (data.length) {
                // * USER EXISTS * //
                // TODO: check if user is verified
                if (!data[0].verified) {
                    // ! USER NOT VERIFIED ! //
                    res.json({
                        status: "FAILED",
                        message: "Email hasn't been verified yet. Check your inbox!"
                    })
                } else {
                    // * USER VERIFIED * //
                    sendResetMail(data[0], redirectUrl, res)
                }
            } else {
                // ! USER NOT EXISTS ! //
                res.json({
                    status: "FAILED",
                    message: "No account with the supplied email exists!"
                })
            }
        })
        .catch(error => {
            // ! ERROR WHILE CHECKING ! //
            res.json({
                status: "FAILED",
                message: "An error occurred while checking for existing user"
            })
        })
})

// ? FUNCTION: Send password reset email ? //
const sendResetMail = ({ _id, email }, redirectUrl, res) => {
    const resetToken = uuidv4() + _id
    // TODO: Clear all existing reset records because maybe user click many request
    PasswordReset
        .deleteMany({ userId: _id })
        .then(result => {
            // * RESET RECORDS DELETED SUCCESSFULLY * //
            // TODO: Send the Email
            // ? Mail option ? //
            const mailOptions = {
                from: process.env.AUTH_EMAIL,
                to: email, // put from param result
                subject: "[NO REPLY] Reset Password",
                html: `<p>We heard that you lost the password.</p>
                        <p>Don't worry, use the link below to reset it.</p>
                        <p>This link <b>expires in 60 minute</b>.</p>
                        <p>Press <a href=${redirectUrl + "/" + _id + "/" + resetToken}>here</a> to process.</p>`
            }
            // TODO: Hash the reset token
            const saltrounds = 10
            bcrypt
                .hash(resetToken, saltrounds)
                .then(hashedResetToken => {
                    // TODO: Set values in password reset collection
                    const newPasswordReset = new PasswordReset({
                        userId: _id,
                        resetToken: hashedResetToken,
                        createdAt: Date.now(),
                        expiresAt: Date.now() + 3600000
                    })
                    newPasswordReset
                        .save()
                        .then(() => {
                            transporter
                                .sendMail(mailOptions)
                                .then(() => {
                                    // * EMAIL SUCCESSFULLY SENT & PASSWORD RESET RECORD SAVED * //
                                    res.json({
                                        status: "PENDING",
                                        message: "Password reset mail sent"
                                    })
                                })
                                .catch(error => {
                                    // ! ERROR WHILE SAVING PASSWORD RESET DATA ! //
                                    console.log(error)
                                    res.json({
                                        status: "FAILED",
                                        message: "Password reset email failed!"
                                    })
                                })
                        })
                        .catch(error => {
                            // ! ERROR WHILE SAVING PASSWORD RESET DATA ! //
                            console.log(error)
                            res.json({
                                status: "FAILED",
                                message: "Couldn't save password reset data!"
                            })
                        })
                })
                .catch(error => {
                    // ! ERROR WHILE HASHING PASSWORD RESET ! //
                    console.log(error)
                    res.json({
                        status: "FAILED",
                        message: "An error occured while hashing the password reset data!"
                    })
                })
        })
        .catch(error => {
            // ! ERROR WHILE CLEARING EXISTING RECORDS ! //
            console.log(error)
            res.json({
                status: "FAILED",
                message: "Clearing existing password reset records failed"
            })
        })
}

// ? ROUTER FOR RESET PASSWORD ? //
router.post('/resetPassword', (req, res) => {
    let { userId, resetToken, newPassword } = req.body
    PasswordReset
        .find({ userId })
        .then(result => {
            if (result.length > 0) {
                // * PASSWORD RESET RECORD EXISTS * //
                const { expiresAt } = result[0]
                const hashedToken = result[0].resetToken
                // TODO: Checking for expired reset token
                if (expiresAt < Date.now()) {
                    PasswordReset
                        .deleteOne({ userId })
                        .then(() => {
                            // * RESET RECORD DELETED SUCCESSFULLY * //
                            res.json({
                                status: "FAILED",
                                message: "Password reset link has expired"
                            })
                        })
                        .catch(error => {
                            // ! ERROR WHILE CLEARING PASSWORD RESET RECORD ! //
                            console.log(error)
                            res.json({
                                status: "FAILED",
                                message: "Clearing password reset record failed"
                            })
                        })
                } else {
                    // * VALID RESET RECORD EXISTS * //
                    // TODO: Validate the reset token
                    // TODO: compare the hashed reset token
                    bcrypt
                        .compare(resetToken, hashedToken)
                        .then(result => {
                            if (result) {
                                // * TOKEN MATCHED * //
                                // TODO: Hash password again
                                const saltrounds = 10
                                bcrypt
                                    .hash(newPassword, saltrounds)
                                    .then(hashedNewPassword => {
                                        // TODO: Update user password
                                        User
                                            .updateOne({ _id: userId }, { password: hashedNewPassword })
                                            .then(() => {
                                                // * UPDATE COMPLETED * //
                                                PasswordReset
                                                    .deleteOne({userId})
                                                    .then(() => {
                                                        // * USER RECORD AND RESET RECORD UPDATED * //
                                                        res.json({
                                                            status: "SUCCESS",
                                                            message: "Password has been reset successfully"
                                                        })
                                                    })
                                                    .catch(error => {
                                                        // ! ERROR WHILE FINALIZING PASSWORD RESET ! //
                                                        console.log(error)
                                                        res.json({
                                                            status: "FAILED",
                                                            message: "An error occurred while finalizing password reset"
                                                        })
                                                    })
                                            })
                                            .catch(error => {
                                                // ! ERROR WHILE UPDATING USER PASSWORD ! //
                                                console.log(error)
                                                res.json({
                                                    status: "FAILED",
                                                    message: "Updating user password failed"
                                                })
                                            })
                                    })
                                    .catch(error => {
                                        // ! ERROR WHILE HASING NEW PASSWORD ! //
                                        console.log(error)
                                        res.json({
                                            status: "FAILED",
                                            message: "An error occurred while hashing new password"
                                        })
                                    })
                            } else {
                                // ! EXISTING RECORD BUT INCORRECT RESET TOKEN PASSED ! //
                                res.json({
                                    status: "FAILED",
                                    message: "Invalid password reset details passed"
                                })
                            }
                        })
                        .catch(error => {
                            // ! ERROR WHILE COMPARING PASSWORD RESET TOKEN ! //
                            console.log(error)
                            res.json({
                                status: "FAILED",
                                message: "Comparing password reset token failed"
                            })
                        })
                }
            } else {
                // ! PASSWORD RESET RECORD DOESN"T EXIST ! //
                res.json({
                    status: "FAILED",
                    message: "Password reset request not found."
                })
            }
        })
        .catch(error => {
            // ! ERROR WHILE CHECKING FOR EXISTING PASSWORD RESET RECORD FAILED ! //
            console.log(error)
            res.json({
                status: "FAILED",
                message: "Checking for existing password reset record failed."
            })
        })
})

module.exports = router