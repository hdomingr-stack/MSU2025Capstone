"""
---------------------------------------------------------------------------
IMS Feature Visualization
---------------------------------------------------------------------------

Description:
    This script loads precomputed feature arrays for an IMS bearing run and
    visualizes the evolution of key statistical features over time:
        • Max amplitude
        • RMS
        • Standard deviation
        • Kurtosis

    Each feature is smoothed using a Savitzky–Golay filter to highlight trends
    while suppressing noise.

Notes:
    numpy load the features from preprocessing, store and load the file from IMS/rawdata
"""

import numpy as np
import os
import matplotlib.pyplot as plt
from scipy.signal import savgol_filter


ABS_PATH_DIR = os.path.dirname(os.path.abspath(__file__))
features = np.load(os.path.join(ABS_PATH_DIR, "rawdata/X_3rd.npy")).astype(np.float32)

time = np.arange(len(features))

max_vals = features[:,0]
rms_vals = features[:,1]
std_vals = features[:,2]
kurt_vals = features[:,3]


plt.figure(figsize=(12,8))

plt.subplot(4,1,1)
plt.plot(time, savgol_filter(max_vals, 11, 2), label="Max (smooth)")
plt.ylabel("Max"); plt.legend()

plt.subplot(4,1,2)
plt.plot(time, savgol_filter(rms_vals, 11, 2), label="RMS (smooth)", color='orange')
plt.ylabel("RMS"); plt.legend()

plt.subplot(4,1,3)
plt.plot(time, savgol_filter(std_vals, 11, 2), label="Std (smooth)", color='green')
plt.ylabel("Std"); plt.legend()

plt.subplot(4,1,4)
plt.plot(time, savgol_filter(kurt_vals, 11, 2), label="Kurtosis (smooth)", color='red')
plt.ylabel("Kurtosis"); plt.xlabel("Timestep")
plt.legend()

plt.tight_layout()
plt.show()
