"""
---------------------------------------------------------------------------
Preprocessor Node
Description:
This ROS2 node subscribes to the raw sensor_topic, aggregates incoming
sensor measurements into rolling windows per machine and sensor, scales
values using pre-fitted scalers from model training, and publishes
structured windowed data for the model node.

The node also listens for control messages on the control topic to reset
baselines and to set which features (max, rms, std, kurtosis) are used
as model inputs per machine.
---------------------------------------------------------------------------
"""

import rclpy
from rclpy.node import Node
from std_msgs.msg import String
from collections import deque
import json
import  os
import joblib
import copy

ABS_PATH_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Preprocessor Node
# ---------------------------------------------------------------------------
class PreprocessorNode(Node):
    def __init__(self):

        super().__init__('preprocess')

        self.declare_parameter('window_size', 10)
        self.declare_parameter('window_stride', 1)
        self.declare_parameter('default_flags', ['rms'])

        # Assuming 1 second sensor cycle
        self.WINDOW_SIZE = self.get_parameter('window_size').get_parameter_value().integer_value
        self.WINDOW_STRIDE = self.get_parameter('window_stride').get_parameter_value().integer_value

        self.DEFAULT_MODEL_FLAGS = self.get_parameter('default_flags').get_parameter_value().string_array_value
        self.META_KEYS = ['model_flags', '_display']

        self.META_KEYS = ['model_flags']

        # Subscribe to raw sensor data and control messages
        self.subscription = self.create_subscription(String,'sensor_topic',self.listener_callback,50)
        self.control_sub = self.create_subscription(String, 'control', self.control_callback, 10)

        # Create a topic to publish messages to 
        self.publisher_ = self.create_publisher(String, 'preprocessed_topic', 10)

        self.data_buffers = {}

        # Timer to process any ready windows
        self.processing_timer = self.create_timer(self.WINDOW_STRIDE, self.process_data) 

        # Load scaler from model training
        self.scaler = joblib.load(os.path.join(ABS_PATH_DIR, "scalers.pkl"))

# ---------------------------------------------------------------------------
# Listener for the raw sensor data
# ---------------------------------------------------------------------------
    def listener_callback(self, msg):
        try:
            message_info = json.loads(msg.data)

            topic_string = message_info.get('topic_path')
            payload = message_info.get('payload')

            topic_parts = topic_string.split('/')

            # m/{division}/{plant}/{area}/{subarea}/line/{lineID}/st/{stationID}/{machineType}/{machineID}
            # /subequipment/{sensorType}/{sensorID}/live/{measurementType}/{sensorPayloadID}
            i_line = topic_parts.index('line')
            i_st = topic_parts.index('st')
            i_sub = topic_parts.index('subequipment')
            i_live = topic_parts.index('live')

            machine_path_display = "/".join(topic_parts[: i_st + 4])
            machine_key = machine_path_display.lower()

            sensor_type = topic_parts[i_sub + 1]  # e.g., "Vibration"
            feature_suffix = topic_parts[i_live + 1]  # e.g., "RMS"
            sensor_path = f"{sensor_type}/{feature_suffix}"  # e.g., "Vibration/RMS"

            if machine_key not in self.data_buffers:
                self.data_buffers[machine_key] = {}
                self.data_buffers[machine_key]['model_flags'] = self.DEFAULT_MODEL_FLAGS
                self.data_buffers[machine_key]['_display'] = machine_path_display

            machine_data_buffers = self.data_buffers[machine_key]

            sensor_data = json.loads(payload)
            ts_str = sensor_data['timestamp']

            sensor_path = "/".join([sensor_type, feature_suffix])

            if sensor_path not in machine_data_buffers:
                machine_data_buffers[sensor_path] = {'current_window': {'data': deque(maxlen=self.WINDOW_SIZE),
                                                                        'timestamp': deque(maxlen=self.WINDOW_SIZE)}}

            feature_key = feature_suffix.lower()

            feature_value = float(sensor_data[feature_key])

            # Add scalar for data here
            feature_value = self.scaler[feature_key].transform([[feature_value]])[0, 0]

            machine_data_buffers[sensor_path]['current_window']['data'].append(feature_value)
            machine_data_buffers[sensor_path]['current_window']['timestamp'].append(ts_str)

        except:
            self.get_logger().warn("Error in listener_callback")

# ---------------------------------------------------------------------------
# Window and payload generator
# ---------------------------------------------------------------------------
    def process_data(self):
        for machine_key, machine_data_buffers in self.data_buffers.items():
            machine_id_full = machine_data_buffers.get('_display', machine_key)
            valid = True
            current_window = {}
            baseline_window = {}

            model_flags = machine_data_buffers.get('model_flags', [])
            used_flags = []


            for sensor_path, data_buffer in machine_data_buffers.items():
                if sensor_path in self.META_KEYS or not isinstance(data_buffer, dict):
                    continue

                if sensor_path in self.META_KEYS:
                    continue
                
                feature_suffix = sensor_path.split('/')[-1]
                feature_key = feature_suffix.lower()

                if 'baseline_window' not in data_buffer:
                    if len(data_buffer['current_window']['data']) >= self.WINDOW_SIZE:
                        data_buffer['baseline_window'] = {
                            'data': copy.deepcopy(list(data_buffer['current_window']['data'])),
                            'timestamp': copy.deepcopy(list(data_buffer['current_window']['timestamp']))
                        }

                        self.get_logger().info(f"Set baseline for {sensor_path}")

                if feature_key not in model_flags:
                    continue

                if len(data_buffer['current_window']['data']) < self.WINDOW_SIZE:
                    self.get_logger().warn(f"Machine {machine_id_full} Sensor {sensor_path} window not filled yet")
                    valid = False
                    break

                current_window[feature_key] = {'data': list(data_buffer['current_window']['data'])}

                if 'baseline_window' not in data_buffer:
                    self.get_logger().warn(f"Machine {machine_id_full} Sensor {sensor_path} does not have a baseline")
                    valid = False
                    break

                baseline_window[feature_key] = {'data': list(data_buffer['baseline_window']['data'])}
                window_end = data_buffer['current_window']['timestamp'][-1]
                used_flags.append(feature_key)

            if valid:
                parts = machine_id_full.split('/')
                i_line = parts.index('line')
                i_st = parts.index('st')
                division_id = parts[1]
                line_id = parts[i_line + 1]
                machine_id_only = parts[i_st + 3]

                payload = {
                    'machine_id_full': machine_id_full,
                    'division_id': division_id,
                    'line_id': line_id,
                    'machine_id_only': machine_id_only,
                    'window_end': window_end,
                    'window_duration': self.WINDOW_SIZE,
                    'current_window': current_window,
                    'baseline_window': baseline_window,
                    'model_input_features': used_flags,
                }

                msg = String()
                msg.data = json.dumps(payload)
                self.publisher_.publish(msg)
                # self.get_logger().info(json.dumps(payload,indent=4))
                    
            else:
                self.get_logger().warn(f"Machine {machine_id_full} data is not valid for processing at this time")
        
        if not self.data_buffers:
            self.get_logger().warn("No incoming data being received by any machine yet")

# ---------------------------------------------------------------------------
# Handling for Control Node Messages
# ---------------------------------------------------------------------------
    def control_callback(self, msg: String):
        try:
            obj = json.loads(msg.data)
        except Exception:
            return
        if not isinstance(obj, dict):
            return

        cmd = obj.get("command")

        if cmd == "reset_baseline":
            machine_path = str(obj.get("machine_path", "")).strip().lower()
            sensor_path = str(obj.get("sensor_path", "")).strip()

            if not machine_path:
                # must target a specific machine; do nothing if omitted
                return

            reset_count = 0
            machine_buffers = self.data_buffers.get(machine_path)
            if not isinstance(machine_buffers, dict):
                self.get_logger().warn(f"reset_baseline: machine '{machine_path}' not found")
                return

            if sensor_path:
                # clear only this sensor on this machine
                buf = machine_buffers.get(sensor_path)
                if isinstance(buf, dict) and 'baseline_window' in buf:
                    del buf['baseline_window']
                    reset_count += 1
            else:
                # no sensor_path -> clear all sensors' baselines on this machine only
                for sp, buf in machine_buffers.items():
                    if sp in self.META_KEYS:
                        continue
                    if isinstance(buf, dict) and 'baseline_window' in buf:
                        del buf['baseline_window']
                        reset_count += 1

            self.get_logger().info(
                f"reset_baseline: cleared {reset_count} baseline(s) (machine='{machine_path}', sensor='{sensor_path}')"
            )

        elif cmd == "set_flags":
            machine_path = str(obj.get("machine_path", "")).strip().lower()
            if not machine_path:
                return

            machine_buffers = self.data_buffers.get(machine_path)
            if not isinstance(machine_buffers, dict):
                self.get_logger().warn(f"set_flags: machine '{machine_path}' not found")
                return

            flags = []
            for k in ['max', 'rms', 'std', 'kurtosis']:
                try:
                    if int(obj.get(k, 0)) == 1:
                        flags.append(k)
                except Exception:
                    pass

            if flags:
                machine_buffers['model_flags'] = flags
                self.get_logger().info(f"set_flags: {machine_path} -> {flags}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main(args=None):
    rclpy.init(args=args)
    node = PreprocessorNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
