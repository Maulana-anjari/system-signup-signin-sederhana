// Mongo DB
require('./config/db')

const express = require('express')
const port = process.env.PORT || 3000
const app = express()

// For accespting post form data, must called before any route API
app.use(express.json())
// API
const UserRouter = require('./api/User')
// Using API
app.use('/user', UserRouter)
app.get('/', (req, res) => {
    res.send('HELLO')
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})