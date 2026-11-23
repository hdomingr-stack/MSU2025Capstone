"user client";

import React from 'react';
import { createPortal } from "react-dom";

type SettingsProps = {
  trigger: boolean;
  setTrigger: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function Settings({trigger, setTrigger}: SettingsProps) {
    if (!trigger) return null;
  const overlay = (
    <div className="popup">
        <div className="popup-inner">
            <button 
                className="close-btn"
                onClick = {() => setTrigger(false)}
                aria-label="Close Settings"
                >
                Close
            </button>

            <div className="button-group">
              <button
                onClick ={() => {window.location.href = '/dashboard'} }
                className="settings-btn"
              >
                Dashboard
              </button>
              <button
                onClick ={() => {window.location.href = '/taskboard'} }
                className="settings-btn"
              >
                Taskboard
              </button>
              <button
                onClick ={() => {window.location.href = '/log'} }
                className="settings-btn"
              >
                Log
              </button>
              <button
                onClick ={() => {window.location.href = '/unsubscribe'} }
                className= "settings-btn"
              >
                Manage Notifications
              </button>
              <button
                onClick ={() => {window.location.href = '/mqtt_broker'} }
                className= "settings-btn"
              >
                Change MQTT Broker
              </button>
            </div>
        </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(overlay, document.body);
}