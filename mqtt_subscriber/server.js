// server.js
// ----------------------
// Purpose: Includes REST API endpoints to connect to MQTT broker and alter pipeline 

const express = require('express');
const cors = require('cors');
const { connect_user_to_broker, check_connection, upsert_user_mqtt_connection, has_user_connected, send_reset_baseline, send_machine_features } = require('./mqtt_subscriber')

const app = express(); // Create express app to handle requests and routes
app.use(express.json()); // Parses the incoming data 
app.use(cors()); // Allow anyone to make requests to backend


app.post('/connect_broker', async (req, res) => {
    console.log("Made it to connect_broker endpoint");

    const { user_id, host, port, username, password } = req.body;

    // Add connectionTimeout - MQTT own internal limit
    const options = { user_id, host, port, username, password, connectionTimeout : 10000 }; 

    try {
        // Connect to broker
        const result = await connect_user_to_broker(options, 2000); // If connection does not work within 3 seconds, sended failed response
        console.log("No errors connecting to mqtt broker!");

        // Store broker info with user id
        const success = upsert_user_mqtt_connection({ user_id, host, port, username, password });
        if (!success){
            throw new Error("Inserting user in db was unsuccessful");
        }

        res.json(result);
    } catch (error) {
        console.log("Error: ", error);
        res.status(400).json({ error: error.message });
    }
});

// See if connection is still alive in the backend
app.get('/check_connection', (req, res) => {
    const { user_id } = req.query;
    const status = check_connection(user_id);
    res.json(status);
})

// Checks if user has connected to mqtt broker before
app.post('/check_login', async (req, res) => {
    console.log("in check_log function");
    const { user_id } = req.body;

    try {
        const result = await has_user_connected(user_id);
        console.log("just ran the function to see if user has connected to broker");
        res.json(result);
    } catch (err) {
        console.log("theres an error");
        res.status(500).json({ error : 'Failed to check if user has logged in before' })
    }
});

// Reset baseline by sending topic path to hivemq topic
app.post('/reset_baseline', async (req, res) => {
    const { user_id, division, plant, area, subarea, line, station, machine_type, machine } = req.body;

    const topic_path = `m/${division}/${plant}/${area}/${subarea}/line/${line}/st/${station}/${machine_type}/${machine}`

    try {
        // Send to function 
        await send_reset_baseline(topic_path, user_id);
        res.json({ status : "success", message : "Reset baseline!"});

    } catch (err) {
        console.error("Theres an error when reseting baseline: ", err);
        res.status(500).json({ status : "error", message : "Failed to reset baseline" })
    } 
});

// Reset baseline by sending topic path to hivemq topic
app.post('/send_machine_features', async (req, res) => {
    console.log("In send_machine_features")
    const { user_id, division, plant, area, subarea, line, station, machine_type, machine, selected_features } = req.body;

    const topic_path = `m/${division}/${plant}/${area}/${subarea}/line/${line}/st/${station}/${machine_type}/${machine}`

    try {
        // Send to function 
        await send_machine_features(topic_path, user_id, selected_features);
        console.log("Success in send_machine_features")
        res.json({ status : "success", message : "Sent selected features!"});
        
    } catch (err) {
        console.error("Theres an error when sending machine features: ", err);
        console.log("Error in send_machine_features")
        res.status(500).json({ status : "error", message : "Failed to send machine features" })
    } 
});

const PORT = 4000; // Port where the backend will listen for requests
app.listen(PORT, '0.0.0.0', () =>
    console.log("Sucessfully listening on port 4000!")
);

