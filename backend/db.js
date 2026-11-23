// db.js
// ----------------------
// Purpose: Creates a connection pool with PostgreSQL database credentials 

const pkg = require('pg');
const { Pool } = pkg; // Connection pool - allows multiple database connections at once

// Connect to db on server
const HOST = "localhost"
const USER = "post_user"
const PASS = "MagnaAI498FS"
const DB = "cse486db"
const PORT = 5432

// Export allows other files to use connection "pool"
const pool = new Pool({host : HOST, port : PORT, 
    user : USER, password : PASS, database : DB});

// Connect to DB
pool.connect()
    .then(() => console.log("Database connected to backend"))
    .catch(err => console.log("Database connection failed. Error:", err));

module.exports = pool;