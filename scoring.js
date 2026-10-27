/*
 * Gartner TIME scoring engine.
 * Works in the browser (window.TimeScoring) and in Node (module.exports) so it can be unit tested.
 *
 * Model: every application is scored 1-5 on a set of weighted criteria in two dimensions:
 *   - Business Value (BV): how much the business needs and benefits from the application
 *   - Technical Fit  (TF): how healthy, supportable and future-proof the technology is
 * The weighted averages place the application in one of four TIME quadrants:
 *
 *                 Low TF        High TF
 *   High BV  |   MIGRATE    |   INVEST    |
 *   Low BV   |  ELIMINATE   |  TOLERATE   |
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TimeScoring = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CATEGORIES = {
    invest: {
      key: 'invest',
      label: 'Invest',
      quadrant: 'High business value · High technical fit',
      summary: 'Strategic, healthy applications. Keep funding and evolving them.',
      actions: [
        'Prioritise for new features and capability expansion',
        'Use as a target platform when consolidating overlapping apps',
        'Maintain modernisation roadmap so it stays healthy',
      ],
    },
    migrate: {
      key: 'migrate',
      label: 'Migrate',
      quadrant: 'High business value · Low technical fit',
      summary: 'The business needs it, but the technology is holding it back. Modernise or re-platform.',
      actions: [
        'Re-platform, re-factor or replace with a modern equivalent',
        'Move functionality onto an "Invest" platform where possible',
        'Mitigate technical risk (security, support) until migrated',
      ],
    },
    tolerate: {
      key: 'tolerate',
      label: 'Tolerate',
      quadrant: 'Low business value · High technical fit',
      summary: 'Technically fine, but not adding much value. Keep running with minimal investment.',
      actions: [
        'Freeze enhancements; limit spend to essential maintenance',
        'Look for ways to raise value (wider adoption, reuse)',
        'Re-assess periodically — candidate for consolidation',
      ],
    },
    eliminate: {
      key: 'eliminate',
      label: 'Eliminate',
      quadrant: 'Low business value · Low technical fit',
      summary: 'Costly to keep and adds little. Plan retirement.',
      actions: [
        'Define a decommission plan and sunset date',
        'Archive data and redirect users to alternatives',
        'Release licence, infrastructure and support costs',
      ],
    },
  };

  function defaultSettings() {
    return {
      threshold: 3,
      criteria: {
        bv: [
          { id: 'bv_strategy', name: 'Strategic alignment', weight: 25,
            help: 'Supports current business strategy and target operating model.',
            low: 'No link to strategy', high: 'Core enabler of strategy' },
          { id: 'bv_critical', name: 'Business criticality', weight: 25,
            help: 'Impact on operations, revenue or customers if the application is unavailable.',
            low: 'Little or no impact', high: 'Operations stop' },
          { id: 'bv_fit', name: 'Functional fit', weight: 20,
            help: 'How well the functionality covers what users actually need.',
            low: 'Major gaps / workarounds', high: 'Fully meets needs' },
          { id: 'bv_usage', name: 'Usage & user satisfaction', weight: 15,
            help: 'Adoption breadth and how satisfied users are.',
            low: 'Few users, unhappy', high: 'Widely used, valued' },
          { id: 'bv_unique', name: 'Uniqueness / differentiation', weight: 15,
            help: 'Provides capability not available elsewhere in the portfolio.',
            low: 'Fully redundant', high: 'Unique, differentiating' },
        ],
        tf: [
          { id: 'tf_currency', name: 'Technology currency', weight: 20,
            help: 'Platform, language, frameworks and vendor product are current and supported.',
            low: 'End-of-life / obsolete', high: 'Current, mainstream' },
          { id: 'tf_maint', name: 'Maintainability & skills', weight: 20,
            help: 'Ease of change, code/config quality, availability of skills and vendor support.',
            low: 'Hard to change, no skills', high: 'Easy to change, skills plentiful' },
          { id: 'tf_security', name: 'Security & compliance', weight: 20,
            help: 'Meets security standards, patched, compliant with regulation.',
            low: 'Known critical gaps', high: 'Fully compliant' },
          { id: 'tf_reliability', name: 'Reliability & performance', weight: 15,
            help: 'Stability, incidents, scalability and performance.',
            low: 'Frequent outages', high: 'Stable and scalable' },
          { id: 'tf_integration', name: 'Integration & architecture fit', weight: 15,
            help: 'Fits the target architecture; standard APIs and interfaces.',
            low: 'Isolated / point-to-point', high: 'Standard APIs, fits target' },
          { id: 'tf_cost', name: 'Cost efficiency (TCO)', weight: 10,
            help: 'Run cost is reasonable for what the application delivers.',
            low: 'Very expensive to run', high: 'Low, proportionate cost' },
        ],
      },
    };
  }

  /** Weighted average of 1-5 scores. Unscored criteria are ignored. */
  function weightedScore(criteria, scores) {
    var sum = 0, weights = 0, answered = 0;
    scores = scores || {};
    for (var i = 0; i < criteria.length; i++) {
      var c = criteria[i];
      var s = Number(scores[c.id]);
      var w = Number(c.weight) || 0;
      if (s >= 1 && s <= 5) {
        answered++;
        if (w > 0) { sum += s * w; weights += w; }
      }
    }
    return {
      score: weights > 0 ? sum / weights : null,
      answered: answered,
      total: criteria.length,
    };
  }

  /** Map a BV/TF pair to a TIME category key. Scores equal to the threshold count as "high". */
  function classify(bv, tf, threshold) {
    if (bv == null || tf == null) return null;
    var t = threshold == null ? 3 : threshold;
    var highBV = bv >= t, highTF = tf >= t;
    if (highBV && highTF) return 'invest';
    if (highBV) return 'migrate';
    if (highTF) return 'tolerate';
    return 'eliminate';
  }

  /** Full assessment result for one application. */
  function assess(app, settings) {
    var bv = weightedScore(settings.criteria.bv, app.scores);
    var tf = weightedScore(settings.criteria.tf, app.scores);
    var calculated = classify(bv.score, tf.score, settings.threshold);
    var override = app.override && app.override.category && CATEGORIES[app.override.category]
      ? app.override.category : null;
    var answered = bv.answered + tf.answered, total = bv.total + tf.total;
    return {
      bv: bv.score,
      tf: tf.score,
      calculated: calculated,
      category: override || calculated,
      overridden: !!override && override !== calculated,
      completeness: total ? answered / total : 0,
    };
  }

  return {
    CATEGORIES: CATEGORIES,
    defaultSettings: defaultSettings,
    weightedScore: weightedScore,
    classify: classify,
    assess: assess,
  };
});
