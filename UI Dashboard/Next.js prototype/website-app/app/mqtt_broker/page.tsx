"use client";

import React, { useState } from "react"; // Lets us store user input
import Image from "next/image";
import Link from "next/link";
import styles from "./mqtt_broker.module.css"
import { useSession } from "next-auth/react";
import Header from "../components/Header";
import { NotificationChecker } from "../components/notification-checker"

export default function MqttBroker() {

    // User inputed variables
    // REPLACE USESTATE WITH "" FOR HOST, USERNAME, AND PASSWORD AFTER TESTING
    const [host, setHost] = useState("726a83878f5a4f1088356946c77706d2.s1.eu.hivemq.cloud");
    const [port, setPort] = useState("8883"); // Default port for mqtt protocol
    const [username, setUsername] = useState("Sprin107");
    const [password, setPassword] = useState("{wcco[M{lj[@4uy*W5j&jv(5)6TciPdE"); 
    
    const { data: session} = useSession();

    function onSubmit(e: React.FormEvent) { // e is the event and its a form event 
        e.preventDefault(); // Stop the page from refreshing so data doesnt get lost 

        if (!session?.user){
            return alert("You must be logged in");
        }

        const user_id = session.user.id // Receive googles unique id for current user

        const broker_data = {
            user_id: user_id,
            host, 
            port: parseInt(port), // Make sure port is a number
            username,
            password
        };

        console.log("sending broker data:", broker_data);

        // Call the connect broker endpoint
        fetch("http://18.119.9.9:4000/connect_broker", {
            method: "POST",
            headers: { "Content-Type": "application/json"},
            body: JSON.stringify(broker_data) // Submit the input data 
        })
        .then(res => res.json())
        .then(data => {
            console.log("Backend response: ", data);

            if (data.status === "connected") {
                alert(`Connected to broker ${data.broker}`);
                window.location.href = "/dashboard"; // Move to dashboard page

            } else {
                alert("Failed to connect;");
            }
        })
        .catch(err => {
            console.error("Error connecting to broker: ", err);
            alert("Error connecting to broker");
        })
    }

    return (
        <div>
            {/* === NOTIFICATION CHECKER === */}
            <NotificationChecker />

            {/* === HEADER === */}
            <Header pageName="MQTT Broker"/>
            <main className={styles.page}>
                <form className={styles.card} onSubmit={onSubmit} aria-labelledby="mqtt-heading">
                    <h1 id="mqtt-header" className={styles.title}>MQTT Broker Connection</h1>
                    <label className={styles.label}>
                            <span>Host</span>
                            <input className={styles.input}
                            value={host} 
                            onChange={(e) => setHost(e.target.value)} />
                    </label>

                    <label className={styles.label}>
                            <span>Port</span>
                            <input className={styles.input} 
                            value={port} 
                            onChange={(e) => setPort(e.target.value)} 
                            placeholder="8883"/>
                    </label>

                    <label className={styles.label}>
                            <span>Username</span>
                            <input className={styles.input} 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} />
                    </label>

                    <label className={styles.label}>
                            <span>Password</span>
                            <input className={styles.input} 
                            value={password} 
                            type="password"
                            onChange={(e) => setPassword(e.target.value)} />
                    </label>

                    <div className={styles.buttonRow}>
                        <button className={styles.button} type="button" onClick={() => (window.location.href = "/login")}>Back</button>
                        <button className={styles.button} type="submit">Connect</button>
                    </div>
                </form>
            </main>
        </div>
    );
}