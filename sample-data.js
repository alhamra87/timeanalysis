/* Sample portfolio so the tool can be explored immediately. Scores follow the default criteria order. */
(function (root) {
  'use strict';
  var BV = ['bv_strategy', 'bv_critical', 'bv_fit', 'bv_usage', 'bv_unique'];
  var TF = ['tf_currency', 'tf_maint', 'tf_security', 'tf_reliability', 'tf_integration', 'tf_cost'];

  function app(name, owner, domain, annualCost, users, lifecycle, bv, tf, notes) {
    var scores = {};
    BV.forEach(function (id, i) { scores[id] = bv[i]; });
    TF.forEach(function (id, i) { scores[id] = tf[i]; });
    return { name: name, owner: owner, domain: domain, annualCost: annualCost, users: users,
      lifecycle: lifecycle, notes: notes || '', scores: scores };
  }

  root.TIME_SAMPLE_APPS = [
    app('Salesforce CRM', 'Head of Sales', 'Customer management', 420000, 850, 'Mainstream',
      [5, 5, 4, 4, 4], [5, 4, 5, 4, 5, 3], 'Core platform for sales and service.'),
    app('SAP ECC 6.0', 'CFO', 'Finance & ERP', 1200000, 1400, 'Containment',
      [5, 5, 4, 3, 5], [2, 2, 3, 4, 2, 1], 'Mainstream maintenance ends 2027; S/4HANA move needed.'),
    app('Legacy Claims (COBOL)', 'Claims Director', 'Claims processing', 650000, 300, 'Containment',
      [4, 5, 3, 3, 5], [1, 1, 2, 3, 1, 2], 'Only 2 developers left with COBOL skills.'),
    app('Microsoft 365', 'CIO', 'Collaboration', 380000, 2500, 'Mainstream',
      [4, 5, 5, 5, 3], [5, 5, 4, 5, 4, 4]),
    app('Workday HCM', 'CHRO', 'Human resources', 290000, 2500, 'Mainstream',
      [4, 4, 4, 4, 3], [5, 4, 5, 5, 4, 3]),
    app('Intranet (SharePoint 2013)', 'Comms Manager', 'Collaboration', 60000, 2500, 'Sunset',
      [2, 2, 2, 2, 1], [1, 2, 1, 3, 2, 2], 'Duplicated by Microsoft 365 / SharePoint Online.'),
    app('Expense Tracker (in-house)', 'Finance Ops', 'Finance & ERP', 45000, 400, 'Containment',
      [2, 2, 3, 2, 1], [2, 2, 2, 3, 2, 3], 'Workday / Concur offer the same capability.'),
    app('Tableau Server', 'Head of Analytics', 'Analytics & BI', 150000, 220, 'Mainstream',
      [2, 2, 4, 2, 2], [4, 4, 4, 4, 4, 3], 'Overlaps with Power BI rolled out with M365.'),
    app('Document Archive (FileNet)', 'Records Manager', 'Records management', 210000, 90, 'Containment',
      [3, 4, 3, 2, 3], [2, 2, 3, 3, 2, 2], 'Regulatory retention requirement.'),
    app('Field Service Mobile App', 'Operations Director', 'Field operations', 180000, 600, 'Emerging',
      [5, 4, 3, 4, 5], [4, 4, 4, 3, 4, 4]),
    app('Visitor Sign-in Kiosk', 'Facilities', 'Facilities', 12000, 40, 'Mainstream',
      [1, 2, 3, 3, 2], [4, 3, 4, 4, 3, 4]),
    app('Access Database – Pricing', 'Pricing Analyst', 'Sales operations', 5000, 6, 'Containment',
      [3, 3, 2, 2, 2], [1, 1, 1, 2, 1, 3], 'Spreadsheet-style tool on a shared drive.'),
  ];
})(typeof self !== 'undefined' ? self : this);
