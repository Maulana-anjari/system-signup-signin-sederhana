const mongoose = require('mongoose')
const Schema = mongoose.Schema
const UserVerificationSchema = new Schema({
    userId: String,
    token: String,
    createdAt: Date,
    expiresAt: Date
})

// create with singular name of collection then mongodb creating plural name
const UserVerification = mongoose.model('UserVerification', UserVerificationSchema)
module.exports = UserVerification