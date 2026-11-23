"""
---------------------------------------------------------------------------
Control Node
Description:
This ROS2 node listens on a control MQTT topic for simple JSON commands
from the UI dashboard, validates the payloads, and forwards them as
structured control messages into ROS.
---------------------------------------------------------------------------
"""

import os
import json
import ssl
import time
import uuid
import threading
import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import paho.mqtt.client as mqtt

ABS_PATH_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# MQTT Broker Configuration
# ---------------------------------------------------------------------------
BROKER_HOST_DEFAULT = "726a83878f5a4f1088356946c77706d2.s1.eu.hivemq.cloud"
BROKER_PORT_DEFAULT = 8883
BROKER_USER_DEFAULT = "Sprin107"
BROKER_PASS_DEFAULT = "{wcco[M{lj[@4uy*W5j&jv(5)6TciPdE"

CONTROL_TOPIC = "control"
ROS_CONTROL_TOPIC = "control"

ALLOWED_COMMANDS = {"reset_baseline", "set_input_broker", "set_flags"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Returns the current time
def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def to_bool(x):
    try:
        return 1 if int(x) == 1 else 0
    except Exception:
        return 0

def normalize_cmd(raw):
    if not isinstance(raw, dict):
        raise ValueError("payload must be json object")

    cmd = raw.get("command")
    if cmd not in ALLOWED_COMMANDS:
        raise ValueError("unsupported command")

# Reset baseline command
    if cmd == "reset_baseline":
        # require a specific machine but optional sensor_path
        machine_path = str(raw.get("machine_path", "")).strip()
        sensor_path = str(raw.get("sensor_path", "")).strip()

        if not machine_path:
            raise ValueError("machine_path required")

        ts = str(raw.get("time_stamp", "")).strip() or now_iso()

        return {
            "timestamp": ts,
            "command": "reset_baseline",
            "machine_path": machine_path,
            "sensor_path": sensor_path,   # may be ""
            "target": {"topic": machine_path}
        }

# Set input broker command
    if cmd == "set_input_broker":
        address = str(raw.get("address", "")).strip()
        port = raw.get("port")

        if not address or port is None:
            raise ValueError("address and port required")

        user = str(raw.get("user", "")).strip()
        password = str(raw.get("password", "")).strip()
        use_tls = to_bool(raw.get("use_tls", 1))

        return {
            "timestamp": now_iso(),
            "command": "set_input_broker",
            "address": address,
            "port": int(port),
            "user": user,
            "password": password,
            "use_tls": use_tls,
            "target": {"topic": "*"}
        }

# Set flags command
    if cmd == "set_flags":
        machine_path = str(raw.get("machine_path", "")).strip()

        if not machine_path:
            raise ValueError("machine_path required")

        ts = str(raw.get("time_stamp", "")).strip() or now_iso()

        rms = to_bool(raw.get("rms", 0))
        max  = to_bool(raw.get("max", 0))
        std = to_bool(raw.get("std", 0))
        kurtosis = to_bool(raw.get("kurtosis", 0))

        return {
            "timestamp": ts,
            "command": "set_flags",
            "machine_path": machine_path,
            "rms": rms,
            "max": max,
            "std": std,
            "kurtosis": kurtosis,
            "target": {"topic": machine_path}
        }

# ---------------------------------------------------------------------------
# Control Node
# ---------------------------------------------------------------------------
class AdminControl(Node):
    def __init__(self):
        super().__init__("admin_control")

        # ROS publisher topic
        self.cmd_pub = self.create_publisher(String, ROS_CONTROL_TOPIC, 10)

        # Current MQTT settings
        self.broker_host = self.declare_parameter("broker_host", os.getenv("CTRL_BROKER_HOST", BROKER_HOST_DEFAULT)).value
        self.broker_port = int(self.declare_parameter("broker_port", int(os.getenv("CTRL_BROKER_PORT", BROKER_PORT_DEFAULT))).value)
        self.broker_user = self.declare_parameter("broker_user", os.getenv("CTRL_BROKER_USER", BROKER_USER_DEFAULT)).value
        self.broker_pass = self.declare_parameter("broker_pass", os.getenv("CTRL_BROKER_PASS", BROKER_PASS_DEFAULT)).value

        self.client = mqtt.Client(client_id=f"admin_control-{uuid.uuid4()}", clean_session=True)

        if self.broker_user:
            self.client.username_pw_set(self.broker_user, self.broker_pass)

        # TLS
        ctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
        self.client.tls_set_context(ctx)
        self.client.tls_insecure_set(False)

        # MQTT callbacks
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect

        # MQTT Connection
        self.client.connect(self.broker_host, self.broker_port, keepalive=30)
        self.loop_thread = threading.Thread(target=self.client.loop_forever, daemon=True)
        self.loop_thread.start()

        self.get_logger().info(f"admin_control ready broker={self.broker_host}:{self.broker_port}")

# ---------------------------------------------------------------------------
# MQTT Callbacks
# ---------------------------------------------------------------------------
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            client.subscribe(CONTROL_TOPIC, qos=1)
            self.publish_event("admin_online", {"broker": f"{self.broker_host}:{self.broker_port}"})
        else:
            self.get_logger().warn(f"mqtt connect failed rc={rc}")

    def on_disconnect(self, client, userdata, rc):
        self.get_logger().warn(f"mqtt disconnected rc={rc}")

    def on_message(self, client, userdata, msg):
        try:
            raw = json.loads(msg.payload.decode("utf-8", errors="replace"))

            if isinstance(raw, dict) and "command" in raw and "target" not in raw:
                cmd = normalize_cmd(raw)
                self.get_logger().info(f"{cmd['command']} -> {cmd['target']['topic']}")
                self.publish_command(cmd)
                self.publish_ack("ok", "forwarded")
                self.cmd_pub.publish(String(data=json.dumps(cmd)))

        except Exception as e:
            self._publish_ack("rejected", str(e))

    def publish_command(self, cmd):
        self.client.publish(CONTROL_TOPIC, json.dumps(cmd), qos=1, retain=False)

    def publish_ack(self, status, details):
        ack = {"timestamp": now_iso(),"node": "admin_control","status": status,"details": details}

        self.client.publish(CONTROL_TOPIC, json.dumps(ack), qos=1, retain=False)

    def publish_event(self, event, data):
        log = {"timestamp": now_iso(),"event": event,"data": data}

        self.client.publish(CONTROL_TOPIC, json.dumps(log), qos=1, retain=False)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main(args=None):
    rclpy.init(args=args)
    node = AdminControl()
    try:
        rclpy.spin(node)
    finally:
        try:
            node.client.disconnect()
        except Exception:
            pass
        rclpy.shutdown()

if __name__ == "__main__":
    main()
