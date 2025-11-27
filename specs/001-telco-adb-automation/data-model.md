# Data Model: Telco ADB Automation Desktop Framework

**Date**: 2025-01-27
**Feature**: 001-telco-adb-automation

## Core Entities

### Device
Represents a connected Android device available for automation.

**Fields**:
- `id` (string, primary key): ADB device identifier
- `phone_number` (string, nullable): Phone number from SIM card
- `sim_info` (JSON): MCC, MNC, carrier information
- `model` (string): Device model name
- `os_version` (string): Android OS version
- `status` (enum): connected, disconnected, busy, error
- `last_seen` (datetime): Last successful communication timestamp
- `capabilities` (JSON): Supported features and limitations
- `created_at` (datetime): First detection timestamp
- `updated_at` (datetime): Last status update timestamp

**Relationships**:
- One-to-many with ExecutionDevice (device assignments)
- One-to-many with DeviceLog (activity history)

**State Transitions**:
- connected → busy (when execution starts)
- busy → connected (when execution completes)
- connected → disconnected (on ADB connection loss)
- disconnected → connected (on reconnection)

### Module
Encapsulates a reusable Telco automation action.

**Fields**:
- `id` (string, primary key): Unique module identifier
- `name` (string): Human-readable module name
- `description` (text): Detailed module purpose and behavior
- `version` (string): Semantic version (MAJOR.MINOR.PATCH)
- `entry_point` (string): Python script path or function reference
- `input_schema` (JSON): JSON Schema for required inputs
- `output_schema` (JSON): JSON Schema for expected outputs
- `steps` (JSON array): Human-readable step descriptions
- `timeout_seconds` (integer): Maximum execution time
- `requires_root` (boolean): Whether module needs root access
- `device_compatibility` (JSON): OS versions, capabilities required
- `category` (string): Module classification (call, sms, data, etc.)
- `is_active` (boolean): Whether module is available for use
- `created_at` (datetime): Module registration timestamp
- `updated_at` (datetime): Last modification timestamp

**Relationships**:
- Many-to-many with Flow through FlowModule (flow composition)
- One-to-many with ExecutionStep (execution instances)

### Flow
Defines an ordered sequence of modules for automation.

**Fields**:
- `id` (UUID, primary key): Unique flow identifier
- `name` (string): User-defined flow name
- `description` (text, nullable): Flow purpose and notes
- `created_by` (string, nullable): User identifier (for multi-user mode)
- `visibility` (enum): private, shared, public
- `is_template` (boolean): Whether flow can be used as template
- `estimated_duration_minutes` (integer, nullable): Expected runtime
- `created_at` (datetime): Flow creation timestamp
- `updated_at` (datetime): Last modification timestamp

**Relationships**:
- One-to-many with FlowModule (ordered module sequence)
- One-to-many with Execution (execution instances)

### FlowModule
Junction table defining module order within flows.

**Fields**:
- `id` (UUID, primary key): Unique junction identifier
- `flow_id` (UUID, foreign key): Reference to Flow
- `module_id` (string, foreign key): Reference to Module
- `sequence_order` (integer): Execution order within flow
- `input_parameters` (JSON): Module-specific input values
- `continue_on_failure` (boolean): Whether to proceed if this step fails
- `retry_count` (integer): Number of retry attempts on failure
- `created_at` (datetime): Association timestamp

**Relationships**:
- Many-to-one with Flow
- Many-to-one with Module

### Execution
Represents a runtime instance of flow execution.

**Fields**:
- `id` (UUID, primary key): Unique execution identifier
- `flow_id` (UUID, foreign key): Reference to executed Flow
- `status` (enum): pending, running, completed, failed, cancelled
- `start_time` (datetime, nullable): Execution start timestamp
- `end_time` (datetime, nullable): Execution completion timestamp
- `progress_percentage` (integer): Overall completion percentage (0-100)
- `current_step` (string, nullable): Currently executing module name
- `error_message` (text, nullable): Failure reason if status is failed
- `artifacts_path` (string, nullable): Directory containing execution artifacts
- `report_generated` (boolean): Whether post-execution report exists
- `created_at` (datetime): Execution request timestamp

**Relationships**:
- Many-to-one with Flow
- One-to-many with ExecutionDevice (device assignments)
- One-to-many with ExecutionStep (step results)
- One-to-one with Report (generated report)

### ExecutionDevice
Junction table for device assignments to executions.

**Fields**:
- `id` (UUID, primary key): Unique assignment identifier
- `execution_id` (UUID, foreign key): Reference to Execution
- `device_id` (string, foreign key): Reference to Device
- `status` (enum): assigned, running, completed, failed
- `start_time` (datetime, nullable): Device execution start
- `end_time` (datetime, nullable): Device execution completion
- `error_message` (text, nullable): Device-specific error if failed
- `artifacts_path` (string, nullable): Device-specific artifacts directory

**Relationships**:
- Many-to-one with Execution
- Many-to-one with Device
- One-to-many with ExecutionStep (steps for this device)

### ExecutionStep
Records the result of executing a single module on a device.

**Fields**:
- `id` (UUID, primary key): Unique step identifier
- `execution_device_id` (UUID, foreign key): Reference to ExecutionDevice
- `module_id` (string, foreign key): Reference to executed Module
- `step_index` (integer): Order within the flow execution
- `status` (enum): pending, running, completed, failed, skipped
- `start_time` (datetime, nullable): Step start timestamp
- `end_time` (datetime, nullable): Step completion timestamp
- `input_data` (JSON): Actual input parameters used
- `output_data` (JSON, nullable): Module output if successful
- `stdout` (text, nullable): Standard output from module execution
- `stderr` (text, nullable): Standard error from module execution
- `screenshot_path` (string, nullable): Path to captured screenshot
- `retry_attempt` (integer): Current retry attempt number
- `error_code` (string, nullable): Structured error identifier

**Relationships**:
- Many-to-one with ExecutionDevice
- Many-to-one with Module

### Report
Contains generated execution reports and metadata.

**Fields**:
- `id` (UUID, primary key): Unique report identifier
- `execution_id` (UUID, foreign key): Reference to Execution
- `format` (enum): pdf, csv, html, json
- `file_path` (string): Path to generated report file
- `file_size_bytes` (integer): Report file size
- `generation_time_seconds` (float): Time taken to generate report
- `includes_screenshots` (boolean): Whether screenshots are embedded
- `includes_logs` (boolean): Whether detailed logs are included
- `created_at` (datetime): Report generation timestamp

**Relationships**:
- Many-to-one with Execution

## Validation Rules

### Device Validation
- `id` must be valid ADB device identifier format
- `status` transitions must follow defined state machine
- `phone_number` must be valid E.164 format if present
- `last_seen` cannot be in the future

### Module Validation
- `version` must follow semantic versioning format
- `input_schema` and `output_schema` must be valid JSON Schema
- `timeout_seconds` must be between 1 and 3600 (1 hour max)
- `entry_point` must reference existing Python file or function

### Flow Validation
- Flow must contain at least one module
- Module sequence_order must be consecutive integers starting from 1
- No duplicate modules within same flow (same module_id)
- Estimated duration must be positive if specified

### Execution Validation
- Cannot start execution on disconnected devices
- Cannot assign same device to multiple concurrent executions
- Progress percentage must be between 0 and 100
- End time must be after start time if both present

## Indexes and Performance

### Primary Indexes
- Device: `id` (primary key)
- Module: `id` (primary key)  
- Flow: `id` (primary key)
- Execution: `id` (primary key)

### Secondary Indexes
- Device: `status`, `last_seen` (for active device queries)
- Module: `category`, `is_active` (for module catalog filtering)
- Flow: `created_by`, `visibility` (for user flow lists)
- Execution: `status`, `start_time` (for execution monitoring)
- ExecutionStep: `execution_device_id`, `step_index` (for progress tracking)

### Composite Indexes
- FlowModule: `(flow_id, sequence_order)` (for ordered module retrieval)
- ExecutionDevice: `(execution_id, device_id)` (for device assignment queries)
- ExecutionStep: `(execution_device_id, start_time)` (for chronological step retrieval)