import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Beaker, BarChart3, Network, TrendingUp, Activity, PieChart, Settings, Table, GitBranch } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const navigationItems = [
    { path: '/', icon: Home, label: 'Home', color: 'text-blue-400' },
    { path: '/metabolic-traits', icon: Beaker, label: 'Metabolic Traits', color: 'text-purple-400' },
    { path: '/model-assessment', icon: Settings, label: 'Model Assessment', color: 'text-pink-400' },
    { path: '/correlations', icon: Table, label: 'LS-MS Correlations', color: 'text-pink-400' },
    { path: '/risk-associations', icon: BarChart3, label: 'Risk Estimate', color: 'text-red-400' },
    { path: '/gc-gims', icon: Network, label: 'GIMs - Gastric Cancer', color: 'text-green-400' },
    { path: '/lesion-progression', icon: TrendingUp, label: 'GIMs - Gastric Lesion Progression', color: 'text-indigo-400' },
    { path: '/variants', icon: GitBranch, label: 'Matched Variants', color: 'text-yellow-400' },
    { path: '/incremental-r2', icon: PieChart, label: 'Explained Variance', color: 'text-cyan-400' },
    { path: '/regulatory-effects', icon: Activity, label: 'Regulatory Effects', color: 'text-orange-400' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-64 bg-[#1A2844] text-white flex flex-col">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-gray-600">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">GC</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">GIMs & GC RISK</h1>
              <p className="text-sm text-gray-300">Research Findings</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6">
          <ul className="space-y-2 px-4">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
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

        {/* Footer */}
        <div className="p-4 border-t border-gray-600">
          <p className="text-xs text-gray-400 text-center">
            © 2025 Dept. of Cancer Epidemiology, Peking University Cancer Hospital & Institute
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Genetically Influenced Metabotypes and Gastric Cancer Risk
              </h2>
              <p className="text-sm text-gray-600">
                Interactive exploration of research findings on genetically influenced metabotypes for gastric cancer risk
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleDateString()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
