# 📱 MOBIQ - Executable Installation and User Guide

<div align="center">
    <h1>🖥️ MOBIQ Desktop Application</h1>
    <h3><em>Complete guide for MOBIQ executable installation and usage</em></h3>
    <p><strong>Simple Installation • Electron Interface • Ready to Use</strong></p>
</div>

---

## 📋 Table of Contents

1. [💾 Download and Installation](#-download-and-installation)
2. [🚀 First Launch](#-first-launch)
3. [🔧 Initial Configuration](#-initial-configuration)
4. [📱 Device Connection](#-device-connection)
5. [🖥️ Electron Interface](#️-electron-interface)
6. [🧪 Using Tests](#-using-tests)
7. [🔄 Automated Workflows](#-automated-workflows)
8. [📊 Monitoring and Reports](#-monitoring-and-reports)
9. [⚙️ Settings and Preferences](#️-settings-and-preferences)
10. [🔍 Troubleshooting](#-troubleshooting)

---

## 💾 Download and Installation

### System Requirements

**Minimum:**
- **OS**: Windows 10 (64-bit) or higher
- **RAM**: 4 GB minimum (8 GB recommended)
- **Storage**: 500 MB free space
- **USB**: USB 2.0 port or higher for Android connection

**Recommended:**
- **OS**: Windows 11
- **RAM**: 8 GB or more
- **Storage**: 1 GB free space
- **USB**: USB 3.0 port for better performance

### 1. Executable Download

*[📸 Insert download page screenshot here]*
**Suggested photo location**: `media/screenshots/download-page.png`

1. **Access the download page**:
   - Official website: `https://mobiq-framework.com/download`
   - Or from GitHub Releases

2. **Select version**:
   - `MOBIQ-Setup-v2.2.0.exe` (Full version with installer)
   - `MOBIQ-Portable-v2.2.0.zip` (Portable version)

3. **Verify integrity**:
   - SHA256 checksum provided on page
   - Verified digital signature

### 2. Installation with Installer

*[📸 Insert installer screenshot here]*
**Suggested photo location**: `media/screenshots/installer-welcome.png`

#### Step 1: Installer Launch
1. **Run** `MOBIQ-Setup-v2.2.0.exe` as administrator
2. **Accept** Windows security warning if necessary
3. **Click** "Next" on the welcome screen

#### Step 2: License and Terms

*[📸 Insert license screenshot here]*
**Suggested photo location**: `media/screenshots/installer-license.png`

1. **Read** the MIT license terms
2. **Check** "I accept the license terms"
3. **Click** "Next"

#### Step 3: Installation Directory Choice

*[📸 Insert directory choice screenshot here]*
**Suggested photo location**: `media/screenshots/installer-directory.png`

1. **Default directory**: `C:\Program Files\MOBIQ Framework\`
2. **Customize** if needed with "Browse"
3. **Check** available space (minimum 500 MB)
4. **Click** "Next"

#### Step 4: Components to Install

*[📸 Insert components screenshot here]*
**Suggested photo location**: `media/screenshots/installer-components.png`

**Available components:**
- ✅ **Main application** (required)
- ✅ **ADB drivers** (recommended)
- ✅ **Test modules** (required)
- ⬜ **Examples and tutorials** (optional)
- ⬜ **Offline documentation** (optional)

#### Step 5: Shortcuts and Options

*[📸 Insert options screenshot here]*
**Suggested photo location**: `media/screenshots/installer-shortcuts.png`

**Available options:**
- ✅ Create Desktop shortcut
- ✅ Add to Start Menu
- ✅ Create Taskbar shortcut
- ⬜ Launch MOBIQ at Windows startup
- ✅ Associate .mobiq files with application

#### Step 6: Installation

*[📸 Insert installation progress screenshot here]*
**Suggested photo location**: `media/screenshots/installer-progress.png`

1. **Click** "Install"
2. **Wait** for installation completion (2-5 minutes)
3. **Progress** displayed in real-time:
   - File extraction
   - ADB drivers installation
   - Service configuration
   - Shortcut creation

#### Step 7: Completion

*[📸 Insert completion screenshot here]*
**Suggested photo location**: `media/screenshots/installer-finish.png`

1. **Installation completed** successfully
2. **Final options**:
   - ✅ Launch MOBIQ now
   - ⬜ Show release notes
3. **Click** "Finish"

### 3. Portable Installation (Alternative)

For portable version:
1. **Extract** `MOBIQ-Portable-v2.2.0.zip`
2. **Run** `MOBIQ.exe` directly
3. **No system installation** required

---

## 🚀 First Launch

### 1. Startup Screen

*[📸 Insert startup screen screenshot here]*
**Suggested photo location**: `media/screenshots/startup-screen.png`

On first launch, MOBIQ displays:
- **Animated logo** with progress bar
- **Component verification**:
  - ✅ ADB Engine
  - ✅ Test Modules
  - ✅ User Interface
  - ✅ Local Database

### 2. Initial Configuration Wizard

*[📸 Insert wizard screenshot here]*
**Suggested photo location**: `media/screenshots/setup-wizard.png`

#### Step 1: Welcome
- **Welcome message** to MOBIQ
- **Overview** of main features
- **Click** "Start Configuration"

#### Step 2: ADB Verification

*[📸 Insert ADB verification screenshot here]*
**Suggested photo location**: `media/screenshots/adb-check.png`

1. **Automatic test** for ADB presence
2. **Possible results**:
   - ✅ **ADB detected**: Version X.X.X found
   - ❌ **ADB missing**: Automatic installation offered
   - ⚠️ **Outdated version**: Update recommended

3. **Automatic actions**:
   - ADB installation if missing
   - System PATH configuration
   - Functionality test

#### Step 3: User Preferences

*[📸 Insert preferences screenshot here]*
**Suggested photo location**: `media/screenshots/user-preferences.png`

**Custom configuration:**
- **Language**: French / English
- **Theme**: Light / Dark / Automatic
- **Notifications**: Enabled / Disabled
- **Auto-start**: Yes / No
- **Working folder**: Directory choice for reports

#### Step 4: Connectivity Test

*[📸 Insert connectivity test screenshot here]*
**Suggested photo location**: `media/screenshots/connectivity-test.png`

1. **Message**: "Connect an Android device to test"
2. **Instructions**:
   - Enable USB debugging
   - Connect via USB cable
   - Authorize on device
3. **Automatic test** as soon as device is detected

---

## 🔧 Initial Configuration

### 1. MOBIQ Main Window

*[📸 Insert main window screenshot here]*
**Suggested photo location**: `media/screenshots/main-window.png`

**Interface elements:**
- **Title bar**: MOBIQ logo + window controls
- **Main menu**: File, Edit, View, Tools, Help
- **Toolbar**: Shortcuts to main functions
- **Side panel**: Navigation between sections
- **Main area**: Dynamic content by section
- **Status bar**: System information and connections

### 2. Preferences Configuration

*[📸 Insert detailed preferences screenshot here]*
**Suggested photo location**: `media/screenshots/detailed-preferences.png`

#### Accessing Preferences
- **Menu**: `Tools` → `Preferences`
- **Shortcut**: `Ctrl + ,`
- **Icon**: ⚙️ in toolbar

#### General Tab
- **Interface language**: French/English
- **Visual theme**: Light/Dark/Auto
- **Startup**: Launch at Windows startup
- **Updates**: Automatic checking

#### ADB and Devices Tab
- **ADB path**: Automatic detection or manual
- **Connection timeout**: 30 seconds (default)
- **Device polling**: Check interval
- **ADB logs**: Detail level

#### Tests and Modules Tab
- **Default timeout**: 60 seconds
- **Automatic retry**: Number of attempts
- **Results backup**: Retention duration
- **Active modules**: Selection of available modules

#### Reports Tab
- **Default format**: PDF/Excel/CSV
- **Save folder**: Directory choice
- **Automatic generation**: After each test
- **Compression**: Automatic archives

---

## 📱 Device Connection

### 1. Android Device Preparation

*[📸 Insert Android settings screenshot here]*
**Suggested photo location**: `media/screenshots/android-settings.png`

#### Developer Mode Activation
1. **Open** `Settings` on Android device
2. **Navigate** to `About phone`
3. **Tap 7 times** on `Build number`
4. **Message**: "You are now a developer"

#### USB Debugging Activation
1. **Return** to `Settings`
2. **New section**: `Developer options`
3. **Enable** `USB debugging`
4. **Confirm** in dialog box

### 2. Physical Connection

*[📸 Insert USB connection screenshot here]*
**Suggested photo location**: `media/screenshots/usb-connection.png`

#### Connection Steps
1. **Connect** device via USB cable
2. **Select** "File transfer" on device
3. **Allow** USB debugging when prompted
4. **Check** "Always allow from this computer"

### 3. Detection in MOBIQ

*[📸 Insert device detection screenshot here]*
**Suggested photo location**: `media/screenshots/device-detection.png`

#### Connected Devices Panel
- **Access**: Click "Devices" in side panel
- **Automatic detection**: Refresh every 5 seconds
- **Real-time status**: Connected/Disconnected/Testing

#### Displayed Information
- **Model name**: Ex. "Samsung Galaxy S21"
- **ADB ID**: Unique identifier
- **Android version**: Ex. "Android 12 (API 31)"
- **Battery status**: Percentage and charging state
- **Network operator**: Ex. "Orange F"

### 4. Connection Test

*[📸 Insert connection test screenshot here]*
**Suggested photo location**: `media/screenshots/connection-test.png`

#### Automatic Test
1. **Right-click** on detected device
2. **Select** "Test connection"
3. **Results**:
   - ✅ ADB Connection: OK
   - ✅ Permissions: Granted
   - ✅ Responsiveness: Normal
   - ✅ Ready for testing

---

## 🖥️ Electron Interface

### 1. Main Navigation

*[📸 Insert navigation screenshot here]*
**Suggested photo location**: `media/screenshots/main-navigation.png`

#### Left Side Panel
- **🏠 Home**: Overview and status
- **📱 Devices**: Connected device management
- **🧪 Tests**: Available test modules
- **🔄 Workflows**: Automated sequences
- **📊 Reports**: History and analytics
- **⚙️ Settings**: Application configuration

#### Top Toolbar
- **🔄 Refresh**: Refresh data
- **▶️ Quick Launch**: Express test
- **📸 Screenshot**: Device screenshots
- **🔍 Search**: Global search
- **❓ Help**: Documentation and support

### 2. Home Page (Dashboard)

*[📸 Insert Electron dashboard screenshot here]*
**Suggested photo location**: `media/screenshots/electron-dashboard.png`

#### Status Widgets
- **Connected Devices**: Number and quick list
- **Active Tests**: Currently running tests
- **Latest Results**: Summary of last 5 tests
- **System Health**: CPU, RAM, storage

#### Real-time Charts
- **Success Rate**: Pie chart
- **Performance**: Line chart over 24h
- **Module Usage**: Bar chart
- **Network Activity**: Live monitoring

#### Quick Actions
- **Express Call Test**: Green "Call Test" button
- **Quick Ping**: Blue "Network Test" button
- **Global Capture**: Orange "Screenshot All" button

### 3. Integrated Device Manager

*[📸 Insert integrated manager screenshot here]*
**Suggested photo location**: `media/screenshots/integrated-device-manager.png`

#### Device List View
- **Device cards**: One card per connected device
- **Live information**: Battery, signal, temperature
- **Direct actions**: Action buttons on each card
- **Filtering**: By status, model, operator

#### Actions per Device
- **📋 Details**: Popup window with complete information
- **🧪 Quick Test**: Dropdown menu of common tests
- **📸 Screenshot**: Immediate capture
- **🔄 Restart**: Device restart
- **⚙️ Settings**: Specific configuration

---

## 🧪 Using Tests

### 1. Test Module Selection

*[📸 Insert module selection screenshot here]*
**Suggested photo location**: `media/screenshots/test-module-selection.png`

#### Selection Interface
1. **Click** "Tests" in side panel
2. **Browse** categories:
   - 📞 **Calls and Voice** (5 modules)
   - 📶 **Network and Connectivity** (8 modules)
   - 💬 **Messaging** (3 modules)
   - 📱 **Device Control** (6 modules)
   - 🔧 **Advanced** (7 modules)

3. **Search**: Search bar at top
4. **Favorites**: Star to mark frequent modules

### 2. Test Configuration

*[📸 Insert test configuration screenshot here]*
**Suggested photo location**: `media/screenshots/test-configuration.png`

#### Example: Voice Call Test

**Step 1: Module Selection**
1. **Click** on "voice_call_test"
2. **Description** displayed automatically
3. **Required parameters** listed

**Step 2: Parameter Configuration**
- **Phone number**: Required text field
- **Call duration**: Slider 5-300 seconds
- **Number of calls**: Selector 1-10
- **Delay between calls**: 0-60 seconds

**Step 3: Device Selection**
- **Available devices** list
- **Multiple selection** possible
- **Status** of each device verified

### 3. Execution and Monitoring

*[📸 Insert execution screenshot here]*
**Suggested photo location**: `media/screenshots/test-execution-electron.png`

#### Test Launch
1. **"Start Test" button**: Green, bottom right
2. **Confirmation**: Parameter validation popup
3. **Immediate start**: Switch to monitoring mode

#### Real-time Monitoring Interface
- **Progress bar**: Global percentage
- **Current steps**: Detail of current action
- **Live logs**: Automatic scrolling of events
- **Live metrics**: Elapsed time, success/failures

#### Controls During Execution
- **⏸️ Pause**: Temporarily suspend
- **⏹️ Stop**: Terminate prematurely
- **📊 Details**: Detailed logs window
- **📸 Capture**: Screenshot of current state

### 4. Results and Analysis

*[📸 Insert results screenshot here]*
**Suggested photo location**: `media/screenshots/test-results.png`

#### Results Screen
- **Global status**: ✅ Success / ❌ Failure / ⚠️ Partial
- **Total duration**: Complete execution time
- **Details per device**: Individual results
- **Key metrics**: According to test type

#### Post-Test Actions
- **💾 Save**: Export report
- **🔄 Relaunch**: Same configuration
- **📧 Share**: Send by email
- **📋 Copy**: Results to clipboard

---

## 🔄 Automated Workflows

### 1. Workflow Creation

*[📸 Insert workflow creation screenshot here]*
**Suggested photo location**: `media/screenshots/workflow-creation.png`

#### Design Interface
1. **Access**: Click "Workflows" in side panel
2. **New Workflow**: "+" button top right
3. **Workflow name**: Enter descriptive name
4. **Description**: Purpose and usage context

#### Drag-and-Drop Modules
- **Module library**: Right panel
- **Design area**: Center of screen
- **Automatic connections**: Links between steps
- **Conditions**: Branching based on results

### 2. Step Configuration

*[📸 Insert step configuration screenshot here]*
**Suggested photo location**: `media/screenshots/workflow-steps.png`

#### Properties of Each Step
- **Step name**: Custom label
- **Parameters**: Module-specific configuration
- **Execution conditions**: Trigger criteria
- **Error handling**: Action on failure
- **Delay**: Timing before/after step

#### Connection Types
- **Sequential**: Execution in order
- **Conditional**: Based on previous result
- **Parallel**: Simultaneous execution
- **Loop**: Repetition with stop criteria

### 3. Predefined Workflows

*[📸 Insert predefined workflows screenshot here]*
**Suggested photo location**: `media/screenshots/predefined-workflows.png`

#### Workflow Library
- **Basic Complete Test**: Essential verifications
- **Network Stress Test**: Connectivity robustness
- **Telephony Validation**: Complete voice tests
- **Data Performance**: Throughput measurements
- **Complete SMS Cycle**: Send/receive/delete

#### Using Predefined Workflows
1. **Select** workflow from library
2. **Preview** steps and parameters
3. **Customize** if necessary
4. **Save** as new workflow

### 4. Scheduling and Execution

*[📸 Insert scheduling screenshot here]*
**Suggested photo location**: `media/screenshots/workflow-scheduling.png`

#### Immediate Execution
- **"Execute" button**: Direct launch
- **Device selection**: Target choice
- **Confirmation**: Parameter validation
- **Real-time monitoring**: Monitoring interface

#### Deferred Scheduling
- **Integrated scheduler**: Calendar interface
- **Date and time**: Precise selection
- **Recurrence**: Daily/Weekly/Monthly
- **Conditions**: Automatic triggers
- **Notifications**: Start/end alerts

---

## 📊 Monitoring and Reports

### 1. Execution Dashboard

*[📸 Insert execution dashboard screenshot here]*
**Suggested photo location**: `media/screenshots/execution-dashboard.png`

#### Overview
- **Running tests**: List with progress
- **Queue**: Scheduled tests
- **Recent history**: Last 10 executions
- **Statistics**: Success rate, average duration

#### Filtering and Search
- **Period**: Last hour/day/week/month
- **Test type**: By module or workflow
- **Device**: Filter by device
- **Status**: Success/Failure/Running/Scheduled

### 2. Detailed Reports

*[📸 Insert detailed report screenshot here]*
**Suggested photo location**: `media/screenshots/detailed-report.png`

#### Report Content
- **Header**: Date, time, user, MOBIQ version
- **Executive summary**: Global status, duration, devices
- **Test details**: Parameters, results, metrics
- **Complete logs**: Detailed execution trace
- **Screenshots**: Images taken during tests
- **Recommendations**: Improvement suggestions

#### Export Formats
- **PDF**: Formatted report for printing/sharing
- **Excel**: Tabular data for analysis
- **CSV**: Import to other tools
- **HTML**: Web viewing with interactive links

### 3. Analytics and Trends

*[📸 Insert analytics screenshot here]*
**Suggested photo location**: `media/screenshots/analytics-trends.png`

#### Performance Charts
- **Success rate evolution**: Temporal curve
- **Response time**: Distribution and averages
- **Module usage**: Usage frequency
- **Performance per device**: Comparisons

#### Alerts and Notifications
- **Configurable thresholds**: Minimum success rate
- **Desktop notifications**: Windows popups
- **Automatic emails**: Scheduled reports
- **Webhooks**: Integration with external tools

---

## ⚙️ Settings and Preferences

### 1. Advanced Configuration

*[📸 Insert advanced settings screenshot here]*
**Suggested photo location**: `media/screenshots/advanced-settings.png`

#### Performance Tab
- **Simultaneous threads**: Number of parallel tests
- **Global timeout**: Maximum delay per test
- **Cache memory**: Results cache size
- **Optimizations**: High performance mode

#### Security Tab
- **Data encryption**: Enable/disable
- **Sensitive logs**: Masking private information
- **Network access**: Connectivity restrictions
- **Secure backup**: Export encryption

### 2. Interface Customization

*[📸 Insert customization screenshot here]*
**Suggested photo location**: `media/screenshots/ui-customization.png`

#### Themes and Appearance
- **Dark/light theme**: Automatic switching
- **Accent colors**: Color customization
- **Font size**: Accessibility adjustment
- **Layout**: Panel reorganization

#### Keyboard Shortcuts
- **Default shortcuts**: Complete list
- **Customization**: Combination modification
- **Profiles**: Configuration saving
- **Import/Export**: Sharing between installations

### 3. External Integrations

*[📸 Insert integrations screenshot here]*
**Suggested photo location**: `media/screenshots/external-integrations.png`

#### APIs and Webhooks
- **Webhook URL**: Endpoint configuration
- **Authentication**: API tokens and keys
- **Data format**: Custom JSON/XML
- **Automatic retry**: Network failure handling

#### Third-party Tools
- **JIRA**: Automatic ticket creation
- **Slack**: Channel notifications
- **Teams**: Microsoft integration
- **Email**: Custom SMTP configuration

---

## 🔍 Troubleshooting

### 1. ADB Connection Issues

*[📸 Insert ADB troubleshooting screenshot here]*
**Suggested photo location**: `media/screenshots/adb-troubleshooting.png`

#### Automatic Diagnosis
1. **Menu**: `Tools` → `ADB Diagnosis`
2. **Automatic tests**:
   - ✅ ADB installed and accessible
   - ✅ USB drivers functional
   - ✅ Devices detected
   - ✅ Permissions granted

#### Common Solutions
- **Restart ADB**: "Restart ADB Service" button
- **Reinstall drivers**: Reinstallation wizard
- **Check USB cable**: Connectivity test
- **Allow debugging**: Step-by-step guide

### 2. Performance Issues

*[📸 Insert performance monitoring screenshot here]*
**Suggested photo location**: `media/screenshots/performance-monitoring.png`

#### System Monitoring
- **CPU usage**: Real-time chart
- **RAM memory**: Used and available
- **Storage**: Used/free space
- **Network**: Bandwidth used

#### Suggested Optimizations
- **Reduce simultaneous tests**: Less load
- **Increase memory**: JVM configuration
- **Clean logs**: Automatic deletion
- **Defragmentation**: Storage optimization

### 3. Logs and Diagnostics

*[📸 Insert diagnostic logs screenshot here]*
**Suggested photo location**: `media/screenshots/diagnostic-logs.png`

#### Log Access
- **Menu**: `Help` → `Diagnostic Logs`
- **Levels**: Debug/Info/Warning/Error/Critical
- **Filtering**: By component or period
- **Export**: Save for technical support

#### Diagnostic Tools
- **Connectivity test**: Ping to external services
- **Integrity check**: File verification
- **System report**: Complete configuration
- **Debug mode**: Detailed logs for developers

### 4. Support and Help

*[📸 Insert integrated help screenshot here]*
**Suggested photo location**: `media/screenshots/integrated-help.png`

#### Integrated Help
- **Documentation**: Accessible offline
- **Video tutorials**: Step-by-step guides
- **FAQ**: Frequently asked questions
- **Glossary**: Technical definitions

#### Support Contact
- **Support ticket**: Integrated form
- **Automatic logs**: Send with ticket
- **Live chat**: Real-time support
- **Knowledge base**: Detailed articles

---

## 📞 Support and Resources

### Available Resources

1. **Complete Documentation**: Accessible via `F1` in application
2. **Video Tutorials**: Integrated in help
3. **Community Forum**: https://community.mobiq-framework.com
4. **Technical Support**: support@mobiq-framework.com

### System Information

- **MOBIQ Version**: Visible in `Help` → `About`
- **ADB Version**: Displayed in settings
- **System logs**: Exportable for diagnosis
- **Configuration**: Backup/restore possible

---

## 📄 Release Notes

**MOBIQ Desktop v2.2.0**
- Modernized Electron interface
- 29 integrated test modules
- Visual drag-and-drop workflows
- Automatic PDF/Excel reports
- Enhanced multi-device support

**Compatibility:**
- Windows 10/11 (64-bit)
- Android 7.0+ (API 24+)
- ADB version 1.0.39+

---

*This guide covers the usage of MOBIQ Desktop executable. For development or source installation, consult the separate developer guide.*