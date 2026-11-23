import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import paho.mqtt.client as mqtt

# subscriber node to bridge the mqtt protocol into the ros system
class MqttRosBridge(Node):

    def __init__(self):
        # parent constructor w/ node name
        super().__init__('mqtt_bridge')

        # create a ros2 publisher to publish messages onto topic 'sensor_topic'
        self.publisher_ = self.create_publisher(String, 'sensor_topic', 10)

        # MQTT client subscription connection
        self.mqtt_client = mqtt.Client("ros2_subscriber")
        self.mqtt_client.on_message = self.on_mqtt_message # assign on_mqtt_message() as callback handler
        self.mqtt_client.connect("localhost", 1883, keepalive = 60)
        self.mqtt_client.subscribe("sensors/data")
        self.mqtt_client.loop_start()

        self.get_logger().info("MQTT to ROS2 bridge activated")

    # callback handler for mqtt on message 
    def on_mqtt_message(self, client, userdata, msg):
        ros_msg = String()
        ros_msg.data = msg.payload.decode()
        self.publisher_.publish(ros_msg)
        self.get_logger().info(f"MQTT to ROS2: {ros_msg.data}")


def main(args=None):
    rclpy.init(args=args)
    node = MqttRosBridge()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    
    node.mqtt_client.loop_stop()
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
