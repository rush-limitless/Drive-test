/**
 * Navigation component for the application.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
} from '@mui/material';
import {
  LayoutDashboard,
  FlaskConical,
  Layers,
  Smartphone,
  FileText,
} from 'lucide-react';

const drawerWidth = 260;

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/modules', label: 'Modules', icon: FlaskConical },
  { path: '/workflows', label: 'Custom Workflows', icon: Layers },
  { path: '/devices', label: 'Device Manager', icon: Smartphone },
  { path: '/reports', label: 'Reports', icon: FileText },
];

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #0B1220 0%, #111C35 100%)',
          color: '#E2E8F0',
          borderRight: 'none',
          padding: '24px 16px',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 3, pt: 2 }}>
        <Box sx={{ px: 2 }}>
          <Typography variant="caption" sx={{ color: '#94A3B8', letterSpacing: 1.6, textTransform: 'uppercase', fontSize: 11 }}>
            MOBIQ
          </Typography>
          <Typography variant="subtitle1" sx={{ color: '#FFFFFF', fontWeight: 600, mt: 0.25 }}>
            The Future of Telecom Automation
          </Typography>
        </Box>

        <List sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <ListItem key={item.path} disablePadding sx={{ borderRadius: '12px' }}>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  selected={isActive}
                  sx={{
                    borderRadius: '12px',
                    paddingY: 1.5,
                    paddingX: 2,
                    marginX: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all .18s ease',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(59,130,246,0.95) 0%, rgba(37,99,235,0.95) 100%)'
                      : 'transparent',
                    boxShadow: isActive ? '0 12px 28px rgba(37,99,235,0.38)' : 'none',
                    color: isActive ? '#FFFFFF' : '#CBD5F5',
                    '&:hover': {
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(37,99,235,1) 0%, rgba(29,78,216,1) 100%)'
                        : 'rgba(37,99,235,0.16)',
                      color: '#FFFFFF',
                      boxShadow: isActive ? '0 16px 32px rgba(29,78,216,0.45)' : '0 6px 16px rgba(37,99,235,0.24)',
                    },
                    '&::before': isActive
                      ? {
                          content: '""',
                          position: 'absolute',
                          inset: '-40%',
                          background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 60%)',
                        }
                      : undefined,
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 36,
                      color: isActive ? '#FFFFFF' : '#94A3C6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color .18s ease',
                    }}
                  >
                    <IconComponent size={20} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.95rem',
                      letterSpacing: isActive ? 0.15 : 0,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        <Box sx={{ px: 2, py: 1, borderTop: '1px solid rgba(148, 163, 199, 0.2)' }}>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Spec 008 · Increment 3
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}

export default Navigation;
