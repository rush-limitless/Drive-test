import React from 'react';
import { Smartphone, Wifi, Battery, Settings } from 'lucide-react';
import { Device } from '@types';
import { fetchWithRetry } from '../../services/utils';

interface DeviceSelectionCardProps {
  device: Device;
  onSelect: (deviceId: string) => void;
  isSelected: boolean;
}

const DeviceSelectionCard: React.FC<DeviceSelectionCardProps> = ({ device, onSelect, isSelected }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'online':
      case 'device':
        return 'status-active';
      case 'offline':
        return 'status-draft';
      default:
        return 'status-active';
    }
  };

  const handleTest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetchWithRetry(`http://127.0.0.1:8007/api/v1/devices/${device.id}/test`, {
        method: 'POST'
      });
      const result = await response.json();
      alert(result.message);
    } catch (error) {
      alert('Error testing device: ' + error);
    }
  };

  const handleReboot = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Reboot device ${device.id}?`)) {
      try {
        const response = await fetchWithRetry(`http://127.0.0.1:8007/api/v1/devices/${device.id}/reboot`, {
          method: 'POST'
        });
        const result = await response.json();
        alert(result.message);
      } catch (error) {
        alert('Error rebooting device: ' + error);
      }
    }
  };

  return (
    <div 
      className={`device-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(device.id)}
    >
      <div className="device-header">
        <div className="device-icon">
          <Smartphone size={28} />
        </div>
        <div className="device-info">
          <h4 className="device-model">{device.model || 'Unknown Model'}</h4>
          <span className={`status-pill ${getStatusColor(device.status)}`}>
            {device.status}
          </span>
        </div>
      </div>

      <div className="device-serial">
        <div className="serial-label">SERIAL NUMBER</div>
        <div className="serial-value">{device.id}</div>
      </div>

      <div className="device-specs">
        <div className="spec-item">
          <div className="spec-label">Android</div>
          <div className="spec-value">{device.android_version || 'Unknown'}</div>
        </div>
        <div className="spec-item">
          <div className="spec-label">Connection</div>
          <div className="spec-value">{device.connection_type || 'USB'}</div>
        </div>
      </div>

      <div className="device-actions">
        <button 
          className="btn btn-secondary"
          onClick={handleTest}
        >
          Test
        </button>
        <button 
          className="btn btn-ghost"
          onClick={handleReboot}
        >
          Reboot
        </button>
      </div>
    </div>
  );
};

export default DeviceSelectionCard;
