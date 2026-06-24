import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Beaker,
  BarChart3,
  Network,
  TrendingUp,
  Activity,
  PieChart,
  Settings,
  Table,
  GitBranch,
  Map as MapIcon,
  Menu,
  X,
  Layers
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavigationItem {
  path: string;
  icon: LucideIcon;
  label: string;
  color: string;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopNavOpen, setIsDesktopNavOpen] = useState(false);
  const isHome = location.pathname === '/';
  const isSpatial = location.pathname === '/spatial-distribution';

  const navigationItems: NavigationItem[] = [
    {
      path: '/',
      icon: Home,
      label: 'Home',
      color: 'text-blue-400'
    },
    {
      path: '/metabolic-traits',
      icon: Beaker,
      label: 'Metabolomic traits',
      color: 'text-purple-400'
    },
    {
      path: '/model-assessment',
      icon: Settings,
      label: 'Model assessment',
      color: 'text-pink-400'
    },
    {
      path: '/correlations',
      icon: Table,
      label: 'LC-MS correlations',
      color: 'text-pink-400'
    },
    {
      path: '/risk-associations',
      icon: BarChart3,
      label: 'Risk estimates',
      color: 'text-red-400'
    },
    {
      path: '/csl-loci',
      icon: Layers,
      label: 'CSL identified loci',
      color: 'text-lime-400'
    },
    {
      path: '/gc-gims',
      icon: Network,
      label: 'GIMs for gastric cancer',
      color: 'text-green-400'
    },
    {
      path: '/spatial-distribution',
      icon: MapIcon,
      label: 'Spatial distribution',
      color: 'text-cyan-300'
    },
    {
      path: '/lesion-progression',
      icon: TrendingUp,
      label: 'GIMs for lesion progression',
      color: 'text-indigo-400'
    },
    {
      path: '/gene-metabolite',
      icon: Network,
      label: 'Regulatory network',
      color: 'text-teal-300'
    },
    {
      path: '/variants',
      icon: GitBranch,
      label: 'Matched variants',
      color: 'text-yellow-400'
    },
    {
      path: '/incremental-r2',
      icon: PieChart,
      label: 'Explained variance',
      color: 'text-cyan-400'
    },
    {
      path: '/regulatory-effects',
      icon: Activity,
      label: 'Regulatory effects',
      color: 'text-orange-400'
    }
  ];

  useEffect(() => {
    if (!isDesktopNavOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsDesktopNavOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktopNavOpen]);

  const NavigationMenu = ({ isMobile = false }: { isMobile?: boolean }) => (
    <nav className={isMobile ? 'block py-4' : 'py-2'}>
      <ul className={`space-y-1 ${isMobile ? 'px-2' : 'px-2'}`}>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={() => {
                  if (isMobile) setIsMobileMenuOpen(false);
                  else setIsDesktopNavOpen(false);
                }}
                className={`flex items-center gap-3 rounded-lg transition-colors duration-200 ${
                  isMobile ? 'px-4 py-3' : 'px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : item.color}`} />
                <span className="font-medium leading-snug">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="gimgc-dark bg-[#020617] min-h-screen flex flex-col lg:flex-row lg:h-screen">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Floating navigation backdrop - Desktop */}
      {isDesktopNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="hidden lg:block fixed inset-0 z-40 cursor-default bg-transparent"
          onClick={() => setIsDesktopNavOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#000435] text-white transform transition-transform duration-300 ease-in-out lg:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Mobile Header */}
      <div className="p-4 border-b border-gray-600 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">GC</span>
            </div>
            <div>
              <h1 className="text-lg font-bold">GIMs & GC risk</h1>
              <p className="text-sm text-gray-300">Research findings</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Navigation */}
        <NavigationMenu isMobile />

        {/* Mobile Footer */}
        <div className="p-4 border-t border-gray-600 space-y-1 text-center">
          <p className="text-xs text-gray-400 leading-tight">
            © 2026 Dept. of Cancer Epidemiology, Peking University Cancer Hospital & Institute
          </p>
          <Link
            to="/rights"
            className="text-xs text-blue-200 hover:text-white transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Academic use only · Rights preserved
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full min-h-0 transition-all duration-300 lg:overflow-hidden">
        {/* Header */}
        <header className="relative z-50 bg-[#000435] shadow-sm border-b border-gray-700 px-4 sm:px-5 py-3 lg:pb-10">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-700"
              >
                <Menu className="w-6 h-6 text-white" />
              </button>

              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white truncate">
                  Genetically influenced metabotypes for gastric cancer and gastric lesion progression
                </h2>
                <p className="text-[11px] sm:text-xs text-gray-300 hidden sm:block">
                  Interactive exploration of research findings on genetically influenced metabotypes for gastric cancer risk
                </p>
              </div>
            </div>

            <div
              className="hidden lg:block absolute left-5 bottom-2 z-50"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={isDesktopNavOpen ? 'Close navigation' : 'Open navigation'}
                  aria-expanded={isDesktopNavOpen}
                  onClick={() => setIsDesktopNavOpen((open) => !open)}
                  className="flex h-8 items-center gap-2 rounded-lg border border-cyan-300/40 bg-[#000435]/95 px-2.5 text-xs font-semibold text-white shadow-xl shadow-black/35 backdrop-blur transition hover:bg-cyan-950 hover:border-cyan-300"
                >
                  {isDesktopNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                  Navigator
                </button>
                <Link
                  to="/"
                  onClick={() => setIsDesktopNavOpen(false)}
                  className="flex h-8 items-center gap-2 rounded-lg border border-cyan-300/30 bg-[#000435]/95 px-2.5 text-xs font-semibold text-white shadow-xl shadow-black/35 backdrop-blur transition hover:bg-cyan-950 hover:border-cyan-300"
                >
                  <Home className="h-3.5 w-3.5 text-blue-300" />
                  Home
                </Link>
              </div>

              <div
                className={`absolute left-0 top-full mt-2 w-80 max-h-[calc(100vh-112px)] overflow-y-auto rounded-xl border border-cyan-300/20 bg-[#000435]/96 text-white shadow-2xl shadow-black/45 backdrop-blur-xl transition duration-150 ${
                  isDesktopNavOpen
                    ? 'pointer-events-auto opacity-100 translate-y-0'
                    : 'pointer-events-none opacity-0 -translate-y-1'
                }`}
              >
                <NavigationMenu />
              </div>
            </div>
            
            <div className="w-full sm:w-auto sm:ml-auto mt-2 sm:mt-0">
              <div className="inline-block max-w-xs sm:max-w-[320px] bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200/80 shadow-sm">
                <p className="font-medium mb-0.5 text-gray-100/90">Note</p>
                <p className="leading-relaxed">
                  The manuscript is currently under review. Summary statistics will be available for download upon publication.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main
          className={`flex-1 overflow-y-auto overflow-x-hidden ${
            isHome
              ? 'bg-[#000435] p-0'
              : isSpatial
                ? 'bg-[#000435] p-0 overflow-hidden'
                : 'bg-[#020617] p-4 sm:p-6'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
