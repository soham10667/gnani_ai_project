import {
  LayoutDashboard,
  Mic,
  History,
  Layers,
  BarChart3,
  FileText,
  Settings,
} from 'lucide-react';

/**
 * Single source of truth for EchoTrust dashboard sidebar navigation and routes.
 * Reordering items or changing groups here updates sidebar layout, grouping,
 * keyboard tab order, and URL route matching automatically.
 */
export const NAV_ITEMS = [
  {
    id: 'dashboard',
    group: 'OPERATIONS',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    id: 'live',
    group: 'OPERATIONS',
    label: 'Live Verification',
    icon: Mic,
    path: '/live',
    showLiveStatus: true,
  },
  {
    id: 'history',
    group: 'OPERATIONS',
    label: 'History',
    icon: History,
    path: '/history',
  },
  {
    id: 'entities',
    group: 'INSIGHTS',
    label: 'Entity Analysis',
    icon: Layers,
    path: '/entity-analysis',
  },
  {
    id: 'analytics',
    group: 'INSIGHTS',
    label: 'Analytics',
    icon: BarChart3,
    path: '/analytics',
  },
  {
    id: 'audit_logs',
    group: 'COMPLIANCE',
    label: 'Audit Logs',
    icon: FileText,
    path: '/audit-logs',
  },
  {
    id: 'settings',
    group: 'SYSTEM',
    label: 'Settings',
    icon: Settings,
    path: '/settings',
  },
];

export const DEFAULT_AUTHENTICATED_PATH = '/dashboard';

export const LEGACY_PATH_REDIRECTS = {
  '/': DEFAULT_AUTHENTICATED_PATH,
  '/home': DEFAULT_AUTHENTICATED_PATH,
  '/overview': DEFAULT_AUTHENTICATED_PATH,
  '/live-verification': '/live',
  '/entities': '/entity-analysis',
  '/audit_logs': '/audit-logs',
  '/audit': '/audit-logs',
  '/logs': '/audit-logs',
};

export function normalizePathname(rawPathname = '/') {
  if (!rawPathname || rawPathname === '/') return '/';
  const cleaned = rawPathname.replace(/\/+$/, '').toLowerCase();
  return cleaned || '/';
}

export function resolveDashboardRoute(rawPathname = '/') {
  const normalized = normalizePathname(rawPathname);
  if (LEGACY_PATH_REDIRECTS[normalized]) {
    const targetPath = LEGACY_PATH_REDIRECTS[normalized];
    const matched = NAV_ITEMS.find((item) => item.path === targetPath) || NAV_ITEMS[0];
    return {
      path: matched.path,
      redirected: true,
      item: matched,
    };
  }

  const direct = NAV_ITEMS.find((item) => item.path === normalized);
  if (direct) {
    return {
      path: direct.path,
      redirected: rawPathname !== direct.path,
      item: direct,
    };
  }

  const fallback = NAV_ITEMS[0];
  return {
    path: fallback.path,
    redirected: true,
    item: fallback,
  };
}

