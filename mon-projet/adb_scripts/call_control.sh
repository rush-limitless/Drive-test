#!/bin/bash
# Enhanced Call Control Functions for Multiple Calls with Talk Duration

# Initiate Call
initiate_call() {
    local number="$1"
    local talk_duration="$2"

    if [ -z "$number" ] || [ -z "$talk_duration" ]; then
        echo "Usage: initiate_call <number> <talk_duration_sec>"
        return 1
    fi

    # Start call
    adb shell am start -a android.intent.action.CALL -d tel:$number
}

# End Current Call
end_call() {
    adb shell input keyevent KEYCODE_ENDCALL
}

# Reject Incoming Call
reject_call() {
    adb shell input keyevent KEYCODE_ENDCALL
}

# Wait until call is answered
wait_for_answer() {
    local timeout="${1:-60}"  # default 60s timeout
    local elapsed=0
    local state

    while [ $elapsed -lt $timeout ]; do
        state=$(adb shell dumpsys telephony.registry | grep -o "mCallState=[0-9]" | tail -1 | awk -F= '{print $2}')
        if [ "$state" == "2" ]; then
            return 0  # call answered (OFFHOOK)
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done
    return 1  # timed out
}

# Run Multiple Calls
multi_call() {
    local number="$1"
    local talk_duration="$2"
    local call_count="$3"

    for ((i=1; i<=call_count; i++)); do
        echo "Starting call #$i to $number"
        initiate_call "$number" "$talk_duration"

        if wait_for_answer 120; then
            echo "Call #$i answered, talking for $talk_duration seconds..."
            sleep "$talk_duration"
            end_call
            echo "Call #$i ended."
        else
            echo "Call #$i not answered (timeout), hanging up..."
            end_call
        fi

        # Small pause between calls
        sleep 3
    done
}

case "$1" in
    initiate)
        initiate_call "$2" "$3"
        ;;
    end)
        end_call
        ;;
    reject)
        reject_call
        ;;
    multi)
        multi_call "$2" "$3" "$4"
        ;;
    *)
        echo "Usage: $0 {initiate <number> <talk_duration>|end|reject|multi <number> <talk_duration> <call_count>}"
        exit 1
        ;;
esac