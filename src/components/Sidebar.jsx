import React from 'react';
import { ChevronLeft, ChevronRight, LogOut, X } from 'lucide-react';
import { DEFAULT_AUTHENTICATED_PATH, NAV_ITEMS } from '../config/navigation';

function EchoTrustLogo({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="echoTrustSidebarGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="0.5" stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5L4 6.2V11.5C4 16.8 7.4 21.2 12 22.5C16.6 21.2 20 16.8 20 11.5V6.2L12 2.5Z"
        stroke="url(#echoTrustSidebarGrad)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="url(#echoTrustSidebarGrad)"
        fillOpacity="0.18"
      />
      <rect x="7" y="10.5" width="1.5" height="3" rx="0.75" fill="#34D399" />
      <rect x="9.5" y="8" width="1.5" height="8" rx="0.75" fill="#6EE7B7" />
      <rect x="12" y="6" width="1.5" height="12" rx="0.75" fill="#FFFFFF" />
      <rect x="14.5" y="8" width="1.5" height="8" rx="0.75" fill="#10B981" />
      <rect x="17" y="10.5" width="1.5" height="3" rx="0.75" fill="#059669" />
    </svg>
  );
}

export default function Sidebar({
  currentPath,
  onNavigate,
  isCallActive = false,
  user,
  onLogout,
  isCollapsed = false,
  onToggleCollapse,
  mobileMenuOpen = false,
  onCloseMobileMenu,
}) {
  const groupedNav = NAV_ITEMS.reduce((acc, item) => {
    const existingGroup = acc[acc.length - 1];
    if (existingGroup && existingGroup.group === item.group) {
      existingGroup.items.push(item);
    } else {
      acc.push({ group: item.group, items: [item] });
    }
    return acc;
  }, []);

  const iconOnlyOnDesktop = isCollapsed && !mobileMenuOpen;
  const widthClass = mobileMenuOpen ? 'w-64 shadow-2xl' : iconOnlyOnDesktop ? 'w-16 lg:w-20' : 'w-16 lg:w-64';
  const showTextClass = mobileMenuOpen ? 'flex' : iconOnlyOnDesktop ? 'hidden' : 'hidden lg:flex';
  const showLabelInlineClass = mobileMenuOpen ? 'inline' : iconOnlyOnDesktop ? 'hidden' : 'hidden lg:inline';
  const showGroupHeadingClass = mobileMenuOpen ? 'block' : iconOnlyOnDesktop ? 'hidden' : 'hidden lg:block';
  const showSeparatorClass = mobileMenuOpen ? 'hidden' : iconOnlyOnDesktop ? 'block' : 'block lg:hidden';
  const tooltipClass = mobileMenuOpen
    ? 'hidden'
    : iconOnlyOnDesktop
    ? 'hidden group-hover/nav:flex group-focus-visible/nav:flex'
    : 'hidden group-hover/nav:flex group-focus-visible/nav:flex lg:group-hover/nav:hidden lg:group-focus-visible/nav:hidden';

  const handleItemClick = (e, path) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onNavigate(path);
    if (mobileMenuOpen && onCloseMobileMenu) {
      onCloseMobileMenu();
    }
  };

  return (
    <aside
      aria-label="Sidebar"
      className={`fixed inset-y-0 left-0 z-50 ${widthClass} bg-white text-slate-800 flex flex-col justify-between border-r border-slate-200 shadow-sm transition-all duration-200 ease-in-out`}
    >
      {/* Top Brand + Scrollable Grouped Navigation */}
      <div
        className={`flex-1 flex flex-col min-h-0 ${
          mobileMenuOpen ? 'overflow-y-auto' : iconOnlyOnDesktop ? 'overflow-visible' : 'overflow-visible lg:overflow-y-auto'
        }`}
      >
        <div
          className={`border-b border-slate-100 flex items-center ${
            mobileMenuOpen ? 'justify-between p-5' : iconOnlyOnDesktop ? 'justify-center p-3' : 'justify-center lg:justify-between p-3 lg:p-5'
          }`}
        >
          <a
            href={DEFAULT_AUTHENTICATED_PATH}
            onClick={(e) => handleItemClick(e, DEFAULT_AUTHENTICATED_PATH)}
            title="EchoTrust Dashboard"
            className="flex items-center space-x-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-600 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-500/20 shrink-0">
              <EchoTrustLogo className="w-6 h-6 text-white" />
            </div>
            <div className={mobileMenuOpen ? 'block' : iconOnlyOnDesktop ? 'hidden' : 'hidden lg:block'}>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">EchoTrust</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  AI Voice
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">Every Voice. Verified with Trust.</p>
            </div>
          </a>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}

          {mobileMenuOpen && onCloseMobileMenu && (
            <button
              type="button"
              onClick={onCloseMobileMenu}
              aria-label="Close navigation menu"
              className="lg:hidden text-slate-400 hover:text-slate-600 p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav aria-label="Main navigation" className="flex-1 flex flex-col px-2 lg:px-3 py-4 gap-4">
          {groupedNav.map((groupSection, groupIdx) => {
            const isSystemGroup = groupSection.group === 'SYSTEM';
            return (
              <div
                key={groupSection.group}
                className={isSystemGroup ? 'mt-auto pt-2 flex flex-col justify-end' : ''}
              >
                <div className={`px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 ${showGroupHeadingClass}`}>
                  {groupSection.group}
                </div>
                {groupIdx > 0 && (
                  <div
                    role="separator"
                    aria-label={groupSection.group}
                    className={`my-1 mx-2 border-t border-slate-100 ${showSeparatorClass}`}
                  />
                )}

                <div className="space-y-1">
                  {groupSection.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPath === item.path;
                    const showActiveBadge = Boolean(item.showLiveStatus && isCallActive);

                    return (
                      <a
                        key={item.id}
                        href={item.path}
                        onClick={(e) => handleItemClick(e, item.path)}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={item.label}
                        title={item.label}
                        className={`group/nav relative w-full flex items-center ${
                          mobileMenuOpen ? 'justify-between px-3.5' : iconOnlyOnDesktop ? 'justify-center px-2' : 'justify-center lg:justify-between px-2 lg:px-3.5'
                        } py-2.5 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          isActive
                            ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white font-bold shadow-md shadow-emerald-600/25'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <span className="relative shrink-0">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} aria-hidden="true" />
                            {showActiveBadge && (
                              <span
                                className={`absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ${
                                  isActive ? 'ring-emerald-600' : 'ring-white'
                                } ${mobileMenuOpen ? 'hidden' : iconOnlyOnDesktop ? 'block' : 'block lg:hidden'}`}
                              />
                            )}
                          </span>
                          <span className={`truncate ${showLabelInlineClass}`}>{item.label}</span>
                        </div>

                        {showActiveBadge && (
                          <span
                            className={`${showTextClass} items-center space-x-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              isActive
                                ? 'bg-white/20 text-white border border-white/30'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-emerald-500'} animate-ping`}></span>
                            <span>Active</span>
                          </span>
                        )}

                        {/* Accessible tooltip for icon-only collapsed / mobile rail */}
                        <span
                          role="tooltip"
                          className={`${tooltipClass} pointer-events-none absolute left-full ml-3 z-50 items-center space-x-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg`}
                        >
                          <span>{item.label}</span>
                          {showActiveBadge && (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                              Active
                            </span>
                          )}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Pinned User Profile Card & Logout Footer (unchanged) */}
      <div className="p-2 lg:p-3 border-t border-slate-100 bg-slate-50/70 shrink-0">
        <div
          className={`p-2 lg:p-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center ${
            mobileMenuOpen ? 'justify-between gap-2' : iconOnlyOnDesktop ? 'justify-center' : 'justify-center lg:justify-between gap-2'
          }`}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div
              title={user?.name || 'Ananya Kapoor'}
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-green-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-emerald-500/20 shadow-xs shrink-0"
            >
              {user?.name ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'AK'}
            </div>
            <div className={`min-w-0 ${mobileMenuOpen ? 'block' : iconOnlyOnDesktop ? 'hidden' : 'hidden lg:block'}`}>
              <div className="text-xs font-bold text-slate-900 truncate leading-tight">
                {user?.name || 'Ananya Kapoor'}
              </div>
              <div className="text-[10px] text-slate-400 truncate font-medium">
                {user?.role || 'Senior Verification Officer'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            title="Sign Out"
            aria-label="Sign Out"
            className={`${mobileMenuOpen ? 'inline-flex' : iconOnlyOnDesktop ? 'hidden' : 'hidden lg:inline-flex'} p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0 border border-transparent hover:border-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500`}
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
