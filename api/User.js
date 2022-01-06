const express = require('express')
const router = express.Router()
// *mongodb user model
const User = require('./../models/User')

// *mongodb user verification model
const UserVerification = require('./../models/UserVerification')

// ? HANDLER ? //
// *password handler (crypt)
const bcrypt = require('bcrypt')

// *email handler
const nodemailer = require('nodemailer')

// *unique string (TOKEN) handler
const { v4: uuidv4 } = require('uuid')


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

// ! TESTING TRANSPORTER
transporter.verify((error, success) => {
    if (error) {
        console.log(error)
    } else {
        console.log("Ready to send message")
        console.log("Success: " + success)
    }
})

// *Signup
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

// ? SEND VERIFICATION EMAIL
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

// ? verify Email
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
// ? verified page
router.get('/verified', (req, res) => {
    res.sendFile(path.join(__dirname, "./../views/verified.html"))
})

// *Signin
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

module.exports = router