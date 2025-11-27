#!/bin/bash
# Network Status Checks

# Check Signal Strength
check_signal() {
    echo "=== Signal Strength ==="
    adb shell dumpsys telephony.registry | grep -i signal
}

# Check Network Registration
check_registration() {
    echo "=== Network Registration ==="
    adb shell dumpsys telephony.registry | grep -i service
}

# Check IP Configuration
check_ip() {
    echo "=== IP Configuration ==="
    adb shell ip addr show
    echo "=== Routes ==="
    adb shell ip route show
}

case "$1" in
    signal)
        check_signal
        ;;
    registration)
        check_registration
        ;;
    ip)
        check_ip
        ;;
    all)
        check_signal
        check_registration
        check_ip
        ;;
    *)
        echo "Usage: $0 {signal|registration|ip|all}"
        exit 1
        ;;
esac