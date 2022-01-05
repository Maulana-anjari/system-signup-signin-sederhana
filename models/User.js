const mongoose = require('mongoose')
const Schema = mongoose.Schema
const UserSchema = new Schema({
    name: String,
    email: String,
    password: String,
    dateOfBirth: Date
})

// create with singular name (user) of collection then mongodb creating plural name (users)
const User = mongoose.model('user', UserSchema)
module.exports = User