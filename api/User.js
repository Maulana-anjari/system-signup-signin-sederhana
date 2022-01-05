const express = require('express')
const router = express.Router()
// *mongodb user model
const User = require('./../models/User')
// *mongodb user verification model
const UserVerification = require('./../models/UserVerification')
// ? HANDLER
// *password handler (crypt)
const bcrypt = require('bcrypt')
// *email handler
const nodemailer = require('nodemailer')
// *unique string (TOKEN) handler
const {v4: uuidv4} = require('uuid')

// *env variables
require('dotenv').config()
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
    if(error) {
        console.log(error)
    } else {
        console.log("Ready for message")
        console.log(success)
    }
})

// *Signup
router.post('/signup', (req, res) => {
    let {name, email, password, dateOfBirth} = req.body
    name = name.trim()
    email = email.trim()
    password = password.trim()
    dateOfBirth = dateOfBirth.trim()
    // validation form
    // if empty input value
    if  (name == "" || email == "" || password == "" || dateOfBirth == "") {
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
        User.find({email}).then(result => {
            if (result.length){
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
const sendVerificationEmail = ({_id, email}, res) => {
    // url to be used in the email
    const currentUrl = "http://localhost:3000/"
    const token = uuidv4() + _id // ? unique string
    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email, // put from param result
        subject: "Verify Your Email",
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
                            message: "Verivication email sent"
                        })
                    })
                    .catch((error) => {
                        console.log(error)
                        res.json({
                            status: "FAILED",
                            message: "Verivication email failed!"
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

// *Signin
router.post('/signin', (req, res) => {
    let {email, password} = req.body
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
        User.find({email})
        .then(data => {
            if (data.length) {
                // User exist
                const hashedPassword = data[0].password
                bcrypt.compare(password, hashedPassword).then(result => {
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