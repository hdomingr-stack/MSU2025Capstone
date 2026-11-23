// mqtt_subscriber.js
// ----------------------
// Purpose: Handles MQTT broker interactions and updates to the ROS2 pipeline
// - Inserts raw and model output data in PostgreSQL database
// - Connects to MQTT broker 
// - Stores user and MQTT broker credentials together
// - Sends pipeline updates for reset baseline and feature selection features

const mqtt = require('mqtt'); // Loads mqtt library 
const { Client } = require('pg'); // Grab client class from postgreSQL

const RAW_TOPIC = "raw_data"
const MODEL_OUTPUT_TOPIC = "model_output_data" 
const CONTROL_TOPIC = "control"

// PostgreSQL Connection Info
const db_host = "localhost"
const db_user = "post_user"
const db_pass = "MagnaAI498FS"
const db_db = "cse486db"
const db_port = 5432

//  ===== INSERT DATA FUNCTIONS =====

// Insert raw data into raw data table when message comes from raw data topic
async function insert_raw_data(message, broker){
    try {
        const json_msg = JSON.parse(message.toString());

        console.log('Messaged received:', json_msg);

        const query = "INSERT INTO raw_sensor_readings VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)";
        await dbClient.query(query, [json_msg.time_stamp, json_msg.topic_path, json_msg.division_id, json_msg.line_id, json_msg.machine_id, json_msg.machine_feature, json_msg.value, broker, json_msg.plant_id, json_msg.area_id, json_msg.subarea_id, json_msg.station_id, json_msg.machine_type_id]);

    } catch (err) {
        console.error("Error inserting data:", err)
    } 
}

// Insert model output data into model output table when message comes from model output topic 
async function insert_model_output_data(message, broker){
    try {
        const json_msg = JSON.parse(message.toString());

        console.log('Messaged received:', json_msg);

        // Convert to string to insert into db
        const machine_features = JSON.stringify(json_msg.machine_features);

        const query = "INSERT INTO model_output VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)";
        await dbClient.query(query, [json_msg.time_stamp, json_msg.topic_path, json_msg.division_id, json_msg.line_id, json_msg.machine_id, machine_features, json_msg.model_output_value, broker, json_msg.plant_id, json_msg.area_id, json_msg.subarea_id, json_msg.station_id, json_msg.machine_type_id, json_msg.model_rul]);

    } catch (err) {
        console.error("Error inserting data:", err)
    } 
}

// ===== POSTGRESQL CONNECTION =====

const dbClient = new Client({
    host: db_host, user: db_user, password: db_pass, database: db_db, port: db_port
});

dbClient.connect()
    .then(() => console.log("Successfully connected to PostgreSQL!"))
    .catch(err => console.error("Connection failed because of:", err));

// ===== MQTT BROKER CONNECTION =====

// User id is the key, current client is the value 
// Used to store the active clients per user
const broker_clients = {};

async function connect_user_to_broker({ user_id, host, port, username, password, connectionTimeout}, timeout_time) {

    // Create a promise (future result of function )
    const client_promise = new Promise((resolve, reject) => {
        if (!user_id || !host || !port) {
            return reject(new Error("Missing required fields"));
        }

        // If user was connected to a broker previously, disconnect and connect again 
        if (broker_clients[user_id]) {
            broker_clients[user_id].end(true);
        }

        const options = { username, password, connectionTimeout };
        const client = mqtt.connect(`mqtts://${host}:${port}`, options);
        client.broker = `${host}:${port}`;
        console.log("Broker:", client.broker);

        client.on('connect', () => {
            console.log(`User ${user_id} connected to broker ${host}:${port}`);
            
            // Subscribe to raw data topic
            client.subscribe(RAW_TOPIC, (err) => {
                if (err) {
                    console.error("Did not connect to topic because of:", err);
                }
                else {
                    console.log("Successfully connected to topic:", RAW_TOPIC);
                }
            })

            // Subscribe to model output data topic
            client.subscribe(MODEL_OUTPUT_TOPIC, (err) => {
                if (err) {
                    console.error("Did not connect to topic because of:", err);
                }
                else {
                    console.log("Successfully connected to topic:", MODEL_OUTPUT_TOPIC);
                }
            })

            // Add user and client to the active clients dictionary 
            broker_clients[user_id] = client;

            resolve({ status: "connected", broker: `${host}:${port}` });
        });

        client.on('message', async (topic, message) => {
            const broker = client.broker
            if (topic === RAW_TOPIC) {
                insert_raw_data(message, broker);
            }
            else if (topic === MODEL_OUTPUT_TOPIC) {
                insert_model_output_data(message, broker)
            }
        });

        client.on('error', (err) => {
            console.error('Connection error:', err);

            client.end(true);

            // Delete client 
            delete broker_clients[user_id];

            reject(new Error(`Failed to connect to broker: ${err.message}`));
        });
    });

    // Create another promise which returns "failed connection" after the set amount of time 
    const timeout_promise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Connection attempt timed out")), timeout_time);
    });

    // Return whichever promise occurs first 
    return Promise.race([client_promise, timeout_promise]);
}

// With the user_id, check if the client still exists 
// This ensures that the client did not end after moving to dashboard page
function check_connection(user_id) {
    const client = broker_clients[user_id];
    if (!client){
        console.log("No client found");
        return { connected: false, message: "No client found"};
    }
    console.log("Client found!");
    return { connected: client.connected, message: "Client found!"};
}

// When user connects to broker, store broker info into table with user_id
async function upsert_user_mqtt_connection({ user_id, host, port, username, password }){
    try {
        // If user_id already exists, update row with new mqtt broker. Else, add new row 
        const upsert_query = `
            INSERT INTO mqtt_broker_user_connections (user_id, broker, host, port, username, password)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id)
            DO UPDATE SET broker = EXCLUDED.broker,
            host = EXCLUDED.host,
            port = EXCLUDED.port,
            username = EXCLUDED.username,
            password = EXCLUDED.password;
        `;
        const broker = `${host}:${port}`;
        await dbClient.query(upsert_query, [user_id, broker, host, port, username, password]);
        return true; // Error checking

    } catch (err) {
        console.error("Error inserting data:", err);
        return false; // Error checking
    }
}

// Checks if user has made an mqtt broker connection before and starts that client if client ended
async function has_user_connected(user_id) {
    try {
        const user_row = await dbClient.query(`
            SELECT *
            FROM mqtt_broker_user_connections
            WHERE user_id = $1`, 
            [user_id]);
        
        // User does not exist in the table, so no previous mqtt broker connection 
        if (user_row.rows.length === 0){
            return { first_login : true }
        }

        const broker_info = user_row.rows[0];

        // Server must have restarted so all previous clients were closed and needs to be restarted 
        if (!broker_clients[user_id]){
            await connect_user_to_broker({
                user_id,
                host: broker_info.host,
                port: broker_info.port,
                username: broker_info.username,
                password: broker_info.password,
                connectionTimeout : 10000
            }, 2000);
        } 

        return { first_login : false, status : 'connected'};

    } catch (err) {
        throw err;
    }
}

function send_reset_baseline(topic_path, user_id){
    return new Promise((resolve, reject) => {
        // Get the mqtt client associated with user
        const client = broker_clients[user_id];

        if (!client) return reject(new Error(`No MQTT client for user ${user_id}`));

        const payload = {
            "command": "reset_baseline",
            "machine_path": topic_path
        };

        client.publish(CONTROL_TOPIC, JSON.stringify(payload), (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function send_machine_features(topic_path, user_id, selected_features){
    return new Promise((resolve, reject) => {
        // Get the mqtt client associated with user
        const client = broker_clients[user_id];

        if (!client) return reject(new Error(`No MQTT client for user ${user_id}`));

        const all_features = ['RMS', 'STD', 'Max', 'Kurtosis'];

        const included_features = {};

        // Create dictionary with all machine features with 1 if features in, 0 if not 
        all_features.forEach(f => {
            included_features[f] = selected_features.includes(f) ? 1 : 0;
        })

        const payload = {
            "command": "set_flags",
            "machine_path": topic_path,
            "rms": included_features['RMS'],
            "max": included_features['Max'],
            "std": included_features['STD'],
            "kurtosis": included_features['Kurtosis']
        };

        client.publish(CONTROL_TOPIC, JSON.stringify(payload), (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// All functions used that needs to be imported in other files (server.js)
module.exports = { connect_user_to_broker, 
    check_connection, 
    upsert_user_mqtt_connection, 
    has_user_connected,
    send_reset_baseline,
    send_machine_features
};


