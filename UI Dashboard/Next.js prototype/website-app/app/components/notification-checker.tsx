"use client";

import { useEffect } from "react";

type Notification = {
  email: string;
  division: string;
  line: string;
  machine: string;
  plant: string;
  area: string;
  subarea: string;
  station: string;
  machine_type: string;
};

const POLL_INTERVAL = 60000; // 1 minute

export function NotificationChecker() {
    useEffect(() => {
        let cancelled = false;

        /* Function to check for notifications */
        const checkNotifications = async () => {
            if (cancelled) return;

            /* Pulls notification list */
            const notiRes = await fetch(
            `http://18.119.9.9:3000/data/read_from_notification_list`
            );
            if (!notiRes.ok) throw new Error(`HTTP error: ${notiRes.status}`);
            const notificationsList: Notification[] = await notiRes.json();

            /* Division */
            const divRes = await fetch(
                `http://18.119.9.9:3000/data/divisions`
            );
            if (!divRes.ok) throw new Error(`HTTP error: ${divRes.status}`);
            const divJson = await divRes.json(); 

            for (const divObj of divJson) {

                /* Plants */
                 const plantRes = await fetch(
                    `http://18.119.9.9:3000/data/plants?division=${divObj.division_id}`
                );
                if (!plantRes.ok) throw new Error(`HTTP error: ${plantRes.status}`);
                const plantJson = await plantRes.json();
                console.log("Fetched plant data:", plantJson);

                for (const plantObj of plantJson){

                    /* Areas */
                    const areaRes = await fetch(
                        `http://18.119.9.9:3000/data/areas?division=${divObj.division_id}&plant=${plantObj.plant_id}`
                    );
                    if (!areaRes.ok) throw new Error(`HTTP error: ${areaRes.status}`);
                    const areaJson = await areaRes.json();
                    console.log("Fetched area data:", areaJson);

                    for (const areaObj of areaJson){

                        /* Subareas */
                        const subareaRes = await fetch(
                            `http://18.119.9.9:3000/data/subareas?division=${divObj.division_id}&plant=${plantObj.plant_id}&area=${areaObj.area_id}`
                        );
                        if (!subareaRes.ok) throw new Error(`HTTP error: ${subareaRes.status}`);
                        const subareaJson = await subareaRes.json();
                        console.log("Fetched subarea data:", subareaJson);

                        for (const subareaObj of subareaJson){
                            /* Line */
                            const lineRes = await fetch(
                                `http://18.119.9.9:3000/data/lines?division=${divObj.division_id}&plant=${plantObj.plant_id}&area=${areaObj.area_id}&subarea=${subareaObj.subarea_id}`
                            );
                            if (!lineRes.ok) throw new Error(`HTTP error: ${lineRes.status}`);
                            const lineJson = await lineRes.json();
                            
                            for (const lineObj of lineJson) {

                                /* Station */
                                const stationRes = await fetch(
                                    `http://18.119.9.9:3000/data/stations?division=${divObj.division_id}&plant=${plantObj.plant_id}&area=${areaObj.area_id}&subarea=${subareaObj.subarea_id}&lines=${lineObj.line_id}`
                                );
                                if (!stationRes.ok) throw new Error(`HTTP error: ${stationRes.status}`);
                                const stationJson = await stationRes.json();

                                for ( const stationObj of stationJson) {

                                    /* Machine Type */
                                    const machineTypeRes = await fetch(
                                        `http://18.119.9.9:3000/data/machine_types?division=${divObj.division_id}&plant=${plantObj.plant_id}&area=${areaObj.area_id}&subarea=${subareaObj.subarea_id}&lines=${lineObj.line_id}&station=${stationObj.station_id}`
                                    );
                                    if (!machineTypeRes.ok) throw new Error(`HTTP error: ${machineTypeRes.status}`);
                                    const machineTypeJson = await machineTypeRes.json();

                                    for( const machineTypeObj of machineTypeJson){

                                        /* Machine Output */
                                        const machineRes = await fetch(
                                            `http://18.119.9.9:3000/data/machine_model_output?division=${divObj.division_id}&line=${lineObj.line_id}`
                                        );
                                        if (!machineRes.ok) throw new Error(`HTTP error: ${machineRes.status}`);
                                        const machineJson = await machineRes.json();

                                        for (const machineObj of machineJson) {
                                            for (const notification of notificationsList) {
                                                //console.log(notification.division === "ALL", notification.line === "ALL", notification.machine === "ALL", machineObj.model_output_value, lineObj.line_id);
                                                if (
                                                    (notification.division === divObj.division_id || notification.division.trim().toUpperCase() === "ALL") &&
                                                    (notification.line === lineObj.line_id || notification.line.trim().toUpperCase() === "ALL")&&
                                                    (notification.machine === machineObj.machine_id || notification.machine.trim().toUpperCase() === "ALL")
                                                ) {
                                                    if (machineObj.model_output_value === true) {
                                                        // Send email notification
                                                        console.log(divObj.division_id, lineObj.line_id, machineObj.machine_id)
                                                        await fetch("/api/send", {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({
                                                                to: notification.email,
                                                                match: 
                                                                {
                                                                    division: notification.division,
                                                                    line: notification.line,
                                                                    machine: notification.machine,
                                                                    plant: notification.plant,
                                                                    area: notification.area,
                                                                    subarea: notification.subarea,
                                                                    station: notification.station,
                                                                    machine_type: notification.machine_type,
                                                                },
                                                                email: {
                                                                    division: divObj.division_id,
                                                                    line: lineObj.line_id,
                                                                    machine: machineObj.machine_id,
                                                                    plant: plantObj.plant_id,
                                                                    area: areaObj.area_id,
                                                                    subarea: subareaObj.subarea_id,
                                                                    station: stationObj.station_id,
                                                                    machine_type: machineTypeObj.machine_type_id,
                                                                },
                                                                anomaly: machineObj.model_output_value
                                                            }),
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        checkNotifications();
        const intervalId = setInterval(checkNotifications, POLL_INTERVAL);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        }
    }, []);

    return null;
}