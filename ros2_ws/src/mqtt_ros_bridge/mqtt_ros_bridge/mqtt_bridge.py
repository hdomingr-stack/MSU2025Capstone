"""
---------------------------------------------------------------------------
MQTT → ROS2 Bridge Node
Description:
This ROS2 node subscribes to an MQTT broker, reformats incoming
messages, timestamps JSON payloads, normalizes topic paths, and
republishes them into the ROS2 workspace on a chosen topic.

The node also listens for control messages on a ROS2 topic that can
update broker settings (host, port, TLS, username/password)
without restarting the node.
---------------------------------------------------------------------------
"""

import ssl
import rclpy
import json
from rclpy.node import Node
from std_msgs.msg import String
import paho.mqtt.client as mqtt
import certifi
from datetime import datetime

# ---------------------------------------------------------------------------
# MQTT Broker Configuration
# ---------------------------------------------------------------------------
HOST = "ETHAN-TOWER"
PORT = 8883
USER = "ethan"
PASS = "ethan_desktop"
CAFILE = "/mnt/c/ProgramData/mosquitto/certs/ca.crt"
USE_TLS = True

# Topics
MQTT_TOPIC = "#"
ROS_TOPIC = "sensor_topic"
CONTROL_TOPIC = "control"

# This was added to correct the Magna sensor topic path that we could not change
def fix_sensor_topic(raw_topic: str) -> str:
    if raw_topic.startswith("Optional(") and "Magna/DataAnalysis/Vibration/" in raw_topic:
        return "m/Live_Sensor/MSU/EB/Split-Hands/line/AI4CBM/st/Beta/Test/machine_sensor/subequipment/Vibration/ai4cbm-sensor/live/RMS/dummy"
    return raw_topic.strip("/")

def timestamp_now():
    now = datetime.now()
    return f"{now:%Y-%m-%d %H:%M:%S}.{now.microsecond // 10000:02d}"


# ---------------------------------------------------------------------------
# MQTT To ROS Bridge Node
# ---------------------------------------------------------------------------
class MqttRosBridge(Node):

    def __init__(self):
        super().__init__('bridge')

        # Publisher into ROS2
        self.publisher_ = self.create_publisher(String, ROS_TOPIC, 10)

        # Current MQTT settings
        self.host = HOST
        self.port = PORT
        self.user = USER
        self.password = PASS
        self.use_tls = USE_TLS

        # Create first MQTT connection
        self.mqtt_client = None
        self.create_client_and_connect()

        # Control topic subscription
        self.control_sub = self.create_subscription(String, CONTROL_TOPIC, self.on_control_message, 10)

        self.get_logger().info(f"MQTT->ROS bridge connecting to {self.host}:{self.port}, topic '{MQTT_TOPIC}' -> '{ROS_TOPIC}'")

# ---------------------------------------------------------------------------
# MQTT Callbacks
# ---------------------------------------------------------------------------
    def on_mqtt_connect(self, client, userdata, flags, rc):
        if rc == 0:
            client.subscribe(MQTT_TOPIC)
            self.get_logger().info(f"Subscribed to '{MQTT_TOPIC}'")
        else:
            self.get_logger().error(f"MQTT connect failed rc={rc}")

    def on_mqtt_disconnect(self, client, userdata, rc, properties=None):
        self.get_logger().warn(f"MQTT disconnected rc={rc}")

    def on_mqtt_message(self, client, userdata, msg):
        topic_path = fix_sensor_topic(msg.topic)

        decoded = msg.payload.decode(errors="replace")

        payload_str = decoded
        try:
            obj = json.loads(decoded)
            if isinstance(obj, dict):
                obj["timestamp"] = timestamp_now()
                payload_str = json.dumps(obj, separators=(",", ":"))
        except Exception:
            payload_str = decoded

        message_data = {
            "topic_path": topic_path,
            "payload": payload_str
        }

        ros_msg = String()
        ros_msg.data = json.dumps(message_data)
        self.publisher_.publish(ros_msg)

# ---------------------------------------------------------------------------
# MQTT Connections
# ---------------------------------------------------------------------------
    def create_client_and_connect(self):
        if self.mqtt_client is not None:
            try:
                self.mqtt_client.loop_stop()
                self.mqtt_client.disconnect()
            except Exception:
                pass

        self.mqtt_client = mqtt.Client(client_id="ros2_subscriber", protocol=mqtt.MQTTv311)

        # Authentication
        if self.user or self.password:
            self.mqtt_client.username_pw_set(self.user, self.password)

        # TLS handling
        if self.use_tls:
            self.mqtt_client.tls_set(
                ca_certs=CAFILE or certifi.where(),
                cert_reqs=ssl.CERT_REQUIRED,
                tls_version=ssl.PROTOCOL_TLS_CLIENT
            )
            self.mqtt_client.tls_insecure_set(False)

        # Assign callbacks
        self.mqtt_client.on_connect = self.on_mqtt_connect
        self.mqtt_client.on_disconnect = self.on_mqtt_disconnect
        self.mqtt_client.on_message = self.on_mqtt_message

        # Attempt connection
        self.mqtt_client.loop_start()
        self.get_logger().info(f"Connecting to MQTT {self.host}:{self.port} ...")

        try:
            self.mqtt_client.connect(self.host, self.port, keepalive=60)

        except Exception as e:
            self.get_logger().error(f"MQTT connect failed: {e}")

            try:
                self.mqtt_client.loop_stop()
            except Exception:
                pass
            return

# ---------------------------------------------------------------------------
# Handling for Control Node Messages
# ---------------------------------------------------------------------------
    def on_control_message(self, msg: String):
        try:
            obj = json.loads(msg.data)
        except Exception:
            return
        if not isinstance(obj, dict):
            return
        if obj.get("command") != "set_input_broker":
            return

        use_tls_val = obj.get("use_tls", 1)

        try:
            use_tls_bool = bool(int(use_tls_val))
        except Exception:
            use_tls_bool = bool(use_tls_val)

        new_host = str(obj.get("address", self.host)).strip() or self.host
        new_port = int(obj.get("port", self.port))
        new_user = str(obj.get("user", self.user))
        new_pass = str(obj.get("password", self.password))

        # Detect if any of the broker settings have changed
        changed = (
            new_host != self.host or
            new_port != self.port or
            new_user != self.user or
            new_pass != self.password or
            use_tls_bool != self.use_tls
        )

        if not changed:
            return

        # Apply changes if there is any
        self.host = new_host
        self.port = new_port
        self.user = new_user
        self.password = new_pass
        self.use_tls = use_tls_bool

        self.get_logger().info(f"Reconnecting MQTT to {self.host}:{self.port} (TLS={'on' if self.use_tls else 'off'}) due to control command")
        self.create_client_and_connect()

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main(args=None):
    rclpy.init(args=args)
    node = MqttRosBridge()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass

    # Shutdown MQTT connection
    if node.mqtt_client is not None:
        try:
            node.mqtt_client.loop_stop()
            node.mqtt_client.disconnect()
        except Exception:
            pass

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
