import React, { useState } from 'react';
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
  Menu,
  X,
  Layers
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navigationItems = [
    { path: '/', icon: Home, label: 'Home', color: 'text-blue-400' },
    { path: '/metabolic-traits', icon: Beaker, label: 'Metabolomic Traits', color: 'text-purple-400' },
    { path: '/model-assessment', icon: Settings, label: 'Model Assessment', color: 'text-pink-400' },
    { path: '/correlations', icon: Table, label: 'LS-MS Correlations', color: 'text-pink-400' },
    { path: '/risk-associations', icon: BarChart3, label: 'Risk Estimate', color: 'text-red-400' },
    { path: '/csl-loci', icon: Layers, label: 'CSL Identified Loci', color: 'text-lime-400' },
    { path: '/gc-gims', icon: Network, label: 'GIMs - Gastric Cancer', color: 'text-green-400' },
    { path: '/lesion-progression', icon: TrendingUp, label: 'GIMs - Gastric Lesion Progression', color: 'text-indigo-400' },
    { path: '/variants', icon: GitBranch, label: 'Matched Variants', color: 'text-yellow-400' },
    { path: '/incremental-r2', icon: PieChart, label: 'Explained Variance', color: 'text-cyan-400' },
    { path: '/regulatory-effects', icon: Activity, label: 'Regulatory Effects', color: 'text-orange-400' }
  ];

  const NavigationMenu = ({ isMobile = false }: { isMobile?: boolean }) => (
    <nav className={`${isMobile ? 'block' : 'hidden lg:block'} ${isMobile ? 'py-4' : 'flex-1 py-6'}`}>
      <ul className={`space-y-2 ${isMobile ? 'px-2' : 'px-4'}`}>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={() => isMobile && setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : item.color}`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col lg:flex-row lg:h-screen">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar - Desktop */}
      <div className={`hidden ${isSidebarOpen ? 'lg:flex' : 'lg:hidden'} lg:w-64 xl:w-72 bg-[#000435] text-white flex-col fixed h-full z-30 transition-all duration-300`}>
        {/* Logo/Brand */}
        <div className="p-4 lg:p-6 border-b border-gray-600">
          <div className="flex items-center space-x-3">
            <div className="w-18 h-8 bg-red-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">GIMGC</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg lg:text-xl font-bold whitespace-normal break-words">GIMGC</h1>
              <p className="text-[11px] lg:text-xs text-gray-300 leading-snug">
                Genetically influenced metabotypes for gastric cancer
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <NavigationMenu />

        {/* Footer */}
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
              <h1 className="text-lg font-bold">GIMs & GC RISK</h1>
              <p className="text-sm text-gray-300">Research Findings</p>
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
      <div className={`flex-1 flex flex-col w-full min-h-0 transition-all duration-300 lg:overflow-hidden ${isSidebarOpen ? 'lg:ml-64 xl:ml-72' : 'lg:ml-0'}`}>
        {/* Header */}
        <header className="bg-[#000435] shadow-sm border-b border-gray-700 px-4 sm:px-6 py-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-700"
              >
                <Menu className="w-6 h-6 text-white" />
              </button>

              {/* Desktop Sidebar Toggle Button */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="hidden lg:block p-2 rounded-lg hover:bg-gray-700"
                title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                <Menu className="w-6 h-6 text-white" />
              </button>

              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
                  Genetically Influenced Metabotypes for Gastric Cancer and Gastric Lesion Progression
                </h2>
                <p className="text-xs sm:text-sm text-gray-300 hidden sm:block">
                  Interactive exploration of research findings on genetically influenced metabotypes for gastric cancer risk
                </p>
              </div>
            </div>
            
            <div className="w-full sm:w-auto sm:ml-auto sm:text-right mt-1 sm:mt-0 text-xs sm:text-sm text-gray-400">
              For academic research use only
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
