import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Chip, IconButton, Menu, MenuItem } from '@mui/material';
import { Grid3X3, Smartphone, Zap, Puzzle, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveBaseUrl, fetchWithRetry } from '../services/utils';
import { APP_VERSION } from '../version';

interface LayoutProps {
  children: React.ReactNode;
}

type AppMenuAction = 'about' | 'faq' | 'updates' | 'manual';
type BackendStatus = 'checking' | 'online' | 'offline';
const DEFAULT_VERSION_LABEL =
  (import.meta as any).env?.VITE_APP_VERSION ??
  (import.meta as any).env?.VITE_REACT_APP_APP_VERSION ??
  (typeof process !== 'undefined' ? process.env.REACT_APP_APP_VERSION : undefined) ??
  APP_VERSION;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [appMenuAnchor, setAppMenuAnchor] = useState<null | HTMLElement>(null);
  const [historyIndex, setHistoryIndex] = useState(() => {
    if (typeof window === 'undefined') {
      return 0;
    }
    return window.history.state?.idx ?? 0;
  });
  const [historyLength, setHistoryLength] = useState(() => (typeof window === 'undefined' ? 0 : window.history.length));
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [appVersion, setAppVersion] = useState<string>(DEFAULT_VERSION_LABEL);
  const baseApiUrl = resolveBaseUrl();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setHistoryIndex(window.history.state?.idx ?? 0);
    setHistoryLength(window.history.length);
  }, [location]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handlePopState = () => {
      setHistoryIndex(window.history.state?.idx ?? 0);
      setHistoryLength(window.history.length);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyLength - 1;

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => setAppMenuAnchor(event.currentTarget);
  const handleCloseMenu = () => setAppMenuAnchor(null);
  const handleMenuClick = (action: AppMenuAction) => {
    handleCloseMenu();
    if (action === 'about') {
      const versionLabel = appVersion ? `v${appVersion}` : 'development build';
      window.alert(
        `MOBIQ ${versionLabel}\n\nUnified console for mobile automation.\nâ€¢ Bundled FastAPI backend + React dashboard + Electron shell\nâ€¢ Live device telemetry and diagnostics\nâ€¢ One-click telco modules and workflow composer\nâ€¢ Offline Windows installer built with PyInstaller\n\nBuild: ${versionLabel} (Electron 28 â€¢ React 18 â€¢ Python 3.x)`
      );
      return;
    }

    const links: Record<Exclude<AppMenuAction, 'about'>, string> = {
      faq: 'https://github.com/Specpapers/ADB-automation-tool/wiki/FAQ',
      updates: 'https://github.com/Specpapers/ADB-automation-tool/releases',
      manual: 'https://github.com/Specpapers/ADB-automation-tool/wiki/User-Manual',
    };
    window.open(links[action], '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    let cancelled = false;
    let timer: number | undefined;

    const headers = (): HeadersInit | undefined => {
      const key = window.localStorage.getItem('API_KEY');
      const trimmed = key?.trim();
      return trimmed ? { 'X-API-Key': trimmed } : undefined;
    };

    const updateVersionFromPayload = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') {
        return;
      }
      const version = (payload as { version?: unknown }).version;
      if (typeof version === 'string' && version.trim().length > 0) {
        setAppVersion((prev) => prev || version.trim());
      }
    };

    const probeOnce = async () => {
      const candidates = [
        `${baseApiUrl}/api/health`,
        `${baseApiUrl}/api/v1/health`,
        `${baseApiUrl}/health`,
      ];

      for (const url of candidates) {
        try {
          const response = await fetchWithRetry(url, {
            method: 'GET',
            headers: headers(),
          });
          if (response.ok) {
            try {
              const payload = await response.json();
              updateVersionFromPayload(payload);
              const statusValue =
                (payload && typeof payload === 'object' && 'status' in payload && typeof (payload as any).status === 'string'
                  ? (payload as any).status.toLowerCase()
                  : undefined) ?? 'ok';
              if (statusValue === 'ok' || statusValue === 'degraded') {
                return 'online' as BackendStatus;
              }
            } catch {
              return 'online' as BackendStatus;
            }
          }
          if (response.status !== 404) {
            return 'offline' as BackendStatus;
          }
        } catch {
          // Ignore and try the next endpoint.
        }
      }
      return 'offline' as BackendStatus;
    };

    const probe = async () => {
      const status = await probeOnce();
      if (!cancelled) {
        setBackendStatus(status);
        timer = window.setTimeout(probe, 7000);
      }
    };

    probe();
    return () => {
      cancelled = true;
      if (typeof timer !== 'undefined') {
        window.clearTimeout(timer);
      }
    };
  }, [baseApiUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    let cancelled = false;
    const electronVersion = (window as typeof window & { electronAPI?: { getAppVersion?: () => Promise<string> } }).electronAPI;
    if (!electronVersion?.getAppVersion) {
      return () => {
        cancelled = true;
      };
    }
    electronVersion
      .getAppVersion()
      .then((version) => {
        if (!cancelled && version) {
          setAppVersion((prev) => prev || version);
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel = backendStatus === 'online' ? 'Backend online' : backendStatus === 'offline' ? 'Backend offline' : 'Checking backend...';
  const statusPalette =
    backendStatus === 'online'
      ? { bg: '#DCFCE7', color: '#166534' }
      : backendStatus === 'offline'
        ? { bg: '#FEE2E2', color: '#B91C1C' }
        : { bg: '#FEF9C3', color: '#92400E' };

  return (
    <Box sx={{ 
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#F7F9FC',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    }}>
      <Box sx={{
        width: 280,
        minWidth: 280,
        maxWidth: 280,
        flexShrink: 0,
        background: 'linear-gradient(180deg, #0D1B2A 0%, #152238 100%)',
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh'
      }}>
        <Box sx={{ mb: 4, pb: 2.5, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0EA5E9 0%, #22D3EE 100%)',
                boxShadow: '0 10px 18px rgba(14, 165, 233, 0.3)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '6px',
                  border: '2px solid rgba(255, 255, 255, 0.85)',
                  boxShadow: '0 0 10px rgba(255, 255, 255, 0.35)',
                }}
              />
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  fontSize: '18px',
                  lineHeight: '22px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#F8FAFC',
                }}
              >
                MOBIQ
              </Typography>
              <Box
                sx={{
                  width: 36,
                  height: 3,
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, #38BDF8 0%, #0EA5E9 100%)',
                  opacity: 0.9,
                  mt: 0.4,
                }}
              />
            </Box>
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            The Future of Telecom Automation
          </Typography>
          {appVersion && (
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '11px',
                lineHeight: '16px',
                mt: 0.5,
                display: 'none',
              }}
            >
              Version {appVersion}
            </Typography>
          )}
        </Box>

        <Box sx={{ flex: 1 }}>
          {[
            { label: 'Dashboard', icon: <Grid3X3 size={20} />, path: '/dashboard' },
            { label: 'Modules', icon: <Puzzle size={20} />, path: '/modules' },
            { label: 'Workflows', icon: <Zap size={20} />, path: '/workflows' },
            { label: 'Device Manager', icon: <Smartphone size={20} />, path: '/devices' }
          ].map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <Box
                key={index}
                onClick={() => navigate(item.path)}
                sx={{
                  height: 48,
                  borderRadius: '12px',
                  padding: '0 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 1,
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#1E3A8A' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#D1D5DB',
                  '&:hover': {
                    backgroundColor: isActive ? '#1E3A8A' : '#11253F',
                    color: isActive ? '#FFFFFF' : '#E5E7EB'
                  }
                }}
              >
                <Box sx={{ color: isActive ? '#FFFFFF' : '#93C5FD' }}>
                  {item.icon}
                </Box>
                <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            {appVersion ? (
              <Chip
                label={`Version ${appVersion}`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '11px'
                }}
              />
            ) : null}
            <IconButton size="small" onClick={handleOpenMenu} sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              <Info size={16} />
            </IconButton>
          </Box>
          <Menu anchorEl={appMenuAnchor} open={Boolean(appMenuAnchor)} onClose={handleCloseMenu}>
            <MenuItem onClick={() => handleMenuClick('about')}>About</MenuItem>
            <MenuItem onClick={() => handleMenuClick('faq')}>FAQ</MenuItem>
            <MenuItem onClick={() => handleMenuClick('updates')}>Check for updates</MenuItem>
            <MenuItem onClick={() => handleMenuClick('manual')}>User manual</MenuItem>
          </Menu>
        </Box>
      </Box>

      <Box sx={{ flex: 1, padding: '24px 28px', maxWidth: 1320, margin: '0 auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 2 }}>
          <Chip
            label={statusLabel}
            size="small"
            sx={{
              backgroundColor: statusPalette.bg,
              color: statusPalette.color,
              fontWeight: 600,
            }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => navigate(-1)}
              disabled={!canGoBack}
              sx={{ border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: canGoBack ? '#FFFFFF' : '#F1F5F9' }}
              aria-label="Go back"
            >
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => navigate(1)}
              disabled={!canGoForward}
              sx={{ border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: canGoForward ? '#FFFFFF' : '#F1F5F9' }}
              aria-label="Go forward"
            >
              <ChevronRight size={18} />
            </IconButton>
          </Box>
        </Box>
        {children}
      </Box>
    </Box>
  );
};

export default Layout;

