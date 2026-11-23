// display_data.js
// ----------------------
// Purpose: Exposes REST API endpoints for frontend to access 
// - Endpoints for graph data, path dropdowns, std deviation lines, 
//      taskboard, model output, notifications list, and clearing data

const express = require('express');
const pool = require('../db.js');  // Get connection to DB

const router = express.Router(); // Allows groups of endpoints in multiple files 

// ===== GRAPH DATA ENDPOINTS =====

// Data points for just the top 25 points of each machine feature
router.get('/graph_data', async (req,res) => {
    const { division_id, line_id, machine_id } = req.query;

    if (!machine_id) {
        return res.status(400).send('Machine ID is required');
    }

    try {
        console.log("Running query");
        // Query grabs top 25 points (by timestamp DESC) for each unique machine feature per machine 
        const query_text = `
            WITH ranked AS (
                SELECT *,
                    ROW_NUMBER() OVER (
                        PARTITION BY machine_feature
                        ORDER BY time_stamp DESC
                    ) AS rn
                FROM raw_sensor_readings
                WHERE division_id = $1 AND line_id = $2 AND machine_id = $3
            )
            SELECT time_stamp, machine_feature, value
            FROM ranked
            WHERE rn <= 25
            ORDER BY machine_feature, time_stamp DESC`
        const data = await pool.query(query_text, [division_id, line_id, machine_id]);
        res.json(data.rows);
    }
    catch (err) {
        console.error("Error querying DB:", err);
        res.status(500).send('Database error');
    }
});

// Data points for compressed graph 
router.get('/graph_data_extended', async (req, res) => {
    const { division_id, line_id, machine_id } = req.query;

    const graph_data_extended = await pool.query(`
        SELECT time_stamp, machine_feature, value
        FROM raw_sensor_readings
        WHERE division_id = $1 AND line_id = $2 AND machine_id = $3
        ORDER BY machine_feature, time_stamp DESC`,
        [division_id, line_id, machine_id]
    )
    res.json(graph_data_extended.rows);
});

// Data points from the last 24 hours
router.get('/graph_data_one_day', async (req, res) => {
    const { division_id, line_id, machine_id } = req.query;

    const graph_data_one_day = await pool.query(`
        SELECT time_stamp, machine_feature, value
        FROM raw_sensor_readings
        WHERE division_id = $1 AND line_id = $2 AND machine_id = $3 AND time_stamp >= NOW() - INTERVAL '24 hours'
        ORDER BY machine_feature, time_stamp DESC`,
        [division_id, line_id, machine_id]
    )
    res.json(graph_data_one_day.rows);
});

// Data points from the last 72 hours
router.get('/graph_data_three_days', async (req, res) => {
    const { division_id, line_id, machine_id } = req.query;

    const graph_data_three_days = await pool.query(`
        SELECT time_stamp, machine_feature, value
        FROM raw_sensor_readings
        WHERE division_id = $1 AND line_id = $2 AND machine_id = $3 AND time_stamp >= NOW() - INTERVAL '72 hours'
        ORDER BY machine_feature, time_stamp DESC`,
        [division_id, line_id, machine_id]
    )
    res.json(graph_data_three_days.rows);
});

// Data points from the last week 
router.get('/graph_data_week', async (req, res) => {
    const { division_id, line_id, machine_id } = req.query;

    const graph_data_week = await pool.query(`
        SELECT time_stamp, machine_feature, value
        FROM raw_sensor_readings
        WHERE division_id = $1 AND line_id = $2 AND machine_id = $3 AND time_stamp >= NOW() - INTERVAL '7 days'
        ORDER BY machine_feature, time_stamp DESC`,
        [division_id, line_id, machine_id]
    )
    res.json(graph_data_week.rows);
});

// Standard Deviation for Upper and Lower Bound lines
router.get('/feature_statistics', async (req, res) => {
    const { division, plant, area, subarea, line, station, machine_type, machine_id } = req.query;

    const stats = await pool.query(`
        SELECT machine_feature,
        AVG(value) as mean,
        STDDEV(value) as std_dev,
        AVG(value) + 2*STDDEV(value) as upper_bound,
        AVG(value) - 2*STDDEV(value) as lower_bound,
        COUNT(*) as sample_count
        FROM raw_sensor_readings
        WHERE division_id = $1 AND plant_id = $2 AND area_id = $3 AND subarea_id = $4 AND line_id = $5 AND station_id = $6 AND machine_type_id = $7 AND machine_id = $8
        GROUP BY machine_feature`,
        [division, plant, area, subarea, line, station, machine_type, machine_id]
    );
    
    res.json(stats.rows);
});



// ===== DROP DOWN ENDPOINTS =====

// Grab all unique division for division drop down menu 
router.get('/divisions', async (req, res) => {
    console.log("In divisons!");
    const divisions = await pool.query("SELECT DISTINCT division_id FROM raw_sensor_readings");
    res.json(divisions.rows);
});

// Grab all unique plants for plant drop down menu 
router.get('/plants', async (req, res) => {
    console.log("In plants!");
    const { division } = req.query
    
    const plants = await pool.query(`
        SELECT DISTINCT plant_id
        FROM raw_sensor_readings
        WHERE division_id = $1`,
    [division]);
    res.json(plants.rows);
});

// Grab all unique area for area drop down menu 
router.get('/areas', async (req, res) => {
    console.log("In areas!");
    const { division, plant } = req.query
    
    const areas = await pool.query(`
        SELECT DISTINCT area_id
        FROM raw_sensor_readings
        WHERE division_id = $1 AND plant_id = $2`,
    [division, plant]);
    res.json(areas.rows);
});

// Grab all unique subareas for subareas drop down menu 
router.get('/subareas', async (req, res) => {
    console.log("In subareas!");
    const { division, plant, area } = req.query
    
    const subareas = await pool.query(`
        SELECT DISTINCT subarea_id
        FROM raw_sensor_readings
        WHERE division_id = $1 AND plant_id = $2 AND area_id = $3`,
    [division, plant, area]);
    res.json(subareas.rows);
});

// Grab all unique lines for lines drop down menu 
router.get('/lines', async (req, res) => {
    console.log("In lines!");
    const { division, plant, area, subarea } = req.query
    
    const lines = await pool.query(`
        SELECT DISTINCT line_id
        FROM raw_sensor_readings
        WHERE division_id = $1 AND plant_id = $2 AND area_id = $3 AND subarea_id = $4`,
    [division, plant, area, subarea]);
    res.json(lines.rows);
});

// Grab all unique stations for stations drop down menu 
router.get('/stations', async (req, res) => {
    console.log("In stations!");
    const { division, plant, area, subarea, line } = req.query
    
    const stations = await pool.query(`
        SELECT DISTINCT station_id
        FROM raw_sensor_readings
        WHERE division_id = $1 AND plant_id = $2 AND area_id = $3 AND subarea_id = $4 AND line_id = $5`,
    [division, plant, area, subarea, line]);
    res.json(stations.rows);
});

// Grab all unique machine types for machine types drop down menu 
router.get('/machine_types', async (req, res) => {
    console.log("In machine_types!");
    const { division, plant, area, subarea, line, station } = req.query
    
    const machine_types = await pool.query(`
        SELECT DISTINCT machine_type_id
        FROM raw_sensor_readings
        WHERE division_id = $1 AND plant_id = $2 AND area_id = $3 AND subarea_id = $4 AND line_id = $5 AND station_id = $6`,
    [division, plant, area, subarea, line, station]);
    res.json(machine_types.rows);
});

// Grab all unique machines for machine drop down 
router.get('/machines', async (req, res) => {
    console.log("In machines!");
    const { division, plant, area, subarea, line, station, machine_type } = req.query
    
    const machines = await pool.query(`
        SELECT DISTINCT machine_id
        FROM raw_sensor_readings
        WHERE division_id = $1 AND plant_id = $2 AND area_id = $3 AND subarea_id = $4 AND line_id = $5 AND station_id = $6 AND machine_type_id = $7`,
    [division, plant, area, subarea, line, station, machine_type]);
    res.json(machines.rows);
});

// Grab all unique machine features for machine features drop down
router.get('/machine_features', async (req, res) => {
    const { division, line, machine } = req.query
    const machine_features = await pool.query(`
        SELECT DISTINCT machine_feature 
        FROM raw_sensor_readings 
        WHERE division_id = $1 AND line_id = $2 AND machine_id = $3`,
        [division, line, machine]
    );
    res.json(machine_features.rows);
});

// ===== LOG DATA =====

// Grab timestamp and value for specific machine feature 
router.get('/log_data', async (req, res) => {
    const { division, line, machine, machine_feature } = req.query
    const log_data = await pool.query(`
        SELECT time_stamp, value
        FROM raw_sensor_readings
        WHERE division_id = $1 AND line_id = $2 AND machine_id = $3 AND machine_feature = $4
        ORDER BY time_stamp DESC
        LIMIT 25`,
        [division, line, machine, machine_feature]
    );
    res.json(log_data.rows);
});

// ===== TASKBOARD ENDPOINTS =====

// Grab the model output for each unique machine within a specific division and line
router.get('/machine_model_output', async (req, res) => {
    const { division, line } = req.query
    const machine_features = ["rms", "max", "kurtosis", "std"]
    const model_output = await pool.query(`
        SELECT DISTINCT ON (machine_id) machine_id, time_stamp, machine_features, model_output_value
        FROM model_output
        WHERE division_id = $1 AND line_id = $2 AND machine_features @> $3::jsonb
        ORDER BY machine_id, time_stamp DESC`,
        [division, line, JSON.stringify(machine_features)]
    );
    res.json(model_output.rows)
});

// ===== MODEL OUTPUT DISPLAYED AFTER MACHINE FEATURES SELECTED =====

router.get('/model_output', async (req, res) => {
    const { division, line, machine } = req.query
    const query_text = `
        SELECT time_stamp, machine_features, model_output_value
        FROM model_output
        WHERE division_id = $1 AND line_id = $2 AND machine_id = $3
        ORDER BY time_stamp DESC
        LIMIT 1`
    const model_output = await pool.query(query_text, [division, line, machine]);
    res.json(model_output.rows);
})

// Get the most recent rul for a specific machine
router.get('/rul', async (req, res) => {
    const { division, plant, area, subarea, line, station, machine_type, machine } = req.query
    const query_text = `
        SELECT time_stamp, rul
        FROM model_output
        WHERE division_id = $1
            AND plant_id = $2
            AND area_id = $3
            AND subarea_id = $4
            AND line_id = $5
            AND station_id = $6
            AND machine_type_id = $7
            AND machine_id = $8
        ORDER BY time_stamp DESC
        LIMIT 1`
    const rul = await pool.query(query_text, [division, plant, area, subarea, line, station, machine_type, machine]);
    res.json(rul.rows);
})

// ===== NOTIFCATION LIST =====

// Adding users to notification list
router.get('/add_to_notification_list', async (req, res) => {
    const { email, division, line , machine, plant, area, subarea, station, machine_type} = req.query
    const insert = await pool.query(
        "INSERT INTO notification_list (email,division,line,machine,plant,area,subarea,station,machine_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING;", [email, division, line, machine, plant, area, subarea, station, machine_type]);
    res.json(insert.rows);
})

// Reading values from notification list
router.get('/read_from_notification_list', async (req, res) => {
    const noti_list = await pool.query(
        `SELECT email,division,line,machine,plant,area,subarea,station,machine_type FROM notification_list;`);
    res.json(noti_list.rows);
})

// Deleting values from notification list
router.get('/deleting_from_notification_list', async (req, res) => {
    const { email, division, line , machine, plant, area, subarea, station, machine_type} = req.query
    const delete_noti = await pool.query(
        `DELETE FROM notification_list
            WHERE email = $1
            AND division = $2
            AND line = $3
            AND machine = $4
            AND plant = $5
            AND area = $6
            AND subarea = $7
            AND station = $8
            AND machine_type = $9;`, [email, division, line, machine, plant, area, subarea, station, machine_type]);
    res.json(delete_noti.rows);
})

// Updating last sent timestamp in notification list
router.get('/update_last_sent_timestamp', async (req, res) => {
    const { email, division, line , machine, plant, area, subarea, station, machine_type} = req.query
    const update_noti = await pool.query(
        `UPDATE notification_list
            SET last_notified_at = NOW()
            WHERE email = $1
            AND division = $2
            AND line = $3
            AND machine = $4
            AND plant = $5
            AND area = $6
            AND subarea = $7
            AND station = $8
            AND machine_type = $9
            AND (last_notified_at IS NULL OR NOW() - last_notified_at >= INTERVAL '15 minutes')
            RETURNING 1;`, [email, division, line, machine, plant, area, subarea, station, machine_type]);
    res.json(update_noti.rows);
})

// ===== ADMIN TABLE =====

// Reading values from admin list
router.get('/read_from_admin_list', async (req, res) => {
    const admin_list = await pool.query(
        `SELECT email FROM admin_list;`);
    res.json(admin_list.rows);
})

// ===== CLEARING DATA =====

// Clear values from raw sensor readings
router.get('/clear_from_raw_sensor_readings', async (req, res) => {
    const {division, plant, area, subarea, line, station, machine_type, machine} = req.query
    const clear_sensor_data = await pool.query(
        `DELETE FROM raw_sensor_readings
            WHERE division_id = $1
            AND plant_id = $2
            AND area_id = $3
            AND subarea_id = $4
            AND line_id = $5
            AND station_id = $6
            AND machine_type_id = $7
            AND machine_id = $8;`, [division, plant, area, subarea, line, station, machine_type, machine]);
    res.json(clear_sensor_data.rows);
})

// Clear values from model output
router.get('/clear_from_model_output', async (req, res) => {
    const {division, plant, area, subarea, line, station, machine_type, machine} = req.query
    const clear_model_data = await pool.query(
        `DELETE FROM model_output
            WHERE division_id = $1
            AND plant_id = $2
            AND area_id = $3
            AND subarea_id = $4
            AND line_id = $5
            AND station_id = $6
            AND machine_type_id = $7
            AND machine_id = $8;`, [division, plant, area, subarea, line, station, machine_type, machine]);
    res.json(clear_model_data.rows);
})

module.exports = router; // Allows other files to use router

