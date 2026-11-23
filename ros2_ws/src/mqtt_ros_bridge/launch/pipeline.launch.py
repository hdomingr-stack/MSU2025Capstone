from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, TimerAction
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    pkg_share_dir = get_package_share_directory('mqtt_ros_bridge')
    param_file_path = os.path.join(pkg_share_dir, 'config', 'pipeline_params.yaml')

    run_sim = LaunchConfiguration('run_sim')

    return LaunchDescription([
        DeclareLaunchArgument('run_sim', default_value='False', description='Start the simulation node'),

        Node(package='mqtt_ros_bridge', executable='mqtt_bridge', name='bridge', output='screen', parameters=[param_file_path]),

        TimerAction(period=0.1, actions=[
            Node(package='mqtt_ros_bridge', executable='control_node', name='admin_control', output='screen', parameters=[param_file_path])
        ]),
        # Simulation publisher only when run_sim:=true
        TimerAction(period=0.2, actions=[
            Node(package='mqtt_ros_bridge', executable='simulation_test', name='simulation_test', output='screen', condition=IfCondition(run_sim), parameters=[param_file_path])
        ]),

        TimerAction(period=0.5, actions=[
            Node(package='mqtt_ros_bridge', executable='preprocessing', name='preprocess', output='screen', parameters=[param_file_path])
        ]),

        TimerAction(period=1.5, actions=[
            Node(package='mqtt_ros_bridge', executable='model', name='model', output='screen', parameters=[param_file_path])
        ]),

        TimerAction(period=2.0, actions=[
            Node(package='mqtt_ros_bridge', executable='post_processing', name='post_processing', output='screen', parameters=[param_file_path])
        ])
    ])
