import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Database, Beaker, Activity, ExternalLink, Users, Target, Microscope, Mail, Map as MapIcon } from 'lucide-react';
import { Shuffle } from 'lucide-react';
import cover4 from '@/assets/cover4.png';
import GlobalSearch from '@/components/GlobalSearch';

const HomePage: React.FC = () => {
  return (
    <div className="w-full bg-[#000435] min-h-screen">
      {/* Hero Section with cover image - Full width */}
      <div
        className="relative overflow-hidden shadow-lg w-full flex items-center justify-center"
        style={{ minHeight: '520px', paddingTop: '24px', paddingBottom: '24px' }}
      >
        {/* Background image */}
        <img
          src={cover4}
          alt="Cover background"
          className="absolute inset-0 w-full h-full object-contain bg-[#000435]"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/20" />

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center gap-4 p-6 sm:p-8 md:p-10 lg:p-12 text-center w-full max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="max-w-5xl w-full rounded-2xl border border-white/30 bg-black/5 backdrop-blur-[1px] p-6 sm:p-7 text-white/95 space-y-4 text-left">
            <div className="flex items-start gap-3">
              <Microscope className="h-10 w-10 text-white/80" />
              <h1 className="text-xl sm:text-2xl font-semibold leading-snug text-balance">
                Genetically determined metabolic individuality reveals the effects of germline variations on gastric cancer susceptibility and informs precision prevention
              </h1>
            </div>
            <div className="space-y-2 text-sm sm:text-[0.95rem] leading-relaxed text-pretty">
              <p>
                Zong-Chao Liu<sup>1,†</sup>, Yue He<sup>2,†</sup>, Ting Guo<sup>3,†</sup>, Heng-Min Xu<sup>1</sup>, Xuan Han<sup>1</sup>, Zhi-Qiang Hu<sup>1</sup>, Zhou-Yi Yin<sup>1</sup>, Yu Jin<sup>1</sup>, Lan-Xin Yang<sup>1</sup>, Yu-Xin Wang<sup>1</sup>, Chao Zhang<sup>1</sup>, Meng-Yuan Wang<sup>1</sup>, Yang Zhang<sup>4</sup>, Jing-Ying Zhang<sup>4</sup>, Tong Zhou<sup>4</sup>, Xiao-Fang Xing<sup>3</sup>, Wei-Cheng You<sup>4</sup>, Kai-Feng Pan<sup>1,*</sup>, Peng Cui<sup>2,*</sup>, Jia-Fu Ji<sup>5,*</sup>, Wen-Qing Li<sup>1,*</sup>
              </p>
              <p className="text-xs text-white/75">
                † Equal contribution · * Corresponding authors &nbsp;|&nbsp; pan-kf@263.net · cuip@tsinghua.edu.cn  · jijiafu@hsc.pku.edu.cn · wenqing_li@bjmu.edu.cn
              </p>
              <div className="grid gap-1 text-xs text-white/70 sm:grid-cols-2 md:grid-cols-3">
                <span>1&nbsp;State Key Laboratory of Holistic Integrative Management of Gastrointestinal Cancers, Department of Cancer Epidemiology, Peking University Cancer Hospital &amp; Institute, Beijing 100142, China</span>
                <span>2&nbsp;Department of Computer Science and Technology, Tsinghua University, Beijing, 100084, China</span>
                <span>3&nbsp;Key Laboratory of Carcinogenesis and Translational Research (Ministry of Education/Beijing), Division of Gastrointestinal Cancer Translational Research Laboratory, Peking University Cancer Hospital &amp; Institute, Beijing, 100142, People&apos;s Republic of China</span>
                <span>4&nbsp;Key Laboratory of Carcinogenesis and Translational Research (Ministry of Education/Beijing), Department of Cancer Epidemiology, Peking University Cancer Hospital and Institute, Haidian District, Beijing 100142, China</span>
                <span>5&nbsp;State Key Laboratory of Holistic Integrative Management of Gastrointestinal Cancers, Beijing Key Laboratory of Carcinogenesis and Translational Research, Peking University Cancer Hospital &amp; Institute, Beijing 100142, China</span>
              </div>
            </div>
          </div>

          <p className="max-w-4xl text-white/85 text-pretty text-sm sm:text-base leading-relaxed mt-4">
            The online platform allows to interactively explore resources accompanying the manuscript, including findings related to the genetically influenced metabotypes for gastric cancer and gastric lesion progression.
          </p>

          {/* Global Search Bar */}
          <div className="w-full max-w-3xl mt-4 mb-4">
            <GlobalSearch />
          </div>

          <div className="flex flex-row flex-wrap justify-center gap-3 mt-2">
            <Link
              to="/risk-associations"
              className="bg-red-600/50 hover:bg-red-700/70 text-white px-6 py-3 rounded-lg transition flex items-center gap-2"
            >
              <BarChart3 className="h-5 w-5" />
              <span>Risk estimates</span>
            </Link>
            <Link
              to="/gene-metabolite"
              className="bg-green-600/50 hover:bg-green-700/70 text-white px-6 py-3 rounded-lg transition flex items-center gap-2"
            >
              <Database className="h-5 w-5" />
              <span>Network for GIM traits</span>
            </Link>
            <Link
              to="/spatial-distribution"
              className="bg-cyan-600/50 hover:bg-cyan-700/70 text-white px-6 py-3 rounded-lg transition flex items-center gap-2"
            >
              <MapIcon className="h-5 w-5" />
              <span>Spatial distribution</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full bg-[#000435]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

      {/* Key Findings Summary */}
      <div className="bg-[#000435] rounded-2xl shadow-lg p-6 sm:p-8 mb-8 border border-white/10">
        <h2 className="text-2xl font-bold text-white mb-4">Data overview and features</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Objectives</h3>
            <ul className="space-y-2 text-gray-300 text-pretty">
              <li className="flex items-start space-x-2">
                <Target className="w-4 h-4 text-cyan-400 mt-1 flex-shrink-0" />
                <span>Identify putative causal genomic loci linked to metabolomic traits and gastric cancer risk</span>
              </li>
              <li className="flex items-start space-x-2">
                <Target className="w-4 h-4 text-cyan-400 mt-1 flex-shrink-0" />
                <span>Examine multi-ancestry genetic regulatory effects across the putative causal gene loci and metabolomic traits</span>
              </li>
              <li className="flex items-start space-x-2">
                <Target className="w-4 h-4 text-cyan-400 mt-1 flex-shrink-0" />
                <span>Characterize GIM landscapes for gastric cancer and gastric lesion progression</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Features</h3>
            <ul className="space-y-2 text-gray-300 text-pretty">
              <li className="flex items-start space-x-2">
                <Microscope className="w-4 h-4 text-cyan-400 mt-1 flex-shrink-0" />
                <span>The study covers the analysis of 249 NMR traits on a total of 436,480 individuals </span>
              </li>
              <li className="flex items-start space-x-2">
                <Microscope className="w-4 h-4 text-cyan-400 mt-1 flex-shrink-0" />
                <span>We used the causal stable learning (CSL) framework to derive genetically predicted metabolomic profiles and prioritize putative causal loci</span>
              </li>
              <li className="flex items-start space-x-2">
                <Microscope className="w-4 h-4 text-cyan-400 mt-1 flex-shrink-0" />
            <span>Findings were evaluated in independent cohorts: UKBB discovery and test, UGCED, SIT, and MITS</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Research Data Exploration Grid */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
        <div className="bg-[#001a4d] border border-white/10 rounded-2xl shadow-lg p-5 sm:p-6 flex flex-col hover:border-white/20 transition">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Risk estimates</h3>
          </div>
          <p className="text-gray-300 text-sm sm:text-base text-pretty mb-4 flex-1">
            Relative risks of gastric cancer for directly measured and genetically predicted metabolomic traits across UKBB, SIT, MITS, and UGCED.
          </p>
          <Link
            to="/risk-associations"
            className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center space-x-1"
          >
            <span>View risk estimates</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-[#001a4d] border border-white/10 rounded-2xl shadow-lg p-5 sm:p-6 flex flex-col hover:border-white/20 transition">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">GGM network</h3>
          </div>
          <p className="text-gray-300 text-sm sm:text-base text-pretty mb-4 flex-1">
            Check partial correlations among the traits in the GIMs (Gaussian graphical model).
          </p>
          <Link
            to="/gene-metabolite"
            className="text-green-400 hover:text-green-300 text-sm font-medium flex items-center space-x-1"
          >
            <span>Browse interactions</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-[#001a4d] border border-white/10 rounded-2xl shadow-lg p-5 sm:p-6 flex flex-col hover:border-white/20 transition">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center">
              <MapIcon className="w-6 h-6 text-cyan-300" />
            </div>
            <h3 className="text-lg font-semibold text-white">Spatial distribution</h3>
          </div>
          <p className="text-gray-300 text-sm sm:text-base text-pretty mb-4 flex-1">
            Explore gsMap trait relevance and deconvolution niches across gastric cancer spatial transcriptomics samples.
          </p>
          <Link
            to="/spatial-distribution"
            className="text-cyan-300 hover:text-cyan-200 text-sm font-medium flex items-center space-x-1"
          >
            <span>Open spatial browser</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-[#001a4d] border border-white/10 rounded-2xl shadow-lg p-5 sm:p-6 flex flex-col hover:border-white/20 transition">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Beaker className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Metabolomic traits</h3>
          </div>
          <p className="text-gray-300 text-sm sm:text-base text-pretty mb-4 flex-1">
            See detailed information on the 249 NMR metabolomic traits including descriptions, units, and classifications.
          </p>
          <Link
            to="/metabolic-traits"
            className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center space-x-1"
          >
            <span>View traits</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-[#001a4d] border border-white/10 rounded-2xl shadow-lg p-5 sm:p-6 flex flex-col hover:border-white/20 transition">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Regulatory effects</h3>
          </div>
          <p className="text-gray-300 text-sm sm:text-base text-pretty mb-4 flex-1">
            Check multi-ancestry regulatory effects of the locus–trait pairs in the GIMs.
          </p>
          <Link
            to="/regulatory-effects"
            className="text-orange-400 hover:text-orange-300 text-sm font-medium flex items-center space-x-1"
          >
            <span>View effects</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-[#001a4d] border border-white/10 rounded-2xl shadow-lg p-5 sm:p-6 flex flex-col hover:border-white/20 transition">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Shuffle className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Model assessment</h3>
          </div>
          <p className="text-gray-300 text-sm sm:text-base text-pretty mb-4 flex-1">
            CSL model performance (Pearson’s r between predicted and actual trait levels) by UKBB assessment center and ancestry.
          </p>
          <Link
            to="/model-assessment"
            className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center space-x-1"
          >
            <span>Assess models</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Additional Research Sections */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="bg-[#001a4d] border border-white/10 rounded-2xl shadow-lg p-6 sm:p-7">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Study overview</span>
          </h3>
          <div className="space-y-3 text-gray-300 text-pretty">
            <p>
            We developed a causal stable learning (CSL) framework to predict genetically determined metabolomic 
            profiles and depict the GIMs, which enables the identification of putative causal gene loci for metabolomic 
            traits across heterogeneous populations. 
            </p>
            <p>
            Using this framework, genome-wide variants were integrated with NMR-based metabolomics data to derive
            genetically imputed profiles representing germline‐encoded metabolic individuality. 
            </p>
          </div>
        </div>

        <div className="bg-[#001a4d] border border-white/10 rounded-2xl shadow-lg p-6 sm:p-7">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Database className="w-5 h-5 text-green-400" />
            <span>Data access</span>
          </h3>
          <div className="space-y-3 text-gray-300 text-pretty">
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
      <div className="bg-[#001a4d] border border-white/10 rounded-2xl shadow-lg p-6 sm:p-8 mb-8">
        <h2 className="text-2xl font-bold text-white mb-4">Research team and data access</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">About the project</h3>
            <p className="text-gray-300 text-pretty mb-4">
              This research was conducted by a multidisciplinary team of researchers specializing in 
              genetic epidemiology, artificial intelligence, and gastric cancer research.
            </p>
            <p className="text-sm text-gray-400">
              For collaboration inquiries and data access requests, please contact the research team 
              through the institutional affiliations listed in the publication.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Contact us</h3>
            <p className="text-gray-300 text-pretty mb-4">
              Summary statistics and analysis results are available in the manuscript or through this 
              interactive platform. However, individual-level data is subject to institutional approval 
              and ethical review.
            </p>
            <button 
              className="bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors flex items-center space-x-2"
              onClick={() => window.open('mailto:wenqing_li@bjmu.edu.cn', '_blank')}
            >
              <Mail className="w-4 h-4" />
              <span>Contact us</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="bg-[#001a4d] border border-white/10 rounded-2xl p-6 text-center">
        <p className="text-gray-300 text-pretty">
          This platform provides an interactive interface to explore part of the key supplementary data for the submitted research paper: 
          <br />
          <span className="font-medium text-white">
            "Genetically determined metabolic individuality reveals the effects of germline variations on gastric cancer susceptibility and informs precision prevention"
          </span>
        </p>
        <p className="text-gray-400 text-sm mt-2">
          The webpage is maintained by Department of Cancer Epidemiology, Peking University Cancer Hospital & Institute
        </p>
      </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
