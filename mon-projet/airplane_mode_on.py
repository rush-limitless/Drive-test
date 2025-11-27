#!/usr/bin/env python3
"""
Script to enable airplane mode on connected Android device via ADB
"""

import subprocess
import sys
import time

def run_adb_command(command):
    """Execute ADB command and return result"""
    try:
        result = subprocess.run(
            ['adb'] + command,
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"ADB command failed: {e}")
        return None

def get_connected_devices():
    """Get list of connected devices"""
    output = run_adb_command(['devices'])
    if not output:
        return []
    
    devices = []
    lines = output.split('\n')[1:]  # Skip header
    for line in lines:
        if line.strip() and 'device' in line:
            device_id = line.split('\t')[0]
            devices.append(device_id)
    return devices

def enable_airplane_mode(device_id=None):
    """Enable airplane mode on specified device or first available device"""
    
    # Get connected devices
    devices = get_connected_devices()
    if not devices:
        print("No devices connected via ADB")
        return False
    
    # Use specified device or first available
    target_device = device_id if device_id else devices[0]
    if device_id and device_id not in devices:
        print(f"Device {device_id} not found in connected devices: {devices}")
        return False
    
    print(f"Enabling airplane mode on device: {target_device}")
    
    # Commands to enable airplane mode
    commands = [
        # Enable airplane mode
        ['shell', 'settings', 'put', 'global', 'airplane_mode_on', '1'],
        # Broadcast airplane mode change
        ['shell', 'am', 'broadcast', '-a', 'android.intent.action.AIRPLANE_MODE', '--ez', 'state', 'true']
    ]
    
    success = True
    for cmd in commands:
        if device_id:
            full_cmd = ['-s', target_device] + cmd
        else:
            full_cmd = cmd
            
        result = run_adb_command(full_cmd)
        if result is None:
            success = False
            break
    
    if success:
        print(f"Airplane mode enabled successfully on {target_device}")
        
        # Verify airplane mode is enabled
        time.sleep(2)
        verify_cmd = ['shell', 'settings', 'get', 'global', 'airplane_mode_on']
        if device_id:
            verify_cmd = ['-s', target_device] + verify_cmd
            
        result = run_adb_command(verify_cmd)
        if result == '1':
            print("Airplane mode status: ENABLED ✓")
        else:
            print("Airplane mode status: UNKNOWN")
    else:
        print("Failed to enable airplane mode")
    
    return success

if __name__ == "__main__":
    device_id = sys.argv[1] if len(sys.argv) > 1 else None
    enable_airplane_mode(device_id)