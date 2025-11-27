import React from 'react';

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle: string;
  onClick?: () => void;
}

const KPICard: React.FC<KPICardProps> = ({ icon, label, value, subtitle, onClick }) => {
  return (
    <div className={`kpi-card ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="kpi-icon">
        {icon}
      </div>
      <div className="kpi-content">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-subtitle">{subtitle}</div>
      </div>
    </div>
  );
};

export default KPICard;