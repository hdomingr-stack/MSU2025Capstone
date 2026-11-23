import json
from datetime import datetime, timedelta
from pathlib import Path
import numpy as np
import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import ssl, certifi, paho.mqtt.client as mqtt

MQTT_HOST = "ETHAN-TOWER"
MQTT_PORT = 8883
MQTT_USER = "ethan"
MQTT_PASS = "ethan_desktop"
MQTT_CAFILE = "/mnt/c/ProgramData/mosquitto/certs/ca.crt"


Division_Id = "den"
Line_Prefix = "bar3line" # lines are IMS sets: line1 -> Set1.npy, line2 -> Set2.npy, line3 -> Set3.npy.
Machine_Prefix = "robot" # Each channel is a "machine". Publishes 4 features per machine (RMS, Max, Kurtosis, STD)
Plant = "plant1"
Area = "assembly"
Subarea = "t1xx"
Station_Id = "station1"
Machine_Type = "robot"
Sensor_Type = "Vibration"
Sensor_Id = "sensor1"

IMS_Sample_Rate = 20000.0 # 20 kHz
Sensor_Interval = 1.0 # Features are computed over window_sample = IMS_Sample_Rate * Sensor_Interval samples
Total_Ticks = 10_000
Minute_Per_Tick = 10  # simulated time jump per tick in minutes

Use_Sets = [1, 2, 3] # Use all sets
 
# These are just so the payload matches what comes off the sensor
device = "ai4cbm_test_sensor"
measurand = "accel Z"
fmt = 2
Value_List_Length = 14 # How many non-useful values, mimics irl sensor but they are all zeros
Temp = 70.0

# 500 is good for a demo on division1/line2/machine1/#
Start_File_Index = 500

Set_Dir = Path(__file__).resolve().parent

def rms(x: np.ndarray):
    return float(np.sqrt(np.mean(x * x)))

def kurtosis(x: np.ndarray):
    mu = float(np.mean(x))
    v = float(np.mean((x - mu) ** 2))

    if v == 0.0:
        return 0.0

    m4 = float(np.mean((x - mu) ** 4))
    return m4 / (v * v) - 3.0

def build_topic(division, plant,area, subarea, line_id, station_id, machine_type, machine_id, sensor_type, sensor_id,
                measurement_type, sensor_payload_id,):
    return (
        f"m/{division}/{plant}/{area}/{subarea}"
        f"/line/{line_id}"
        f"/st/{station_id}/{machine_type}/{machine_id}"
        f"/subequipment/{sensor_type}/{sensor_id}"
        f"/live/{measurement_type}/{sensor_payload_id}"
    )

class SimulationTest(Node):
    def __init__(self):
        super().__init__("simulation_test")

        self.set_data = {}
        self.set_shapes = {}

        for set_id in Use_Sets:
            f = Set_Dir / f"Set{set_id}.npy"
            if f.exists():
                arr = np.load(str(f), mmap_mode="r")
                self.set_data[set_id] = arr
                self.set_shapes[set_id] = arr.shape
            else:
                self.get_logger().warn(f"Set{set_id}.npy not found at {f}; skipping {Line_Prefix}{set_id}")

        if not self.set_data:
            raise FileNotFoundError("No Set{1,2,3}.npy files found next to this node.")

        self.window_samples = int(round(IMS_Sample_Rate * Sensor_Interval))

        if self.window_samples <= 0:
            raise ValueError("WINDOW_SAMPLES must be >= 1")

        # each channel becomes a machine
        # list of (division_id, line_id, machine_id, set_idx, channel_idx)
        self.entries = []
        for set_id, arr in self.set_data.items():
            _, _, num_channels = arr.shape
            line_id = f"{Line_Prefix}{set_id}"

            for ch in range(num_channels):
                machine_id = f"{Machine_Prefix}{ch + 1}"
                self.entries.append((Division_Id, line_id, machine_id, set_id, ch))

        self.set_total_samples = {}
        self.set_file_samples = {}

        for set_id, shape in self.set_shapes.items():
            num_files, n_rows, _ = shape
            self.set_file_samples[set_id] = n_rows
            self.set_total_samples[set_id] = num_files * n_rows

        self.set_sample_cursors = {}
        for set_id, shape in self.set_shapes.items():
            num_files, n_rows, _ = shape
            start_idx = int(Start_File_Index) % max(1, num_files)
            self.set_sample_cursors[set_id] = start_idx * n_rows

        self.pub = self.create_publisher(String, "sensor_topic", 10)
        self.create_timer(Sensor_Interval, self.tick)

        self.mqtt = mqtt.Client(client_id="sim_pub", protocol=mqtt.MQTTv311)

        self.mqtt.username_pw_set(MQTT_USER, MQTT_PASS)

        self.mqtt.tls_set(
            ca_certs=MQTT_CAFILE or certifi.where(),
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLS_CLIENT
        )
        self.mqtt.tls_insecure_set(False)
        self.mqtt.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        self.mqtt.loop_start()

        self.t0_wall = None
        self.tick_count = 0

        self.get_logger().info(
            f"simulation_test: sets={sorted(self.set_data.keys())} machines={len(self.entries)} "
            f"interval={Sensor_Interval}s window_samples={self.window_samples}"
        )

    def slice_window(self, arr: np.ndarray, set_idx: int, ch_idx: int, start_sample: int, window_samples: int):
        total = self.set_total_samples[set_idx]
        fs = self.set_file_samples[set_idx]

        out = np.empty(window_samples, dtype=arr.dtype)
        remaining = window_samples
        write_pos = 0
        pos = start_sample % total

        while remaining > 0:
            file_idx = pos // fs
            offset = pos % fs
            take = min(remaining, fs - offset)
            out[write_pos:write_pos+take] = arr[file_idx, offset:offset+take, ch_idx]
            write_pos += take
            remaining -= take
            pos = (pos + take) % total

        return out

    def payload_for_feature(self, stamp: str, feature_key: str, value: float):
        zeros = [0.0] * Value_List_Length
        payload = {"timestamp": stamp, "device": device, "fmt": fmt, "measurand": measurand, "values": zeros,
                   "temp": Temp, feature_key: value}

        return payload

    def tick(self):
        if self.tick_count >= Total_Ticks:
            return

        if self.t0_wall is None:
            self.t0_wall = datetime.now()

        ts = self.t0_wall + timedelta(minutes=Minute_Per_Tick * self.tick_count)
        stamp = ts.strftime("%Y-%m-%d %H:%M:%S.%f")[:-4]

        # For each set: compute window start from its cursor, then advance cursor by window size
        set_window_starts = {}
        for set_id in self.set_data.keys():
            start = self.set_sample_cursors[set_id]
            set_window_starts[set_id] = start
            self.set_sample_cursors[set_id] = (start + self.window_samples) % self.set_total_samples[set_id]

        # For each machine, publish 4 feature messages from the same window
        for division_id, line_id, machine_id, set_idx, ch_idx in self.entries:
            arr = self.set_data[set_idx]
            start_sample = set_window_starts[set_idx]

            x = self.slice_window(arr, set_idx, ch_idx, start_sample, self.window_samples)

            v_rms = rms(x)
            v_max = float(np.max(x))
            v_std = float(np.std(x))
            v_kurt = kurtosis(x)

            # Publish messages with feature type
            feat_map = {
                "RMS": ("rms", v_rms),
                "Max": ("max", v_max),
                "Kurtosis": ("kurtosis", v_kurt),
                "STD": ("std", v_std),
            }

            for feature_suffix, (feature_key, feature_value) in feat_map.items():
                topic_path = build_topic(division_id, Plant, Area, Subarea, line_id, Station_Id, Machine_Type, machine_id, Sensor_Type, Sensor_Id, feature_suffix, feature_key)
                payload_obj = self.payload_for_feature(stamp, feature_key, feature_value)

                outer = {"topic_path": topic_path, "payload": json.dumps(payload_obj)}
                msg = String()
                msg.data = json.dumps(outer)

                x = json.loads(msg.data)
                self.mqtt.publish(x["topic_path"], x["payload"], qos=0, retain=False)

        self.tick_count += 1

def main(args=None):
    rclpy.init(args=args)
    node = SimulationTest()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
