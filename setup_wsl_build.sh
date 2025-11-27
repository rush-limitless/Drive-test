#!/bin/bash
echo "========================================="
echo " SETUP WSL BUILD ENVIRONMENT"
echo "========================================="

# Install Node.js and npm if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install Python and pip if not present
if ! command -v python3 &> /dev/null; then
    echo "Installing Python..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip
fi

# Install PyInstaller
echo "Installing PyInstaller..."
pip3 install pyinstaller

# Install required system packages for Electron
echo "Installing system dependencies..."
sudo apt-get install -y libnss3-dev libatk-bridge2.0-dev libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2

# Create project directory
mkdir -p ~/adb-project

echo "WSL environment ready for Linux builds!"