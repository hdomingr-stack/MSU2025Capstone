"""
---------------------------------------------------------------------------
IMS Bearing Dataset Model Training
---------------------------------------------------------------------------

Description:
    Model Training and Model Architecture for the NASA IMS bearing run-to-failure dataset.
    This script takes the prepared data from IMS_preprocessing.py and runs it through the model for training and test.
    Upon completion of training, it saves and deploys the model script for pipeline deployment.
"""

from matplotlib import pyplot as plt
import numpy as np
from sklearn.model_selection import train_test_split
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import os
from typing import List
from torch import Tensor
import os, shutil, argparse
import torch
from typing import Optional
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix
from torch.utils.data import WeightedRandomSampler
from sklearn.metrics import classification_report
from sklearn.metrics import mean_absolute_error, mean_squared_error



class MultiTaskCBMDataset(Dataset):
    """Dataset Class for IMS Dataset with baselining"""
    def __init__(self, X, y_bin, y_rul, baseline):
        self.X = X
        self.y_bin = y_bin
        self.y_rul = y_rul
        self.baseline = baseline

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return (
            torch.tensor(self.baseline[idx], dtype=torch.float32),
            torch.tensor(self.X[idx], dtype=torch.float32),
            torch.tensor(self.y_bin[idx], dtype=torch.float32),
            torch.tensor(self.y_rul[idx], dtype=torch.float32)
        )




# Model

class FeatureEncoder(nn.Module):
    """Encode one feature channel"""
    def __init__(self, out_dim=32):
        super().__init__()

        # embedding vectorizer
        self.vectorizer = nn.Sequential(
            nn.Linear(1, 16),
            nn.ReLU(),
            nn.Linear(16, out_dim),
            nn.ReLU()
        )
    def forward(self, x):
        return self.vectorizer(x)


class AttentionFusion(nn.Module):
    """Fuse sensor embeddings using attention"""
    def __init__(self, embed_dim=32):
        super().__init__()
        self.attention = nn.MultiheadAttention(embed_dim, num_heads=4, batch_first=True)

    def forward(self, embeddings: List[torch.Tensor]):
        # embeddings is a list of all features passed through SensorEncoder()
        x = torch.stack(embeddings, dim=2)  # stack all feature embeddings
        batch_size, window_len, num_features, dim = x.shape
        x = x.view(batch_size*window_len, num_features, dim)

        fused, _ = self.attention(x,    x, x) # self-attention q,k,v = x,x,x
        fused = fused.mean(dim=1) # pooling down to 1d
        return fused.view(batch_size, window_len, dim)


class MultiSensorLSTM(nn.Module):
    """LSTM encoder layer"""

    # n_sensors = number of features
    def __init__(self, embed_dim=32):
        super().__init__()
        self.embed_dim = embed_dim

        # Shared feature encoder
        self.feature_encoder = FeatureEncoder(out_dim=embed_dim)
        # fusion
        self.fusion = AttentionFusion(embed_dim=embed_dim)

        # LSTM for temporal modeling
        self.lstm = nn.LSTM(input_size=embed_dim, hidden_size=128, batch_first=True, dropout=0.2,  num_layers=2)     
    
    def forward(self, x: torch.Tensor):

        n_features_available = x.shape[2]

        embeddings = []
        # create embedding for each feature
        for i in range(n_features_available):
            feature_i = x[:, :, i:i+1]  # isolate the single feature's values
            embeddings.append(self.feature_encoder(feature_i)) # apply encoder

        fused = self.fusion(embeddings)  # fuse all the encoded embeddings
        lstm_out, _ = self.lstm(fused) # modeling
        return lstm_out[:, -1, :]

class SiameseCBM(nn.Module):
    """Compare baseline vs current window"""
    def __init__(self, embed_dim=32):
        super().__init__()
        self.encoder = MultiSensorLSTM(embed_dim)
        self.rul_encoder = MultiSensorLSTM(embed_dim)
        # head now takes LSTM hidden size and outputs 1 logit
        self.bin_head = nn.Linear(128, 1)
        self.rul_head = nn.Linear(128, 1)


    def forward(self, baseline, current):
        base_emb = self.encoder(baseline)     # [B, D]
        curr_emb = self.encoder(current)      # [B, D]
        diff = torch.abs(curr_emb - base_emb) # deviation vector
        # Binary classification logit
        bin_logit = self.bin_head(diff).squeeze(-1)                # [B, 1]
        # Regression logit
        rul_emb = self.rul_encoder(current)
        rul_pred = self.rul_head(rul_emb).squeeze(-1)
        return bin_logit, rul_pred            # [B]


def save_and_deploy(
    model: torch.nn.Module,
    device: torch.device,
    X_shape: Optional[tuple],
    train_dir: str,
):
    """
    Save artifacts in the training directory, then copy them into
    the repo's ROS2 package at "ros2_ws/src/mqtt_ros_bridge/mqtt_ros_bridge".
    """

    PROJECT_ROOT = os.path.abspath(os.path.join(train_dir, os.pardir))

    # ROS2 package dir relative to project root
    DST_DIR = os.path.join(
        PROJECT_ROOT,
        "ros2_ws", "src", "mqtt_ros_bridge", "mqtt_ros_bridge"
    )
    os.makedirs(DST_DIR, exist_ok=True)

    # Save state_dict in training dir
    state_path = os.path.join(train_dir, "model_state.pt")
    torch.save(model.state_dict(), state_path)
    print(f"[save] state_dict -> {state_path}")

    # Save TorchScript (prefer script)
    ts_path = os.path.join(train_dir, "model_scripted.pt")

    try:
        model.eval()
        scripted = torch.jit.script(model)

        scripted.save(ts_path)
        print(f"[save] TorchScript (script) -> {ts_path}")

    except Exception as e:
        print(f"[warn] script() failed: {e}")

        try:
            if not X_shape:
                raise RuntimeError("Need X_shape to trace fallback")

            example_baseline = torch.zeros(*X_shape, dtype=torch.float32, device=device)
            example_current = torch.zeros(*X_shape, dtype=torch.float32, device=device)

            traced = torch.jit.trace(model, (example_baseline, example_current))
            traced.save(ts_path)
            print(f"[save] TorchScript (trace) -> {ts_path}")

        except Exception as e2:
            print(f"[warn] trace() failed: {e2}")

    # 3) Copy artifacts into the ROS2 package directory

    for src in (state_path, ts_path):
        if os.path.isfile(src):
            shutil.copy2(src, DST_DIR)
            print(f"[deploy] copied {os.path.basename(src)} -> {DST_DIR}")

if __name__ == "__main__":

    # Load preprocessed data
    ABS_PATH_DIR = os.path.dirname(os.path.abspath(__file__))

    # directory path for the proper npy files for each test version
    DATA_DIR = os.path.join(ABS_PATH_DIR, "data/test3")

    # --- test3 as test set (MAIN TRAINING SETUP)
    X_train = np.load(os.path.join(DATA_DIR, "X_train.npy")).astype(np.float32)
    y_train_bin = np.load(os.path.join(DATA_DIR, "y_train_bin.npy")).astype(np.float32)
    y_train_rul = np.load(os.path.join(DATA_DIR, "y_train_rul.npy")).astype(np.float32)

    X_test = np.load(os.path.join(DATA_DIR, "X_test.npy")).astype(np.float32)
    y_test_bin = np.load(os.path.join(DATA_DIR, "y_test_bin.npy")).astype(np.float32)
    y_test_rul = np.load(os.path.join(DATA_DIR, "y_test_rul.npy")).astype(np.float32)

    X_train_extra = np.load(os.path.join(DATA_DIR, "X_1-5.npy")).astype(np.float32)
    y_test_bin_extra = np.load(os.path.join(DATA_DIR, "y_1-5_bin.npy")).astype(np.float32)
    y_test_rul_extra = np.load(os.path.join(DATA_DIR, "y_1-5_rul.npy")).astype(np.float32)

    X_train_4th = np.load(os.path.join(DATA_DIR, "X_1-8.npy")).astype(np.float32)
    y_train_bin_4th = np.load(os.path.join(DATA_DIR, "y_1-8_bin.npy")).astype(np.float32)
    y_train_rul_4th = np.load(os.path.join(DATA_DIR, "y_1-8_rul.npy")).astype(np.float32)


    # --- test2 as test set

    # X_train = np.load(os.path.join(DATA_DIR, "X_test.npy")).astype(np.float32)
    # y_train_bin = np.load(os.path.join(DATA_DIR, "y_test_bin.npy")).astype(np.float32)
    # y_train_rul = np.load(os.path.join(DATA_DIR, "y_test_rul.npy")).astype(np.float32)

    # X_test = np.load(os.path.join(DATA_DIR, "X_train.npy")).astype(np.float32)
    # y_test_bin = np.load(os.path.join(DATA_DIR, "y_train_bin.npy")).astype(np.float32)
    # y_test_rul = np.load(os.path.join(DATA_DIR, "y_train_rul.npy")).astype(np.float32)

    # X_train_extra = np.load(os.path.join(DATA_DIR, "X_1-5.npy")).astype(np.float32)
    # y_test_bin_extra = np.load(os.path.join(DATA_DIR, "y_1-5_bin.npy")).astype(np.float32)
    # y_test_rul_extra = np.load(os.path.join(DATA_DIR, "y_1-5_rul.npy")).astype(np.float32)

    # X_train_4th = np.load(os.path.join(DATA_DIR, "X_1-8.npy")).astype(np.float32)
    # y_train_bin_4th = np.load(os.path.join(DATA_DIR, "y_1-8_bin.npy")).astype(np.float32)
    # y_train_rul_4th = np.load(os.path.join(DATA_DIR, "y_1-8_rul.npy")).astype(np.float32)

    # --- test1-5 as test set
    # X_train = np.load(os.path.join(DATA_DIR, "X_train.npy")).astype(np.float32)
    # y_train_bin = np.load(os.path.join(DATA_DIR, "y_train_bin.npy")).astype(np.float32)
    # y_train_rul = np.load(os.path.join(DATA_DIR, "y_train_rul.npy")).astype(np.float32)
    # X_test = np.load(os.path.join(DATA_DIR, "X_1-5.npy")).astype(np.float32)
    # y_test_bin = np.load(os.path.join(DATA_DIR, "y_1-5_bin.npy")).astype(np.float32)
    # y_test_rul = np.load(os.path.join(DATA_DIR, "y_1-5_rul.npy")).astype(np.float32)

    # X_train_extra = np.load(os.path.join(DATA_DIR, "X_test.npy")).astype(np.float32)
    # y_test_bin_extra = np.load(os.path.join(DATA_DIR, "y_test_bin.npy")).astype(np.float32)
    # y_test_rul_extra = np.load(os.path.join(DATA_DIR, "y_test_rul.npy")).astype(np.float32)

    # X_train_4th = np.load(os.path.join(DATA_DIR, "X_1-8.npy")).astype(np.float32)
    # y_train_bin_4th = np.load(os.path.join(DATA_DIR, "y_1-8_bin.npy")).astype(np.float32)
    # y_train_rul_4th = np.load(os.path.join(DATA_DIR, "y_1-8_rul.npy")).astype(np.float32)

    # --- test1-8 as test set
    # X_train = np.load(os.path.join(DATA_DIR, "X_train.npy")).astype(np.float32)
    # y_train_bin = np.load(os.path.join(DATA_DIR, "y_train_bin.npy")).astype(np.float32)
    # y_train_rul = np.load(os.path.join(DATA_DIR, "y_train_rul.npy")).astype(np.float32)
    # X_test = np.load(os.path.join(DATA_DIR, "X_1-8.npy")).astype(np.float32)
    # y_test_bin = np.load(os.path.join(DATA_DIR, "y_1-8_bin.npy")).astype(np.float32)
    # y_test_rul = np.load(os.path.join(DATA_DIR, "y_1-8_rul.npy")).astype(np.float32)

    # X_train_extra = np.load(os.path.join(DATA_DIR, "X_test.npy")).astype(np.float32)
    # y_test_bin_extra = np.load(os.path.join(DATA_DIR, "y_test_bin.npy")).astype(np.float32)
    # y_test_rul_extra = np.load(os.path.join(DATA_DIR, "y_test_rul.npy")).astype(np.float32)

    # X_train_4th = np.load(os.path.join(DATA_DIR, "X_1-5.npy")).astype(np.float32)
    # y_train_bin_4th = np.load(os.path.join(DATA_DIR, "y_1-5_bin.npy")).astype(np.float32)
    # y_train_rul_4th = np.load(os.path.join(DATA_DIR, "y_1-5_rul.npy")).astype(np.float32)

    
    baseline_X = X_train[0]
    baseline_extra = X_train_extra[0]
    baseline_4th = X_train_4th[0]
    baseline_test_set = X_test[0]

    # Repeat baseline for each sample in its run
    baseline_train_2 = np.repeat(baseline_X[None, ...], len(X_train), axis=0)
    baseline_train_1 = np.repeat(baseline_extra[None, ...], len(X_train_extra), axis=0)
    baseline_train_3 = np.repeat(baseline_4th[None, ...], len(X_train_4th), axis=0)
    baseline_test = np.repeat(baseline_test_set[None, ...], len(X_test), axis=0)


    X_train = np.concatenate([X_train, X_train_extra, X_train_4th], axis=0)
    y_train_bin = np.concatenate([y_train_bin, y_test_bin_extra, y_train_bin_4th], axis=0)
    y_train_rul = np.concatenate([y_train_rul, y_test_rul_extra, y_train_rul_4th], axis=0)
    baseline_train_combined = np.concatenate([baseline_train_2, baseline_train_1, baseline_train_3], axis=0)

    # Compute max RUL on training set
    max_rul = y_train_rul.max()



    y_train = np.stack([y_train_bin, y_train_rul], axis=1)



    # train/val split

    X_tr, X_val, y_tr, y_val, baseline_tr, baseline_val = train_test_split(
        X_train,
        y_train,
        baseline_train_combined,
        test_size=0.2,
        stratify=y_train_bin,
        random_state=42,
    )
    
    y_binary_train = y_tr[:, 0]
    y_rul_train = y_tr[:, 1]

    y_binary_val = y_val[:, 0]
    y_rul_val = y_val[:, 1]

    # Scale RUL
    y_rul_train_scaled = y_rul_train / max_rul
    y_rul_val_scaled = y_rul_val / max_rul
    y_test_rul_scaled = y_test_rul / max_rul


    ###############################

    # Create Dataset and loader for training loop
    batch_size = 64

    train_dataset = MultiTaskCBMDataset(X_tr, y_binary_train, y_rul_train_scaled, baseline_tr)
    val_dataset = MultiTaskCBMDataset(X_val, y_binary_val, y_rul_val_scaled, baseline_val)
    test_dataset = MultiTaskCBMDataset(X_test, y_test_bin, y_test_rul_scaled, baseline_test)

  
    y_train_arr = y_binary_train.astype(int)
    class_counts = np.bincount(y_train_arr)
    class_weights = {0: 1.0, 1: class_counts[0] / max(class_counts[1], 1)}
    sample_weights = np.array([class_weights[int(lbl)] for lbl in y_train_arr], dtype=np.float32)
    sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, sampler=sampler)

    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)


    # create the model
    model = SiameseCBM(embed_dim=32)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    # compute pos_weight
    n_pos = float((y_train_bin == 1).sum())
    n_neg = float((y_train_bin == 0).sum())
    pos_weight = torch.tensor(n_neg / max(n_pos, 1.0), dtype=torch.float32).to(device)
    # Binary classification
    criterion_bin = nn.BCEWithLogitsLoss(pos_weight=pos_weight)  

    # RUL regression
    criterion_rul = nn.MSELoss()

    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, factor=0.5, patience=3)


    # training and validation
    num_epochs = 50
    threshold = 0.5
    lambda_bin = 1.0  # weight for binary task
    lambda_rul = 0.05  # weight for RUL task (tune based on scales)


    print("Model Training Loop Starting")

    best_val_loss = float('inf')
    best_model_state = None
    early_stop_patience = 10   # how many epochs to wait with no improvement
    epochs_no_improve = 0

    train_losses = []
    val_losses = []
for epoch in range(num_epochs):
    # ---- Training ----
    model.train()
    train_loss_total = 0.0
    train_bin_labels = []
    train_bin_preds = []
    train_rul_errors = []

    for baseline, current, y_bin_batch, y_rul_batch in train_loader:
        baseline = baseline.to(device)
        current = current.to(device)
        y_bin_batch = y_bin_batch.to(device)
        y_rul_batch = y_rul_batch.to(device)

        optimizer.zero_grad()
        bin_logits, rul_pred = model(baseline, current)

        loss_bin = criterion_bin(bin_logits, y_bin_batch)
        loss_rul = criterion_rul(rul_pred, y_rul_batch)
        loss = lambda_bin * loss_bin + lambda_rul * loss_rul

        loss.backward()
        optimizer.step()

        train_loss_total += loss.item() * y_bin_batch.size(0)

        # Track binary metrics
        probs = torch.sigmoid(bin_logits)
        preds = (probs > threshold).float()
        train_bin_labels.append(y_bin_batch.cpu())
        train_bin_preds.append(preds.cpu())

        # Track RUL metrics
        train_rul_errors.append((torch.abs(rul_pred - y_rul_batch) * max_rul).detach().cpu())


    train_loss_total /= len(train_loader.dataset)
    train_bin_labels = torch.cat(train_bin_labels).numpy()
    train_bin_preds = torch.cat(train_bin_preds).numpy()
    train_rul_errors = torch.cat(train_rul_errors).numpy()

    train_bin_acc = (train_bin_preds == train_bin_labels).mean()
    train_bin_f1 = f1_score(train_bin_labels, train_bin_preds, zero_division=0)
    train_rul_mae = train_rul_errors.mean()

    # ---- Validation ----
    model.eval()
    val_loss_total = 0.0
    val_bin_labels = []
    val_bin_preds = []
    val_rul_errors = []

    with torch.no_grad():
        for baseline, current, y_bin_batch, y_rul_batch in val_loader:
            baseline = baseline.to(device)
            current = current.to(device)
            y_bin_batch = y_bin_batch.to(device)
            y_rul_batch = y_rul_batch.to(device)

            bin_logits, rul_pred = model(baseline, current)
            loss_bin = criterion_bin(bin_logits, y_bin_batch)
            loss_rul = criterion_rul(rul_pred, y_rul_batch)
            loss = lambda_bin * loss_bin + lambda_rul * loss_rul

            val_loss_total += loss.item() * y_bin_batch.size(0)

            probs = torch.sigmoid(bin_logits)
            preds = (probs > threshold).float()
            val_bin_labels.append(y_bin_batch.cpu())
            val_bin_preds.append(preds.cpu())
            val_rul_errors.append((torch.abs(rul_pred - y_rul_batch) * max_rul).detach().cpu())


    val_loss_total /= len(val_loader.dataset)
    val_bin_labels = torch.cat(val_bin_labels).numpy()
    val_bin_preds = torch.cat(val_bin_preds).numpy()
    val_rul_errors = torch.cat(val_rul_errors).numpy()

    val_bin_acc = (val_bin_preds == val_bin_labels).mean()
    val_bin_f1 = f1_score(val_bin_labels, val_bin_preds, zero_division=0)
    val_rul_mae = val_rul_errors.mean()

    scheduler.step(val_loss_total)

    # Track best model (can use val loss or combined metric)
    if val_loss_total < best_val_loss:
        best_val_loss = val_loss_total
        epochs_no_improve = 0
        best_model_state = model.state_dict().copy()
    else:
        epochs_no_improve += 1
        print(f"No improvement for {epochs_no_improve} epoch(s).")

    if epochs_no_improve >= early_stop_patience:
        print("Early stopping triggered — training stopped.")
        break

    train_losses.append(train_loss_total)
    val_losses.append(val_loss_total)

    print(f"Epoch {epoch+1}/{num_epochs} | "
          f"Train Loss: {train_loss_total:.4f} | Val Loss: {val_loss_total:.4f} | "
          f"Train Bin Acc: {train_bin_acc:.2f} | Val Bin Acc: {val_bin_acc:.2f} | "
          f"Train Bin F1: {train_bin_f1:.2f} | Val Bin F1: {val_bin_f1:.2f} | "
          f"Train RUL MAE: {train_rul_mae:.2f} | Val RUL MAE: {val_rul_mae:.2f}")

# ---- Restore best model ----
if best_model_state is not None:
    model.load_state_dict(best_model_state)
    print(f"\nLoaded best model (val loss = {best_val_loss:.4f})")

plt.figure(figsize=(10, 6))
plt.plot(train_losses, label="Training Loss")
plt.plot(val_losses, label="Validation Loss")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.title("Training vs Validation Loss")
plt.legend()
plt.grid(True)
plt.show()


model.eval()
test_loss_total = 0.0

all_bin_labels = []
all_bin_preds = []
all_rul_labels = []
all_rul_preds = []

with torch.no_grad():
    for baseline, current, y_bin_batch, y_rul_batch in test_loader:
        baseline = baseline.to(device)
        current = current.to(device)
        y_bin_batch = y_bin_batch.to(device)
        y_rul_batch = y_rul_batch.to(device)

        # Forward pass
        bin_logits, rul_pred = model(baseline, current)

        # Compute loss
        loss_bin = criterion_bin(bin_logits, y_bin_batch)
        loss_rul = criterion_rul(rul_pred, y_rul_batch)
        loss = lambda_bin * loss_bin + lambda_rul * loss_rul

        test_loss_total += loss.item() * y_bin_batch.size(0)

        # Binary predictions
        probs = torch.sigmoid(bin_logits)
        preds_bin = (probs > threshold).float()

        all_bin_labels.append(y_bin_batch.cpu())
        all_bin_preds.append(preds_bin.cpu())

        # RUL predictions
        all_rul_labels.append((y_rul_batch * max_rul).cpu())
        all_rul_preds.append((rul_pred * max_rul).cpu())


# Aggregate
test_loss_total /= len(test_loader.dataset)

all_bin_labels = torch.cat(all_bin_labels).numpy()
all_bin_preds = torch.cat(all_bin_preds).numpy()
all_rul_labels = torch.cat(all_rul_labels).numpy()
all_rul_preds = torch.cat(all_rul_preds).numpy()

# Binary metrics
test_bin_acc = (all_bin_preds == all_bin_labels).mean()
test_bin_prec = precision_score(all_bin_labels, all_bin_preds, zero_division=0)
test_bin_rec = recall_score(all_bin_labels, all_bin_preds, zero_division=0)
test_bin_f1 = f1_score(all_bin_labels, all_bin_preds, zero_division=0)
cm = confusion_matrix(all_bin_labels, all_bin_preds)

# RUL metrics
test_rul_mae = mean_absolute_error(all_rul_labels, all_rul_preds)
test_rul_rmse = np.sqrt(mean_squared_error(all_rul_labels, all_rul_preds))

# Print results
print(f"\nTest Loss: {test_loss_total:.4f}")
print(f"Binary Task -> Acc: {test_bin_acc:.2f}, F1: {test_bin_f1:.2f}, Precision: {test_bin_prec:.2f}, Recall: {test_bin_rec:.2f}")
print("\nConfusion Matrix:\n", cm)
print("\nDetailed classification report:\n", classification_report(all_bin_labels, all_bin_preds, digits=3))
print(f"RUL Task -> MAE: {test_rul_mae:.4f}, RMSE: {test_rul_rmse:.4f}")


plt.figure(figsize=(12, 5))
plt.plot(all_rul_labels, label="True RUL")
plt.plot(all_rul_preds, label="Predicted RUL")
plt.xlabel("Timesteps (Sequential)")
plt.ylabel("RUL Value")
plt.title("True vs Predicted RUL Over Time")
plt.legend()
plt.tight_layout()
plt.show()

plt.figure(figsize=(12, 4))
plt.plot(all_bin_labels, label="True Label", linewidth=1)
plt.plot(all_bin_preds, label="Predicted Label", linewidth=1)
plt.xlabel("Timesteps (Sequential)")
plt.ylabel("Binary Label (0/1)")
plt.title("Binary Classification Over Time")
plt.legend()
plt.tight_layout()
plt.show()

window_len = X_train.shape[1] if 'X_train' in globals() else 30
n_features = X_train.shape[2] if 'X_train' in globals() else 1

X_shape = (1, window_len, n_features)

save_and_deploy(
    model=model,
    device=device,
    X_shape=X_shape,
    train_dir=ABS_PATH_DIR,
)