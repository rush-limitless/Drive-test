import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  Typography,
  Box,
} from '@mui/material';
import { CallTestValues } from '../types/callTest';

export type CallTestMode = 'run' | 'edit';

type FormField = 'countryCode' | 'phoneNumber' | 'duration' | 'callCount';

interface CallTestDialogProps {
  open: boolean;
  mode: CallTestMode;
  initialValues: CallTestValues;
  targetDeviceId?: string | null;
  stepIndex?: number;
  totalSteps?: number;
  onCancel: () => void;
  onSubmit: (values: CallTestValues) => Promise<void> | void;
  canGoBack?: boolean;
  onPrevious?: () => void;
}

interface FormState {
  countryCode: string;
  phoneNumber: string;
  duration: string;
  callCount: string;
}

const sanitizeCountryCode = (value: string): string => {
  const digits = value.replace(/[^0-9]/g, '');
  return digits ? `+${digits}` : '';
};

const sanitizePhoneNumber = (value: string): string => value.replace(/[^0-9]/g, '');

const CallTestDialog: React.FC<CallTestDialogProps> = ({
  open,
  mode,
  initialValues,
  targetDeviceId,
  stepIndex,
  totalSteps,
  onCancel,
  onSubmit,
  canGoBack = false,
  onPrevious,
}) => {
  const [formState, setFormState] = useState<FormState>(() => ({
    countryCode: initialValues.countryCode,
    phoneNumber: initialValues.phoneNumber,
    duration: String(initialValues.duration),
    callCount: String(initialValues.callCount),
  }));

  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFormState({
      countryCode: initialValues.countryCode,
      phoneNumber: initialValues.phoneNumber,
      duration: String(initialValues.duration),
      callCount: String(initialValues.callCount),
    });
    setErrors({});
    setSubmitting(false);
  }, [open, initialValues]);

  const isLastStep = !totalSteps || !stepIndex || stepIndex >= totalSteps;
  const deviceLabel = targetDeviceId ?? 'Default template';
  const stepLabel =
    stepIndex && totalSteps
      ? `(${stepIndex}/${totalSteps})`
      : undefined;

  const dialogTitle = useMemo(() => {
    return mode === 'run' ? 'Call Test Parameters' : 'Edit Call Test Parameters';
  }, [mode]);

  const primaryButtonLabel = useMemo(() => {
    if (mode === 'run') {
      return isLastStep ? 'Launch Test' : 'Next Device';
    }
    return isLastStep ? 'Save' : 'Next Device';
  }, [isLastStep, mode]);

  const handleChange = (field: FormField) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const validate = (): { values?: CallTestValues; hasErrors: boolean } => {
    const validationErrors: Partial<Record<FormField, string>> = {};

    const normalizedCountryCode = sanitizeCountryCode(formState.countryCode.trim());
    if (!normalizedCountryCode) {
      validationErrors.countryCode = 'Please enter a country code (e.g. +237)';
    } else if (!/^\+[0-9]{1,4}$/.test(normalizedCountryCode)) {
      validationErrors.countryCode = 'Country code must contain 1 to 4 digits';
    }

    const normalizedPhone = sanitizePhoneNumber(formState.phoneNumber);
    if (!normalizedPhone) {
      validationErrors.phoneNumber = 'Please enter a contact number';
    } else if (normalizedPhone.length < 4) {
      validationErrors.phoneNumber = 'Number must contain at least 4 digits';
    }

    const durationValue = parseInt(formState.duration, 10);
    if (Number.isNaN(durationValue)) {
      validationErrors.duration = 'Invalid duration';
    } else if (durationValue <= 0) {
      validationErrors.duration = 'Duration must be greater than 0';
    } else if (durationValue > 600) {
      validationErrors.duration = 'Duration cannot exceed 600 seconds';
    }

    const callCountValue = parseInt(formState.callCount, 10);
    if (Number.isNaN(callCountValue)) {
      validationErrors.callCount = 'Invalid call count';
    } else if (callCountValue < 1 || callCountValue > 10) {
      validationErrors.callCount = 'Call count must be between 1 and 10';
    }

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return { hasErrors: true };
    }

    return {
      hasErrors: false,
      values: {
        countryCode: normalizedCountryCode,
        phoneNumber: normalizedPhone,
        duration: durationValue,
        callCount: callCountValue,
      },
    };
  };

  const handleSubmit = async () => {
    const { hasErrors, values } = validate();
    if (hasErrors || !values) {
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: '#475569', mb: 1.5 }}>
          Provide the details required for the call scenario. Parameters are stored locally and reused for upcoming runs.
        </Typography>
        {mode === 'run' ? (
          targetDeviceId ? (
            <Typography variant="body2" sx={{ color: '#2563EB', mb: 3 }}>
              Device {stepLabel ? `${stepLabel} – ` : ''}<strong>{targetDeviceId}</strong>
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ color: '#DC2626', mb: 3 }}>
              No active device selected. Choose one from the dashboard before launching.
            </Typography>
          )
        ) : (
          <Typography variant="body2" sx={{ color: '#2563EB', mb: 3 }}>
            Editing parameters for <strong>{deviceLabel}</strong> {stepLabel ? stepLabel : ''}
          </Typography>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Country code"
              value={formState.countryCode}
              onChange={handleChange('countryCode')}
              placeholder="+237"
              error={Boolean(errors.countryCode)}
              helperText={errors.countryCode ?? 'International prefix'}
              fullWidth
              disabled={submitting}
              inputProps={{ maxLength: 5 }}
            />
          </Grid>
          <Grid item xs={12} sm={8}>
            <TextField
              label="Contact number"
              value={formState.phoneNumber}
              onChange={handleChange('phoneNumber')}
              placeholder="691234567"
              error={Boolean(errors.phoneNumber)}
              helperText={errors.phoneNumber ?? 'Digits only (spaces allowed while typing)'}
              fullWidth
              disabled={submitting}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Call duration (seconds)"
              value={formState.duration}
              onChange={handleChange('duration')}
              type="number"
              error={Boolean(errors.duration)}
              helperText={errors.duration ?? 'Between 1 and 600 seconds'}
              fullWidth
              disabled={submitting}
              inputProps={{ min: 1, max: 600 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Number of calls"
              value={formState.callCount}
              onChange={handleChange('callCount')}
              type="number"
              error={Boolean(errors.callCount)}
              helperText={errors.callCount ?? 'Between 1 and 10 consecutive calls'}
              fullWidth
              disabled={submitting}
              inputProps={{ min: 1, max: 10 }}
            />
          </Grid>
        </Grid>
        <Box mt={3} sx={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '12px 16px' }}>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Tip: adjust parameters in "Edit" mode ahead of time and use "Run" to launch immediately on the active device.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ padding: '16px 24px' }}>
        {canGoBack && (
          <Button onClick={onPrevious} disabled={submitting} sx={{ textTransform: 'none' }}>
            Previous device
          </Button>
        )}
        <Button onClick={onCancel} disabled={submitting} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || (mode === 'run' && !targetDeviceId)}
          sx={{ textTransform: 'none' }}
        >
          {primaryButtonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CallTestDialog;
