"""
---------------------------------------------------------------------------
Post Processing Node
Description:
This ROS2 node listens to both the model prediction stream and the raw
sensor stream, pairs each message with parsed IDs from the topic
path, and republishes them to HiveMQ Cloud on dedicated topics.
---------------------------------------------------------------------------
"""

import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import json
import paho.mqtt.client as mqtt
import ssl

# ---------------------------------------------------------------------------
# MQTT Broker Configuration
# ---------------------------------------------------------------------------
HOST = "726a83878f5a4f1088356946c77706d2.s1.eu.hivemq.cloud"
PORT = 8883
USER = "Sprin107"
PASS = "{wcco[M{lj[@4uy*W5j&jv(5)6TciPdE"

# Topics
RAW_TOPIC = "raw_data"
MODEL_OUTPUT_TOPIC = "model_output_data"

# ---------------------------------------------------------------------------
# Post-Processing Node
# ---------------------------------------------------------------------------
class PostProcessingNode(Node):

    def __init__(self):
        super().__init__('post_processing')

        # Subscribe to model node and bridge node 
        self.subscriber = self.create_subscription(
            String, "prediction_topic", self.model_output_callback, 10
        )
        self.subscriber2 = self.create_subscription(
            String, "sensor_topic", self.raw_data_callback, 10
        )

        # Create client and supply authentication 
        self.mqtt_client = mqtt.Client("post_processing_publisher")
        self.mqtt_client.username_pw_set(USER, PASS)

        # Ensure a secure connection to HiveMQ
        self.mqtt_client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
        self.mqtt_client.tls_insecure_set(False)

        # Connect to HiveMQ
        self.mqtt_client.connect(HOST, PORT, keepalive=60)

        # Start a seperate thread to handle traffic
        self.mqtt_client.loop_start()

        self.get_logger().info(
            "Post processing node receiving data"
        )

# ---------------------------------------------------------------------------
# Handling for model output
# ---------------------------------------------------------------------------
    def model_output_callback(self, msg: String):
        self.get_logger().info("Model output received from postprocessing node")
        self.get_logger().info(msg.data)

        try:
            json_msg = json.loads(msg.data)
        except Exception:
            self.get_logger().warn("Invalid JSON on preprocessed_topic")
            return
        
        topic_path = json_msg.get("machine_topic")

        # Parse machine from topic path
        parts = topic_path.split("/")
        division_id = parts[1]
        plant_id = parts[2]
        area_id = parts[3]
        subarea_id = parts[4]
        i_line = parts.index("line")
        i_st = parts.index("st")
        line_id = parts[i_line + 1]
        station_id = parts[i_st + 1]
        machine_type = parts[i_st + 2]
        machine_id = parts[i_st + 3]

        model_output_str = json_msg.get("anomaly_detected")
        model_output = True if model_output_str else False

        model_rul = json_msg.get("rul")

        time_stamp = json_msg.get("window_end_timestamp")

        machine_features = json_msg.get("feature_combination")

        # Payload for model output
        output_payload = {
            "time_stamp": time_stamp,
            "topic_path": topic_path,
            "division_id": division_id,
            "plant_id": plant_id,
            "area_id": area_id,
            "subarea_id": subarea_id,
            "line_id": line_id,
            "station_id": station_id,
            "machine_type_id": machine_type,
            "machine_id": machine_id,
            "model_output_value": model_output,
            "model_rul": model_rul,
            "machine_features": machine_features,
        }
        
        self.mqtt_client.publish(MODEL_OUTPUT_TOPIC, json.dumps(output_payload))

# ---------------------------------------------------------------------------
# Handling for raw data
# ---------------------------------------------------------------------------
    def raw_data_callback(self, msg: String):
        try:
            json_msg = json.loads(msg.data)
        except Exception:
            self.get_logger().warn("Invalid JSON on preprocessed_topic")
            return
        
        topic_path = json_msg.get("topic_path")

        parts = topic_path.split("/")

        i_line = parts.index("line")
        i_st = parts.index("st")
        i_sub = parts.index("subequipment")
        i_live = parts.index("live")

        division_id = parts[1]
        plant_id = parts[2]
        area_id = parts[3]
        subarea_id = parts[4]
        line_id = parts[i_line + 1]
        station_id = parts[i_st + 1]
        machine_type = parts[i_st + 2]
        machine_id = parts[i_st + 3]
        measured_type = parts[i_sub + 1]
        sensor_id = parts[i_sub + 2]
        machine_feature = parts[i_live + 1]
        sensor_payload_id = parts[i_live + 2]

        payload = json_msg.get("payload")
        payload_json = json.loads(payload)

        time_stamp = payload_json['timestamp']
        value = payload_json.get(machine_feature.lower())

        if value is None and "value" in payload_json:
            value = payload_json["value"]

        # Payload for raw data
        output_payload = {
            "time_stamp": time_stamp,
            "topic_path": topic_path,
            "division_id": division_id,
            "plant_id": plant_id,
            "area_id": area_id,
            "subarea_id": subarea_id,
            "line_id": line_id,
            "station_id": station_id,
            "machine_type_id": machine_type,
            "machine_id": machine_id,
            "sensor_type": measured_type,
            "sensor_id": sensor_id,
            "machine_feature": machine_feature,
            # "sensor_payload_id": sensor_payload_id,
            "value": value,
        }

        self.mqtt_client.publish(RAW_TOPIC, json.dumps(output_payload))

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main(args=None):
    rclpy.init(args=args)
    node = PostProcessingNode()

    rclpy.spin(node)
    rclpy.shutdown()

if __name__ == '__main__':
    main()