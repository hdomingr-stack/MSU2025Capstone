// backend.js
// ----------------------
// Purpose: Initializes an express app and sets up routing 

const express = require('express');
const displayed_data_routes = require('./routes/displayed_data.js');
const cors = require('cors');

const app = express(); // Create express app to handle requests and routes
app.use(express.json()); // Parses the incoming data 
app.use(cors()); // Allow anyone to make requests to backend

app.use('/data', displayed_data_routes); // All requests with '/data' will move to another file

const PORT = 3000; // Port where the backend will listen for requests
app.listen(PORT, '0.0.0.0', () =>
    console.log("Sucessfully listening on port 3000!")
);