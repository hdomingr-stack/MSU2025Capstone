"""
---------------------------------------------------------------------------
Model Node
Description:
This ROS2 node subscribes to preprocessed_topic, converts the incoming
windowed sensor data into tensors for the model, runs
inference to detect anomalies and estimate remaining useful life (RUL),
and publishes the results on prediction_topic.
---------------------------------------------------------------------------
"""

import os
import json
import torch
import numpy as np
from collections import deque, defaultdict
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

PKG_DIR = os.path.dirname(os.path.abspath(__file__))

# Expected feature order
FEATURE_LABELS = ["max", "rms", "std", "kurtosis"]

# ---------------------------------------------------------------------------
# Helper for windows
# ---------------------------------------------------------------------------
def prepare_input_windowed(window_data: dict, feature_labels: list, window_len: int, fill_strategy="zeros"):
    """
    Prepares an aligned, padded, and scaled tensor for SiameseCBM input.

    Returns:
        X np.ndarray: Shape [1, window_len, num_features]
        feats_used list
    """
    num_features = len(feature_labels)
    X = np.zeros((window_len, num_features), dtype=np.float32)
    feats_used = []

    # Compute fill values if needed

    fill_values = {feat: 0.0 for feat in feature_labels}

    for i, feat in enumerate(feature_labels):
        vals_obj = window_data.get(feat, {})
        values = vals_obj.get("data", vals_obj.get("values", None))

        if values is None:
            # Missing feature → fill with default
            values = np.full(window_len, fill_values[feat], dtype=np.float32)
        else:
            values = np.asarray(values, dtype=np.float32)
            # Pad or truncate
            if len(values) < window_len:
                padded = np.full(window_len, fill_values[feat], dtype=np.float32)
                padded[:len(values)] = values
                values = padded
            else:
                values = values[:window_len]
            
            feats_used.append(feat)

        X[:, i] = values

    X = np.expand_dims(X, axis=0)  # [1, window_len, num_features]
    return X, feats_used

# ---------------------------------------------------------------------------
# Trained model loading helpers
# ---------------------------------------------------------------------------
def _load_torchscript(path, device):
    try:
        return torch.jit.load(path, map_location=device)

    except Exception as e:
        print(f"[warn] TorchScript load failed: {e}")
        return None

# Helper to load the TorchState
def _load_state_dict(path, device, n_sensors_fallback=1):
    try:
        from mqtt_ros_bridge.cmapss_model import MultiSensorLSTM

    except Exception:
        return None

    try:
        model = MultiSensorLSTM(n_sensors=n_sensors_fallback, embed_dim=32).to(device)
        state = torch.load(path, map_location=device)

        if isinstance(state, dict) and "state_dict" in state:
            state = state["state_dict"]

        model.load_state_dict(state, strict=False)
        return model

    except Exception as e:
        print(f"[warn] state_dict load failed: {e}")
        return None

# ---------------------------------------------------------------------------
# Mode Node
# ---------------------------------------------------------------------------
class ModelNode(Node):
    def __init__(self):
        super().__init__('model')

        # Can override with: model.window_len:=N
        self.declare_parameter('window_len', 30)
        self.window_len = int(self.get_parameter('window_len').get_parameter_value().integer_value) or 30

        # Use CUDA if available
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Load model artifacts
        ts_path = os.path.join(PKG_DIR, "model_scripted.pt")
        sd_path = os.path.join(PKG_DIR, "model_state.pt")
        model = None

        # First try to use TorchScript
        if os.path.isfile(ts_path):
            model = _load_torchscript(ts_path, self.device)
            if model is not None:
                self.get_logger().info(f"Loaded TorchScript: {ts_path}")

        # If TorchScript doesn't load/is none, use TorchState instead
        if model is None and os.path.isfile(sd_path):
            model = _load_state_dict(sd_path, self.device, n_sensors_fallback=1)

            if model is not None:
                self.get_logger().info(f"Loaded state_dict: {sd_path}")

        if model is None:
            # If this happens, retrain the model at "MultiModal CMAPSS/cmapss_model.py"
            self.get_logger().warn("No model artifacts found in package folder. Model node cannot inference without it.")
        else:
            model.eval()

        self.model = model
        self.pred_history = defaultdict(lambda: deque(maxlen=10))

        # ROS S/P
        self.sub = self.create_subscription(String, 'preprocessed_topic', self.on_msg, 100)
        self.pub = self.create_publisher(String, 'prediction_topic', 10)

# ---------------------------------------------------------------------------
# Message Handler
# ---------------------------------------------------------------------------
    def on_msg(self, msg: String):
        if not self.model:
            return

        # Parse payload from preprocessing
        try:
            x = json.loads(msg.data)
        except Exception:
            self.get_logger().warn("Invalid JSON from preprocessed_topic")
            return

        # Get Machine ID and Sensor ID
        mid_machine = x.get("machine_id_only", "unknown")
        machine_topic = x.get("machine_id_full", "")

        # sensor_id = x.get("sensor_id", None)
        # sensor_topic = x.get("sensor_topic", "")

        # Use sensor ID for per sensor window
        # mid = sensor_id if sensor_id else mid_machine

        window_end = x.get("window_end", "")
        expected = int(self.window_len)

        # Pull windowed sequences
        baseline_window = x.get("baseline_window", {})
        current_window = x.get("current_window", {})

        try:

            feats_used = x.get("model_input_features", FEATURE_LABELS)

            # Prepare model inputs, baseline and current windows
            baseline_arr, _ = prepare_input_windowed(baseline_window, FEATURE_LABELS, 30)
            current_arr, _ = prepare_input_windowed(current_window, FEATURE_LABELS, 30)

            baseline = torch.from_numpy(baseline_arr).to(self.device)
            current = torch.from_numpy(current_arr).to(self.device)

            # Model forward pass
            with torch.no_grad():
                logit, rul_out = self.model(baseline, current)
                prob = torch.sigmoid(logit)
                rul = (rul_out * 200).cpu().item() # scale back from max

            pred = (prob > 0.5)

            if pred.numel() == 1:
                pred = pred.item()
            else:
                pred = pred.cpu().numpy()

            conf = self.confidence(prob)

            # Entire payload to be inserted into postgresql
            out_payload = {
                "machine_id": mid_machine,
                "machine_topic": machine_topic,
                "window_end_timestamp": window_end,
                "anomaly_detected": pred,
                "rul": rul,
                "confidence": conf,
                "feature_combination": feats_used
            }

            out_msg = String()
            out_msg.data = json.dumps(out_payload)
            self.pub.publish(out_msg)

        except Exception as e:
            self.get_logger().error(f"ModelNode inference/publish error: {e}")

    def confidence(self, history):
        if not history:
            return 0.0

        arr = np.array(history, dtype=np.float32)
        mean = float(arr.mean())
        std = float(arr.std())

        return float(max(0.0, 1.0 - std / (abs(mean) + 1e-6)))

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main(args=None):
    rclpy.init(args=args)
    node = ModelNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
