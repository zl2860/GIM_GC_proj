import React from 'react';

const RightsNoticePage: React.FC = () => (
  <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-6">
    <header className="space-y-2">
      <h1 className="text-3xl font-semibold text-gray-900">Academic use only</h1>
      <p className="text-gray-600">
        This research platform is shared exclusively for scholarly collaboration, peer review,
        and educational inquiry. Redistribution or reuse beyond academic purposes is not permitted
        without prior written consent from the contributing investigators.
      </p>
    </header>

    <section className="space-y-2 text-gray-700 text-sm leading-relaxed">
      <p>
        All visualisations, data summaries, and analytic narratives presented here originate from
        ongoing investigations led by the Department of Cancer Epidemiology at Peking University
        Cancer Hospital &amp; Institute. The authors reserve all intellectual property rights.
      </p>
      <p>
        By accessing this site you acknowledge that:
      </p>
      <ul className="list-disc list-inside space-y-1">
        <li>Content is provided “as is” for academic interpretation and discussion.</li>
        <li>No content may be copied, mirrored, or commercialised without permission.</li>
        <li>Any derivative analyses must cite the contributing investigators appropriately.</li>
      </ul>
      <p>
        For collaboration requests or licensing enquiries, please contact the corresponding author
        listed in the manuscript documentation.
      </p>
    </section>

    <footer className="text-xs text-gray-500">
      © 2026 Dept. of Cancer Epidemiology, Peking University Cancer Hospital &amp; Institute. All rights reserved.
    </footer>
  </div>
);

export default RightsNoticePage;
