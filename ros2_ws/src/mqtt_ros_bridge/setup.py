from setuptools import find_packages, setup

import os
from glob import glob

package_name = 'mqtt_ros_bridge'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),

        #('share/' + package_name + '/launch', ['launch/pipeline.launch.py']),
        (os.path.join('share', package_name, 'launch'), glob('launch/pipeline.launch.py')),

        (os.path.join('share', package_name, 'config'), glob('config/pipeline_params.yaml')),

    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Daniel Chen',
    maintainer_email='chenda18@msu.edu',
    description='MQTT Bridge to System',
    license='TODO: License declaration',
    tests_require=['pytest'],
    entry_points={
    'console_scripts': [
        'mqtt_bridge = mqtt_ros_bridge.mqtt_bridge:main',
        'preprocessing = mqtt_ros_bridge.preprocessing:main',
        'data_storage = mqtt_ros_bridge.data_storage:main',
        'model = mqtt_ros_bridge.model:main',
        'post_processing = mqtt_ros_bridge.post_processing:main',
        'simulation_test = mqtt_ros_bridge.simulation_test:main',
        'control_node = mqtt_ros_bridge.control_node:main',
        ],
    },

)
