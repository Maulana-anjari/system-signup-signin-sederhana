// we can put any data from .env file with this
require('dotenv').config()
const mongoose = require('mongoose')
mongoose
.connect(process.env.MONGODB_URI_V2, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log("DB Connected")
})
.catch((err) => console.log(err))