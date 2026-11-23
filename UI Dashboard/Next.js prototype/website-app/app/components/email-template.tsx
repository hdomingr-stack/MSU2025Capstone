import * as React from 'react';
import { ru } from 'zod/locales';

export const EmailTemplate = ({
    division, line, machine, plant, area, subarea, station, machine_type, anomaly
}: {
    division: string;
    line: string;
    machine: string;
    plant: string;
    area: string;
    subarea: string;
    station: string;
    machine_type: string;
    anomaly: boolean;
}) => {
    return (
        <div style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6", color: "#333" }}>
            <h1>Machine Anomoly Detected</h1>
            <p>
                The monitoring system has detected an anomaly for <strong>{machine}</strong> 
                ({machine_type}) located at:
            </p>

            <ul>
                <li><strong>Division:</strong> {division}</li>
                <li><strong>Plant:</strong> {plant}</li>
                <li><strong>Area:</strong> {area}</li>
                <li><strong>Subarea:</strong> {subarea}</li>
                <li><strong>Line:</strong> {line}</li>
                <li><strong>Station:</strong> {station}</li>
            </ul>
            <p> Have a great day! </p>
            <p style={{ fontSize: "12px", color: "#676" }}>
                This is an automated message. To unsubscribe please go to the 
                settings page and update your email preferences. 
                or click <a href="http://localhost:3000/unsubscribe">here</a>.
            </p>
        </div>
    );
};