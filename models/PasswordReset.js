const mongoose = require('mongoose')
const Schema = mongoose.Schema
const PasswordResetSchema = new Schema({
    userId: String,
    resetToken: String,
    createdAt: Date,
    expiresAt: Date
})

// create with singular name (PasswordReset) of collection then mongodb creating plural name (PasswordResets)
const PasswordReset = mongoose.model('PasswordReset', PasswordResetSchema)
module.exports = PasswordReset