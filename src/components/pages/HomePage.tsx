import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Database, Beaker, Activity, Download, ExternalLink, Users, Target, Microscope } from 'lucide-react';
import { Shuffle } from 'lucide-react';

const HomePage: React.FC = () => {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Genetically Influenced Metabotypes for Gastric Cancer Risk
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              Welcome to the supplementary panel showcasing our study’s summary statistics on genetically influenced metabotypes (GIMs) for gastric cancer. 
              Here you’ll find all additional data and details as mentioned by our manuscript.
            </p>
            <div className="flex space-x-4">
              <Link
                to="/risk-associations"
                className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
              >
                <BarChart3 className="w-5 h-5" />
                <span>Risk Estimates</span>
              </Link>
              <Link
                to="/gene-metabolite"
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Database className="w-5 h-5" />
                <span>Network for GIM traits</span>
              </Link>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg">
            <div className="text-center">
              <Microscope className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Research Paper
              </h3>
              <p className="text-gray-600 text-sm">
                "Genetically influenced metabotypes reveal inherited gastric cancer susceptibility and inform targeted prevention strategies"
              </p>
              <p className="text-gray-500 text-xs mt-2">
                Zong-Chao Liu, Yue He, xxx, et al 2025
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Findings Summary */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Overview & Features</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Objectives</h3>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start space-x-2">
                <Target className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                <span>Explore putative causal gene loci influencing metabolic profiles related to gastric cancer</span>
              </li>
              <li className="flex items-start space-x-2">
                <Target className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                <span>Examine multi-ancestry genetic regulatory effects across the causal gene loci and metabolic traits</span>
              </li>
              <li className="flex items-start space-x-2">
                <Target className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                <span>Explore GIMs for gastric carcinogenesis</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Features</h3>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start space-x-2">
                <Microscope className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
                <span>Our study covers the analysis of 249 NMR blood biomarkers</span>
              </li>
              <li className="flex items-start space-x-2">
                <Microscope className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
                <span>We introduced the Causal Stable Learning (CSL) approach for causal gene loci prioritization</span>
              </li>
              <li className="flex items-start space-x-2">
                <Microscope className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
                <span>We performed external validations across multiple cohorts, inclduing the UKBB, SIT, MITS, and UGCED cohorts</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Research Data Exploration Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Risk Estimates</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Examine associations of genetically predicted traits with gastric cancer risk across multiple cohorts.
          </p>
          <Link
            to="/risk-associations"
            className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center space-x-1"
          >
            <span>Explore Heatmap</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">GGM network</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Check partial correlations estimated using Gaussian Graph Model among the GIM-traits identified by CSL models.
          </p>
          <Link
            to="/gene-metabolite"
            className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center space-x-1"
          >
            <span>Browse Interactions</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Beaker className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Metabolic traits</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            See detailed information on 249 NMR blood metabolci traits including descriptions, units, and classifications.
          </p>
          <Link
            to="/biomarkers"
            className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center space-x-1"
          >
            <span>View Traits</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Regulatory Effects</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Check multi-ancestry regulatory effects of gene loci identified by CSL on GIM traits.
          </p>
          <Link
            to="/regulatory-effects"
            className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center space-x-1"
          >
            <span>Explore Effects</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Shuffle className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">LC-MS Correlations</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Explore  correlations between predicted NMR traits and metabolites detected by LC-MS.
          </p>
          <Link
            to="/correlations"
            className="text-yellow-600 hover:text-yellow-700 text-sm font-medium flex items-center space-x-1">
            <span>View Pairs</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Study Statistics */}
<div className="bg-white rounded-lg shadow-lg p-8">
  <h2 className="text-2xl font-bold text-gray-900 mb-6">Cohort & Study Statistics</h2>

  {/* 1) Sample size cohorts (4 panels) */}
  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
    {[
      { label: 'UKBB Discovery', count: '145,938',   Icon: Users, color: 'text-blue-600' },
      { label: 'UKBB Independent Validation',count: '284,694',     Icon: Users, color: 'text-green-600' },
      { label: 'UGCED',          count: '370',       Icon: Users, color: 'text-teal-600' },
      { label: 'MITS',           count: '2,804',     Icon: Users, color: 'text-purple-600' },
      { label: 'SIT',            count: '2,755',     Icon: Users, color: 'text-green-600' },


    ].map(({ label, count, Icon, color }) => (
      <div
        key={label}
        className="bg-gray-50 rounded-lg p-6 flex flex-col items-center justify-center text-center"
      >
        <Icon className={`w-8 h-8 mb-2 ${color}`} />
        <div className={`text-3xl font-bold mb-1 ${color}`}>{count}</div>
        <div className="text-sm text-gray-600">{label}</div>
      </div>
    ))}
  </div>

  {/* 2) UKBB independent validation (full-width line) */}
  <div className="text-center mb-8">
    <span className="text-sm text-gray-600">
      About the metabolic profiles:{' '}
      <span className="font-semibold text-red-600">249 metabolic traits spanning 18 categories</span>
    </span>
  </div>

  {/* 3) Other metrics (3 panels) */}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
    <div className="bg-gray-50 rounded-lg p-6 flex flex-col items-center justify-center text-center">
      <div className="flex items-center mb-2">
        <Beaker className="w-8 h-8 text-green-600 mr-2" />
        <div className="text-3xl font-bold text-green-600">249</div>
      </div>
      <div className="text-sm text-gray-600">NMR Metabolic Traits</div>
      <div className="text-xs text-gray-500 mt-1">Analyzed and predicted by this study</div>
    </div>

    <div className="bg-gray-50 rounded-lg p-6 flex flex-col items-center justify-center text-center">
      <div className="flex items-center mb-2">
        <Database className="w-8 h-8 text-purple-600 mr-2" />
        <div className="text-3xl font-bold text-purple-600">117</div>
      </div>
      <div className="text-sm text-gray-600">Causal Gene Loci</div>
      <div className="text-xs text-gray-500 mt-1">Identified by CSL framework</div>
    </div>

    <div className="bg-gray-50 rounded-lg p-6 flex flex-col items-center justify-center text-center">
      <div className="flex items-center mb-2">
        <BarChart3 className="w-8 h-8 text-red-600 mr-2" />
        <div className="text-3xl font-bold text-red-600">134</div>
      </div>
      <div className="text-sm text-gray-600">Significant Traits with FDR Control</div>
      <div className="text-xs text-gray-500 mt-1">Associated with GC incidence in genetically predicted levels</div>
    </div>
  </div>
</div>

      {/* Research Team & Contact */}
      <div className="bg-white rounded-lg shadow-lg p-8 mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Research Team & Data Access</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">About the project</h3>
            <p className="text-gray-600 mb-4">
              This research was conducted by an multi-displinary team of researchers specializing in 
              genetic epidemiology, artificial intelligence, and gastric cancer research.
            </p>
            <p className="text-sm text-gray-500">
              For collaboration inquiries and data access requests, please contact the research team 
              through the institutional affiliations listed in the publication.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact us</h3>
            <p className="text-gray-600 mb-4">
              Summary statistics and analysis results are available through this interactive platform. 
              However, individual-level data is subject to institutional approval and ethical review.
            </p>
            <button 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              onClick={() => window.open('mailto:wenqing_li@bjmu.edu.cn', '_blank')}
            >
              <Download className="w-4 h-4" />
              <span>Request Data Access</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
