type TelemetryEventName =
  | 'dashboard_viewed'
  | 'search_used'
  | 'scan_again_clicked'
  | 'add_devices_clicked'
  | 'dashboard_activity_cleared';

type TelemetryPayload = Record<string, unknown> | undefined;

const sendViaNavigator = (event: TelemetryEventName, payload: TelemetryPayload) => {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }
  try {
    const blob = new Blob(
      [JSON.stringify({ event, payload, ts: new Date().toISOString() })],
      { type: 'application/json' }
    );
    navigator.sendBeacon('/api/v1/telemetry', blob);
    return true;
  } catch {
    return false;
  }
};

class TelemetryClient {
  track(event: TelemetryEventName, payload?: TelemetryPayload): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (window.electronAPI?.trackEvent) {
        window.electronAPI.trackEvent(event, payload ?? {});
        return;
      }
      if (sendViaNavigator(event, payload)) {
        return;
      }
    } catch (error) {
      console.debug('[telemetry] failed to send event', event, error);
      return;
    }
    console.debug('[telemetry]', event, payload ?? {});
  }
}

export const telemetry = new TelemetryClient();
