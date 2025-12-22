# Tasks â€” Spec 014 Dashboard Device Targeting

## Analysis & Setup

- [ ] Confirm backend modules already honour `device_id` (no additional changes needed).
- [ ] Define shared storage key for the active device (`localStorage`).

## Dashboard Implementation

- [ ] Add "Set Active" action + highlight to device cards.
- [ ] Persist selection and restore it on load; auto-select when only one device is connected.
- [ ] Clear selection when the chosen device disappears.

## Module Integration

- [ ] Update Call Test execution to read the active device, block runs when none is selected, and send `device_id` to the backend.
- [ ] Provide user feedback (snackbar/log) indicating which device will execute the module.

## QA

- [ ] Multi-device scenario: switch active device and run Call Test twice (ensure each handset receives respective call).
- [ ] No-selection scenario: verify Modules page blocks execution and guides the user.
- [ ] Refresh/ navigation persistence: confirm active device survives reload and module execution.

