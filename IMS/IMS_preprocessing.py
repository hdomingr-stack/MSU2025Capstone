"""
---------------------------------------------------------------------------
IMS Bearing Dataset Preprocessing
---------------------------------------------------------------------------

Description:
    Preprocessing utilities for the NASA IMS bearing run-to-failure dataset.
    This script performs:
        • Feature extraction (max, RMS, std, kurtosis)
        • Mahalanobis distance–based anomaly scoring
        • Onset detection for degradation
        • Binary labeling and RUL (Remaining Useful Life) labeling
        • Scaling and windowing for model-ready inputs

"""


import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import os
import joblib
from scipy.stats import kurtosis
import matplotlib.pyplot as plt
from scipy.spatial.distance import mahalanobis
from scipy import linalg

ABS_PATH_DIR = os.path.dirname(os.path.abspath(__file__))

def feature_extraction(signal):
    features = {}
    features['max'] = np.max(signal)
    features['rms'] = np.sqrt(np.mean(signal**2))
    features['std'] = np.std(signal)
    features['kurtosis'] = kurtosis(signal)
    return list(features.values())


def mahalanobis_distance_series(feature_array, baseline_idx=0, reg=1e-6, window_size=30):
    """
    Compute Mahalanobis distance of each feature vector from baseline and return z-scored distances.
    
    feature_array: [num_samples, num_features]
    baseline_idx: starting index of baseline window
    window_size: number of samples used for baseline
    """
    # Use multiple rows for a more robust baseline
    baseline = feature_array[baseline_idx:baseline_idx + window_size]
    mu = np.mean(baseline, axis=0)
    
    # Regularized covariance
    cov = np.cov(baseline.T)
    cov += np.eye(cov.shape[0]) * reg
    invcov = linalg.inv(cov)

    # Mahalanobis distance for each feature vector
    dists = np.array([mahalanobis(x, mu, invcov) for x in feature_array])

    # Z-score relative to baseline
    baseline_mean = np.mean(dists[:window_size])
    baseline_std = np.std(dists[:window_size])
    z_dists = (dists - baseline_mean) / baseline_std

    return z_dists


def detect_onset(z_dists, baseline_size=20, z_thresh=3.0, persist=5):
    """
    Detect first index where z-scored distance exceeds threshold persistently.
    
    z_dists: Mahalanobis distances already z-scored per run
    baseline_size: initial healthy period
    z_thresh: z-score threshold for deviation
    persist: number of consecutive windows exceeding threshold
    """
    for i in range(baseline_size, len(z_dists) - persist + 1):
        if np.all(z_dists[i:i + persist] > z_thresh):
            return i, z_thresh
    return None, z_thresh

def labels_from_onset(num_samples, onset_idx):
    labels = np.zeros(num_samples, dtype=np.float32)
    if onset_idx is not None:
        labels[onset_idx:] = 1.0
    return labels


def label_rul(num_rows, onset_idx, max_healthy_rul=200):
    """
    Label RUL for one unit:
      - Healthy region: RUL = max_healthy_rul
      - Degrading region: linearly decreases from max_healthy_rul -> 0
    """
    rul = np.zeros(num_rows, dtype=np.float32)

    # Healthy region
    rul[:onset_idx] = max_healthy_rul

    # Degrading region
    if onset_idx < num_rows:
        decay_len = num_rows - onset_idx
        rul[onset_idx:] = np.linspace(max_healthy_rul, 0, decay_len, endpoint=True)

    return rul

def load_IMS_data(dir_path, channel, window_length = 30, scalers = None, manual_onset = None):
    files = sorted(f for f in os.listdir(dir_path) if not f.startswith('.'))
    feature_list = []
    rms_list = [] # rms can be used as pre-trainer / multi-task for model

    print(f"Amount of files: {len(files)}")

    # Loop through each file
    for file_name in files:
        data =  np.loadtxt(os.path.join(dir_path, file_name))
        #print(f"File: {file_name}, raw data shape: {data.shape}")  
        # size of sampled_signal should be [20480,] or 20 kHz
        sampled_signal = data[:, channel-1] # retrieve signal from only the channel selected
        #print(f"Signal shape: {sampled_signal.shape}")  # should be (20480,) for IMS

        features = feature_extraction(sampled_signal)
        #print(f"Features length: {len(features)}, Features: {features}")

        feature_list.append(features)
        rms_list.append(features[1]) # just rms for label list

        
    feature_array = np.array(feature_list)
    num_rows = len(feature_array) # need number of data for RUL calculation (run-to-failture)

    # Mahalanobis-based labeling  
    dists = mahalanobis_distance_series(feature_array)
    dists_smooth = moving_average(dists, w=5)
    onset_idx, threshold = detect_onset(dists_smooth)

    if manual_onset:
        onset_idx = manual_onset
    
    # Binary label
    binary_labels = labels_from_onset(num_rows, onset_idx)
    print(f"Detected onset at index {onset_idx}, threshold={threshold:.3f}")

    # RUL label
    rul = label_rul(num_rows, onset_idx, max_healthy_rul=200)

    return feature_array, binary_labels, rul


def moving_average(x, w=5):
    return np.convolve(x, np.ones(w)/w, mode='valid')

def make_windows(features, labels_bin, labels_rul, window_length = 30):
    X, y_bin, y_rul = [], [], []
    n = len(features)
    for i in range(n - window_length + 1):
        X.append(features[i:i+window_length])
        y_bin.append(labels_bin[i+window_length-1])
        y_rul.append(labels_rul[i+window_length-1])
    return np.array(X), np.array(y_bin), np.array(y_rul)

if __name__ == "__main__":

    train_dir = os.path.join(ABS_PATH_DIR, "IMS/2nd_test")
    test_dir = os.path.join(ABS_PATH_DIR, "IMS/3rd_test")
    train_dir_extra = os.path.join(ABS_PATH_DIR, "IMS/1st_test")


    # --- preloader calls

    # X_train, y_train_bin, y_train_rul, feature_array, scalers = load_IMS_data(train_dir, 1, manual_onset=698)
    # X_test, y_test_bin, y_test_rul, feature_array2, _ = load_IMS_data(test_dir, 3, scalers=scalers, manual_onset=6130)
    # X_train_extra, y_train_extra_bin, y_train_extra_rul, _, _ = load_IMS_data(train_dir_extra, 5, scalers=scalers, manual_onset=1830)
    # X_train_4th, y_train_4th_bin, y_train_4th_rul, _, _ = load_IMS_data(train_dir_extra, 8, scalers=scalers, manual_onset=1616)

    # X_2nd, y_2nd_bin, y_2nd_rul = load_IMS_data(train_dir, 1, manual_onset=698)
    # X_3rd, y_3rd_bin, y_3rd_rul = load_IMS_data(test_dir, 3, manual_onset=6130)
    # X_1st_5, y_1st_5_bin, y_1st_5_rul = load_IMS_data(train_dir_extra, 5, manual_onset=1830)
    # X_1st_8, y_1st_8_bin, y_1st_8_rul = load_IMS_data(train_dir_extra, 8, manual_onset=1616)


    # --- load saved raw data (only if skipping preload)

    X_2nd, y_2nd_bin, y_2nd_rul = (
    np.load(os.path.join(ABS_PATH_DIR, "rawdata/X_2nd.npy")),
    np.load(os.path.join(ABS_PATH_DIR, "rawdata/y_2nd_bin.npy")),
    np.load(os.path.join(ABS_PATH_DIR, "rawdata/y_2nd_rul.npy")),
)
    X_3rd, y_3rd_bin, y_3rd_rul = (
    np.load(os.path.join(ABS_PATH_DIR, "rawdata/X_3rd.npy")),
    np.load(os.path.join(ABS_PATH_DIR, "rawdata/y_3rd_bin.npy")),
    np.load(os.path.join(ABS_PATH_DIR, "rawdata/y_3rd_rul.npy")),
)
    X_1st_5, y_1st_5_bin, y_1st_5_rul = (
    np.load(os.path.join(ABS_PATH_DIR, "rawdata/X_1st_5.npy")),
    np.load(os.path.join(ABS_PATH_DIR, "rawdata/y_1st_5_bin.npy")),
    np.load(os.path.join(ABS_PATH_DIR, "rawdata/y_1st_5_rul.npy")),
)
    X_1st_8, y_1st_8_bin, y_1st_8_rul = (
    np.load(os.path.join(ABS_PATH_DIR, "rawdata/X_1st_8.npy")),
    np.load(os.path.join(ABS_PATH_DIR, "rawdata/y_1st_8_bin.npy")),
    np.load(os.path.join(ABS_PATH_DIR, "rawdata/y_1st_8_rul.npy")),
)

    # --- save the raw data

    # np.save(os.path.join(ABS_PATH_DIR, "rawdata/X_2nd.npy"), X_2nd)
    # np.save(os.path.join(ABS_PATH_DIR, "rawdata/y_2nd_bin.npy"), y_2nd_bin)
    # np.save(os.path.join(ABS_PATH_DIR, "rawdata/y_2nd_rul.npy"), y_2nd_rul)

    # np.save(os.path.join(ABS_PATH_DIR, "rawdata/X_3rd.npy"), X_3rd)
    # np.save(os.path.join(ABS_PATH_DIR, "rawdata/y_3rd_bin.npy"), y_3rd_bin)
    # np.save(os.path.join(ABS_PATH_DIR, "rawdata/y_3rd_rul.npy"), y_3rd_rul)

    # np.save(os.path.join(ABS_PATH_DIR, "rawdata/X_1st_5.npy"), X_1st_5)
    # np.save(os.path.join(ABS_PATH_DIR, "rawdata/y_1st_5_bin.npy"), y_1st_5_bin)
    # np.save(os.path.join(ABS_PATH_DIR, "rawdata/y_1st_5_rul.npy"), y_1st_5_rul)

    # np.save(os.path.join(ABS_PATH_DIR, "rawdata/X_1st_8.npy"), X_1st_8)
    # np.save(os.path.join(ABS_PATH_DIR, "rawdata/y_1st_8_bin.npy"), y_1st_8_bin)
    # np.save(os.path.join(ABS_PATH_DIR, "rawdata/y_1st_8_rul.npy"), y_1st_8_rul)


    # training datasets (exclude test set)
    raw_train_rows = np.concatenate([X_1st_8, X_2nd, X_1st_5], axis=0)

    feature_names = ['max', 'rms', 'std', 'kurtosis']


    scalers = {}

    # create per feature scalers
    for i, name in enumerate(feature_names):
        scaler = StandardScaler()
        scaler.fit(raw_train_rows[:, i].reshape(-1, 1))
        scalers[name] = scaler

    
    X_2nd_scaled = np.zeros_like(X_2nd)
    X_1st_5_scaled = np.zeros_like(X_1st_5)
    X_1st_8_scaled = np.zeros_like(X_1st_8)
    X_3rd_scaled = np.zeros_like(X_3rd)
    for i, name in enumerate(feature_names):
        if name not in scalers:
            raise KeyError(f"Scaler for feature '{name}' not provided.")
        X_2nd_scaled[:, i] = scalers[name].transform(X_2nd[:, i].reshape(-1, 1)).ravel()
        X_1st_5_scaled[:, i] = scalers[name].transform(X_1st_5[:, i].reshape(-1, 1)).ravel()
        X_1st_8_scaled[:, i] = scalers[name].transform(X_1st_8[:, i].reshape(-1, 1)).ravel()
        X_3rd_scaled[:, i] = scalers[name].transform(X_3rd[:, i].reshape(-1, 1)).ravel()


    # window the data
    X_2nd_windowed, y_2nd_bin_windowed, y_2nd_rul_windowed = make_windows(X_2nd_scaled, y_2nd_bin, y_2nd_rul)
    X_1st_5_windowed, y_1st_5_bin_windowed, y_1st_5_rul_windowed = make_windows(X_1st_5_scaled, y_1st_5_bin, y_1st_5_rul)
    X_1st_8_windowed, y_1st_8_bin_windowed, y_1st_8_rul_windowed = make_windows(X_1st_8_scaled, y_1st_8_bin, y_1st_8_rul)
    X_3rd_windowed, y_3rd_bin_windowed, y_3rd_rul_windowed = make_windows(X_3rd_scaled, y_3rd_bin, y_3rd_rul)
        

    SAVE_DIR = os.path.join(ABS_PATH_DIR, "data/test3")

    np.save(os.path.join(SAVE_DIR, "X_train.npy"), X_2nd_windowed)
    np.save(os.path.join(SAVE_DIR, "y_train_bin.npy"), y_2nd_bin_windowed)
    np.save(os.path.join(SAVE_DIR, "y_train_rul.npy"), y_2nd_rul_windowed)

    np.save(os.path.join(SAVE_DIR, "X_test.npy"), X_3rd_windowed)
    np.save(os.path.join(SAVE_DIR, "y_test_bin.npy"), y_3rd_bin_windowed)
    np.save(os.path.join(SAVE_DIR, "y_test_rul.npy"), y_3rd_rul_windowed)

    np.save(os.path.join(SAVE_DIR, "X_1-5.npy"), X_1st_5_windowed)
    np.save(os.path.join(SAVE_DIR, "y_1-5_bin.npy"), y_1st_5_bin_windowed)
    np.save(os.path.join(SAVE_DIR, "y_1-5_rul.npy"), y_1st_5_rul_windowed)

    np.save(os.path.join(SAVE_DIR, "X_1-8.npy"), X_1st_8_windowed)
    np.save(os.path.join(SAVE_DIR, "y_1-8_bin.npy"), y_1st_8_bin_windowed)
    np.save(os.path.join(SAVE_DIR, "y_1-8_rul.npy"), y_1st_8_rul_windowed)
    

    joblib.dump(scalers, os.path.join(ABS_PATH_DIR, "data/scalers.pkl"))

