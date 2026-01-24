import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import HomePage from './components/pages/HomePage';
import MetabolicTraitsPage from './components/pages/MetabolicTraitsPage';
import RiskAssociationsPage from './components/pages/RiskAssociationsPage';
import GCGimsPage from './components/pages/GCGimsPage';
import LesionProgressionPage from './components/pages/LesionProgressionPage';
import IncrementalR2Page from './components/pages/IncrementalR2Page';
import RegulatoryEffectsPage from './components/pages/RegulatoryEffectsPage';
import ModelAssessmentPage from './components/pages/ModelAssessmentPage';
import GeneMetaboliteNetworkPage from './components/pages/GeneMetaboliteNetworkPage';
import CorrelationPairs from './components/pages/CorrelationPairs';
import FullyMatchedVariantsPage from './components/pages/FullyMatchedVariantsPage';
import SearchResultsPage from './components/pages/SearchResultsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import RightsNoticePage from './components/pages/RightsNoticePage';
import CSLIdentifiedLociPage from './components/pages/CSLIdentifiedLociPage';
import './index.css';

function App() {
  return (
    <ErrorBoundary>
      <Router basename={import.meta.env.BASE_URL}>
        <div className="min-h-screen bg-gray-50">
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search-results" element={<SearchResultsPage />} />
              <Route path="/metabolic-traits" element={<MetabolicTraitsPage />} />
              <Route path="/correlations" element={<CorrelationPairs />} />
              <Route path="/risk-associations" element={<RiskAssociationsPage />} />
              <Route path="/gc-gims" element={<GCGimsPage />} />
              <Route path="/lesion-progression" element={<LesionProgressionPage />} />
              <Route path="/variants" element={<FullyMatchedVariantsPage />} />
              <Route path="/incremental-r2" element={<IncrementalR2Page />} />
              <Route path="/regulatory-effects" element={<RegulatoryEffectsPage />} />
              <Route path="/csl-loci" element={<CSLIdentifiedLociPage />} />
              <Route path="/gene-metabolite" element={<GeneMetaboliteNetworkPage />} />
              <Route path="/model-assessment" element={<ModelAssessmentPage />} />
              <Route path="/rights" element={<RightsNoticePage />} />
            </Routes>
          </Layout>
          <Toaster position="top-right" />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
