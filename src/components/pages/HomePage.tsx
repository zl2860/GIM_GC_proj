import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Database, Beaker, Activity, ExternalLink, Users, Target, Microscope, Mail } from 'lucide-react';
import { Shuffle } from 'lucide-react';
import cover4 from '@/assets/cover4.png';
import GlobalSearch from '@/components/GlobalSearch';

const HomePage: React.FC = () => {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Hero Section with cover image */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg mb-8">
        {/* Background image */}
        <img
          src={cover4}
          alt="Cover background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/20" />

        {/* 3) Hero content */}
        <div className="relative z-10 flex flex-col items-center gap-5 p-6 sm:p-8 md:p-12 lg:p-14 text-center">
          <div className="max-w-5xl w-full rounded-2xl border border-white/30 bg-black/5 backdrop-blur-[1px] p-6 sm:p-8 text-white/95 space-y-4 text-left">
            <div className="flex items-start gap-3">
              <Microscope className="h-10 w-10 text-white/80" />
              <h1 className="text-xl sm:text-2xl font-semibold leading-snug text-balance">
                Genetically determined metabolomic individuality reveals impacts of germline variations on gastric cancer susceptibility and informs precision prevention
              </h1>
            </div>
            <div className="space-y-2 text-sm sm:text-[0.95rem] leading-relaxed text-pretty">
              <p>
                Zong-Chao Liu<sup>1,†</sup>, Yue He<sup>2,†</sup>, Ting Guo<sup>3,†</sup>, Heng-Min Xu<sup>1</sup>, Xuan Han<sup>1</sup>, Zhi-Qiang Hu<sup>1</sup>, Zhou-Yi Yin<sup>1</sup>, Yu Jin<sup>1</sup>, Lan-Xin Yang<sup>1</sup>, Yu-Xin Wang<sup>1</sup>, Chao Zhang<sup>1</sup>, Meng-Yuan Wang<sup>1</sup>, Yang Zhang<sup>4</sup>, Jing-Ying Zhang<sup>4</sup>, Tong Zhou<sup>4</sup>, Wei-Cheng You<sup>4</sup>, Kai-Feng Pan<sup>1,*</sup>, Peng Cui<sup>2,*</sup>, Jia-Fu Ji<sup>5,*</sup>, Wen-Qing Li<sup>1,*</sup>
              </p>
              <p className="text-xs text-white/75">
                † Equal contribution · * Corresponding authors &nbsp;|&nbsp; pan-kf@263.net · cuip@tsinghua.edu.cn  · jijiafu@hsc.pku.edu.cn · wenqing_li@bjmu.edu.cn
              </p>
              <div className="grid gap-1 text-xs text-white/70 sm:grid-cols-2 md:grid-cols-3">
                <span>1&nbsp;State Key Laboratory of Holistic Integrative Management of Gastrointestinal Cancers, Department of Cancer Epidemiology, Peking University Cancer Hospital &amp; Institute, Beijing 100142, China</span>
                <span>2&nbsp;Department of Computer Science and Technology, Tsinghua University, Beijing 100084, China</span>
                <span>3&nbsp;Key Laboratory of Carcinogenesis and Translational Research (Ministry of Education/Beijing), Division of Gastrointestinal Cancer Translational Research Laboratory, Peking University Cancer Hospital &amp; Institute, Beijing 100142, China</span>
                <span>4&nbsp;Key Laboratory of Carcinogenesis and Translational Research (Ministry of Education/Beijing), Department of Cancer Epidemiology, Peking University Cancer Hospital &amp; Institute, Beijing 100142, China</span>
                <span>5&nbsp;State Key Laboratory of Holistic Integrative Management of Gastrointestinal Cancers, Peking University Cancer Hospital &amp; Institute, Beijing 100142, China</span>
              </div>
            </div>
          </div>

          <p className="max-w-4xl text-white/80 text-pretty text-sm sm:text-base leading-relaxed mt-8">
            The online platform allows to interactively explore resources accompanying the manuscript, including multi-cohort analyses of genetically influenced metabotypes and regulatory landscapes.
          </p>

          {/* Global Search Bar */}
          <div className="w-full max-w-3xl mt-6 mb-6">
            <GlobalSearch />
          </div>

          <div className="flex flex-row flex-wrap justify-center gap-3 mt-4">
            <Link
              to="/risk-associations"
              className="bg-red-600/50 hover:bg-red-700/70 text-white px-6 py-3 rounded-lg transition flex items-center gap-2"
            >
              <BarChart3 className="h-5 w-5" />
              <span>Risk Estimates</span>
            </Link>
            <Link
              to="/gene-metabolite"
              className="bg-green-600/50 hover:bg-green-700/70 text-white px-6 py-3 rounded-lg transition flex items-center gap-2"
            >
              <Database className="h-5 w-5" />
              <span>Network for GIM traits</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Key Findings Summary */}
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Overview & Features</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Objectives</h3>
            <ul className="space-y-2 text-gray-600 text-pretty">
              <li className="flex items-start space-x-2">
                <Target className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                <span>Explore putative causal gene loci influencing metabolomic profiles related to gastric cancer</span>
              </li>
              <li className="flex items-start space-x-2">
                <Target className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                <span>Examine multi-ancestry genetic regulatory effects across the causal gene loci and metabolomic traits</span>
              </li>
              <li className="flex items-start space-x-2">
                <Target className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                <span>Explore GIMs for gastric carcinogenesis</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Features</h3>
            <ul className="space-y-2 text-gray-600 text-pretty">
              <li className="flex items-start space-x-2">
                <Microscope className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
                <span>The study covers the analysis of 249 NMR traits on a total of 436,480 individuals </span>
              </li>
              <li className="flex items-start space-x-2">
                <Microscope className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
                <span>We introduced the Causal Stable Learning (CSL) approach to prioritize putative causal gene loci for metabolomic traits</span>
              </li>
              <li className="flex items-start space-x-2">
                <Microscope className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
                <span>We performed external validations across multiple cohorts, including UKBB, SIT, MITS, and UGCED cohorts</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Research Data Exploration Grid */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-5 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6 flex flex-col">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Risk Estimates</h3>
          </div>
          <p className="text-gray-600 text-sm sm:text-base text-pretty mb-4 flex-1">
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

        <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6 flex flex-col">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">GGM network</h3>
          </div>
          <p className="text-gray-600 text-sm sm:text-base text-pretty mb-4 flex-1">
            Check partial correlations estimated using Gaussian Graph Model among the the traits in the GIMs.
          </p>
          <Link
            to="/gene-metabolite"
            className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center space-x-1"
          >
            <span>Browse Interactions</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6 flex flex-col">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Beaker className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Metabolomic traits</h3>
          </div>
          <p className="text-gray-600 text-sm sm:text-base text-pretty mb-4 flex-1">
            See detailed information on the 249 NMR metabolomic traits including descriptions, units, and classifications.
          </p>
          <Link
            to="/metabolic-traits"
            className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center space-x-1"
          >
            <span>View Traits</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6 flex flex-col">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Regulatory Effects</h3>
          </div>
          <p className="text-gray-600 text-sm sm:text-base text-pretty mb-4 flex-1">
            Check multi-ancestry regulatory effects of the regulatory paris in the GIMs.
          </p>
          <Link
            to="/regulatory-effects"
            className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center space-x-1"
          >
            <span>View Effects</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6 flex flex-col">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shuffle className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Model Assessment</h3>
          </div>
          <p className="text-gray-600 text-sm sm:text-base text-pretty mb-4 flex-1">
            Comprehensive evaluation of model performance and validation across different assessment centers in UKBB and ancestris.
          </p>
          <Link
            to="/model-assessment"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
          >
            <span>Assess Models</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Additional Research Sections */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-7">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>Study Overview</span>
          </h3>
          <div className="space-y-3 text-gray-600 text-pretty">
            <p>
            We developed a causal stable learning (CSL) framework to predict genetically determined metabolomic 
            profiles and depict the GIMs, which enables the identification of causal gene loci for metabolomic 
            traits across heterogeneous populations. 
            </p>
            <p>
            Using this framework, genome-wide variants were integrated with NMR-based metabolomics data to derive
            genetically imputed profiles representing germline‐encoded metabolic individuality. 
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-7">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Database className="w-5 h-5 text-green-600" />
            <span>Data Access</span>
          </h3>
          <div className="space-y-3 text-gray-600 text-pretty">
            <p>
              Part of the key and detailed results from the supplementary data are available 
              through this platform.
            </p>
            <p>
              Navigate through the different sections to explore specific aspects of our findings 
              and access detailed information.
            </p>
          </div>
        </div>
      </div>

      {/* Research Team & Contact */}
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Research Team & Data Access</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">About the project</h3>
            <p className="text-gray-600 text-pretty mb-4">
              This research was conducted by an multi-disciplinary team of researchers specializing in 
              genetic epidemiology, artificial intelligence, and gastric cancer research.
            </p>
            <p className="text-sm text-gray-500">
              For collaboration inquiries and data access requests, please contact the research team 
              through the institutional affiliations listed in the publication.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact us</h3>
            <p className="text-gray-600 text-pretty mb-4">
              Summary statistics and analysis results are available in the manuscript or through this 
              interactive platform. However, individual-level data is subject to institutional approval 
              and ethical review.
            </p>
            <button 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              onClick={() => window.open('mailto:wenqing_li@bjmu.edu.cn', '_blank')}
            >
              <Mail className="w-4 h-4" />
              <span>Contact Us</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="bg-gray-50 rounded-2xl p-6 text-center">
        <p className="text-gray-600 text-pretty">
          This platform provides an interactive interface to explore part of the key supplementary data for the submitted research paper: 
          <br />
          <span className="font-medium text-gray-800">
            "Genetically determined metabolomic individuality reveals impacts of germline variations on gastric cancer susceptibility and informs precision prevention"
          </span>
        </p>
        <p className="text-gray-500 text-sm mt-2">
          The webpage is maintained by Department of Cancer Epidemiology, Peking University Cancer Hospital & Institute
        </p>
      </div>
    </div>
  );
};

export default HomePage;
