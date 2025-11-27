#!/usr/bin/env python3
"""
Check device network and battery status via ADB
"""

import subprocess
import sys

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

def get_connected_device():
    """Get first connected device"""
    output = run_adb_command(['devices'])
    if not output:
        return None
    
    lines = output.split('\n')[1:]  # Skip header
    for line in lines:
        if line.strip() and 'device' in line:
            device_id = line.split('\t')[0]
            return device_id
    return None

def check_device_status():
    """Check network type, data network, and battery level"""
    
    device_id = get_connected_device()
    if not device_id:
        print("No device connected via ADB")
        return
    
    print(f"Checking status for device: {device_id}")
    print("=" * 50)
    
    # Check GSM network type
    print("1. GSM Network Type:")
    result = run_adb_command(['-s', device_id, 'shell', 'getprop', 'gsm.network.type'])
    if result:
        print(f"   {result}")
    else:
        print("   Failed to get network type")
    
    print()
    
    # Check data network type
    print("2. Data Network Type:")
    result = run_adb_command(['-s', device_id, 'shell', 'dumpsys', 'telephony.registry'])
    if result:
        lines = result.split('\n')
        data_network_lines = [line for line in lines if 'mDataNetworkType' in line.lower()]
        if data_network_lines:
            for line in data_network_lines:
                print(f"   {line.strip()}")
        else:
            print("   No mDataNetworkType found")
    else:
        print("   Failed to get telephony registry")
    
    print()
    
    # Check battery level
    print("3. Battery Level:")
    result = run_adb_command(['-s', device_id, 'shell', 'dumpsys', 'battery'])
    if result:
        lines = result.split('\n')
        level_lines = [line for line in lines if 'level' in line.lower()]
        if level_lines:
            for line in level_lines:
                print(f"   {line.strip()}")
        else:
            print("   No battery level found")
    else:
        print("   Failed to get battery info")

if __name__ == "__main__":
    check_device_status()