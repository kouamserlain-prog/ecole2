'use client';

import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import { inactiveModuleIconClass } from '../../lib/navModuleIconClass';

export type AdminNavTab = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
};

interface AdminSidebarProps {
  mainTabs: AdminNavTab[];
  bottomTabs: AdminNavTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  /** lg+ : menu réduit aux icônes */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const AdminSidebar = ({
  mainTabs,
  bottomTabs,
  activeTab,
  onTabChange,
  isOpen,
  onToggle,
  collapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) => {
  const closeOnNavigate = (id: string) => {
    onTabChange(id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onToggle();
    }
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden cursor-default border-0 p-0"
          onClick={onToggle}
          aria-label="Fermer le menu"
        />
      )}

      <aside
        className={`fixed top-16 left-0 z-50 h-[calc(100vh-4rem)] border-r border-white/10 bg-black shadow-2xl
          transition-[transform,width] duration-300 ease-in-out
          w-[min(16rem,calc(100vw-2rem))]
          ${collapsed ? 'lg:w-[4.25rem]' : 'lg:w-64'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        aria-label="Navigation administration"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div
            className={`hidden shrink-0 items-center border-b border-white/10 px-1.5 py-2 lg:flex ${
              collapsed ? 'justify-center' : 'justify-between gap-1'
            }`}
          >
            {!collapsed ? (
              <p className="min-w-0 truncate pl-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-white/45">
                Menu
              </p>
            ) : null}
            {onToggleCollapse ? (
              <button
                type="button"
                onClick={onToggleCollapse}
                className={`flex shrink-0 items-center justify-center rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 min-h-[34px] min-w-[34px] ${
                  collapsed ? '' : 'ml-auto'
                }`}
                aria-expanded={collapsed ? false : true}
                aria-label={collapsed ? 'Développer le menu latéral' : 'Réduire le menu latéral'}
              >
                {collapsed ? (
                  <FiChevronRight className="h-4 w-4" aria-hidden />
                ) : (
                  <FiChevronLeft className="h-4 w-4" aria-hidden />
                )}
              </button>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-b border-white/10 px-2.5 py-2 shrink-0 lg:hidden">
            <div>
              <p className="text-[8px] font-semibold text-white/45 uppercase tracking-[0.2em]">Navigation</p>
              <h2 className="text-sm font-display font-semibold tracking-wide text-white">Administration</h2>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="p-1.5 rounded-lg text-white/80 hover:bg-white/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Fermer le menu"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-2 py-2">
            <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-0.5 text-[10px] leading-tight">
              {mainTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    title={tab.label}
                    aria-label={tab.label}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => closeOnNavigate(tab.id)}
                    className={`flex w-full min-h-[36px] items-center gap-2 rounded-lg px-2 py-1.5 font-medium transition-all lg:min-h-0 lg:py-1.5 ${
                      collapsed ? 'lg:justify-center lg:px-1.5 lg:gap-0' : ''
                    } ${
                      isActive
                        ? `bg-gradient-to-r ${tab.color} text-white shadow-[0_0_28px_-8px_rgba(251,191,36,0.45)] ring-1 ring-amber-400/30`
                        : 'text-zinc-400 hover:bg-white/[0.08] hover:text-white active:bg-white/[0.12]'
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isActive ? 'text-white' : inactiveModuleIconClass(tab.color)
                      }`}
                    />
                    <span
                      className={`min-w-0 truncate text-left ${collapsed ? 'lg:hidden' : ''}`}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-auto shrink-0 border-t border-white/10 pt-2">
              <nav className="space-y-0.5 text-[10px] leading-tight">
                {bottomTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      title={tab.label}
                      aria-label={tab.label}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => closeOnNavigate(tab.id)}
                      className={`flex w-full min-h-[36px] items-center gap-2 rounded-lg px-2 py-1.5 font-medium transition-all lg:min-h-0 lg:py-1.5 ${
                        collapsed ? 'lg:justify-center lg:px-1.5 lg:gap-0' : ''
                      } ${
                        isActive
                          ? `bg-gradient-to-r ${tab.color} text-white shadow-[0_0_24px_-8px_rgba(251,191,36,0.4)] ring-1 ring-amber-400/25`
                          : 'text-zinc-400 hover:bg-white/[0.08] hover:text-white active:bg-white/[0.12]'
                      }`}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isActive ? 'text-white' : inactiveModuleIconClass(tab.color)
                        }`}
                      />
                      <span
                        className={`min-w-0 truncate text-left ${collapsed ? 'lg:hidden' : ''}`}
                      >
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
