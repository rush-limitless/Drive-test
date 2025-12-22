import React, { useState, useEffect } from 'react';
import { Search, Smartphone, Wifi, Battery, Activity } from 'lucide-react';
import DeviceSelectionCard from './DeviceSelectionCard';
import KPICard from './KPICard';
import { Device, KPIData } from '@types';
import { deviceApi } from '../../services/deviceApi';

const Dashboard: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<string>('all');

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchDevices = async () => {
    try {
      const deviceList = await deviceApi.getDevices();
      setDevices(deviceList);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const handleSearch = () => {
    if (!searchTerm) return;
    
    const matchingDevices = devices.filter(device => 
      device.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
      device.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    console.log(`Found ${matchingDevices.length} devices matching "${searchTerm}"`);
  };

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDevice(deviceId);
  };

  // Calculate real device stats
  const totalDevices = devices.length;
  const activeDevices = devices.filter(d => d.status === 'online' || d.status === 'connected' || d.status === 'ready').length;

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <div className="brand-mark">
            <span className="brand-pill">MOBIQ</span>
            <div>
              <h1 className="page-title">Command Center</h1>
              <p className="page-subtitle">Live mobile automation</p>
            </div>
          </div>
          <select 
            className="device-picker"
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
          >
            <option value="all">All Devices ({totalDevices})</option>
            {devices.map(device => (
              <option key={device.id} value={device.id}>
                {device.model || device.id}
              </option>
            ))}
          </select>
        </div>
        
        <div className="search-section">
          <div className="search-input-container">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              className="search-input"
              placeholder="Search modules, workflows, devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button className="btn btn-secondary" onClick={handleSearch}>
            Search
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          icon={<Smartphone />}
          label="Connected Devices"
          value={`${totalDevices}/${totalDevices}`}
          subtitle={`${activeDevices} active`}
        />
        <KPICard
          icon={<Activity />}
          label="Workflows"
          value={12}
          subtitle="8 active, 4 draft"
        />
        <KPICard
          icon={<Battery />}
          label="Last Run Status"
          value="OK"
          subtitle="Completed 2m ago"
        />
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="actions-grid">
          <button className="btn btn-primary">Create Workflow</button>
          <button className="btn btn-secondary">Import Module</button>
          <button className="btn btn-secondary">Open Device Preview</button>
        </div>
      </div>

      {/* Connected Devices */}
      <div className="devices-section">
        <h3>Connected Devices</h3>
        {devices.length === 0 ? (
          <div className="no-devices">
            <Smartphone size={48} />
            <h4>No devices connected</h4>
            <p>Connect an Android device via USB and enable USB debugging</p>
            <button className="btn btn-primary" onClick={fetchDevices}>
              Scan Again
            </button>
          </div>
        ) : (
          <div className="devices-grid">
            {devices.map(device => (
              <DeviceSelectionCard
                key={device.id}
                device={device}
                onSelect={handleDeviceSelect}
                isSelected={selectedDevice === device.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Executions */}
      <div className="recent-executions">
        <h3>Recent Executions</h3>
        <div className="executions-placeholder">
          <p>Loading recent executions...</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;



