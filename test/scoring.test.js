const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../scoring.js');

test('classify maps value/fit pairs to TIME quadrants', () => {
  assert.equal(S.classify(4, 4, 3), 'invest');
  assert.equal(S.classify(4, 2, 3), 'migrate');
  assert.equal(S.classify(2, 4, 3), 'tolerate');
  assert.equal(S.classify(2, 2, 3), 'eliminate');
});

test('scores exactly on the threshold count as high', () => {
  assert.equal(S.classify(3, 3, 3), 'invest');
  assert.equal(S.classify(2.99, 3, 3), 'tolerate');
});

test('classify returns null when a dimension is unscored', () => {
  assert.equal(S.classify(null, 4, 3), null);
  assert.equal(S.classify(4, null, 3), null);
});

test('weightedScore applies weights and ignores unanswered criteria', () => {
  const criteria = [
    { id: 'a', weight: 30 },
    { id: 'b', weight: 10 },
    { id: 'c', weight: 60 },
  ];
  const r = S.weightedScore(criteria, { a: 5, b: 1 });
  assert.equal(r.answered, 2);
  assert.equal(r.total, 3);
  assert.equal(r.score, (5 * 30 + 1 * 10) / 40);
});

test('weightedScore ignores out-of-range values', () => {
  const r = S.weightedScore([{ id: 'a', weight: 1 }], { a: 9 });
  assert.equal(r.score, null);
  assert.equal(r.answered, 0);
});

test('assess honours overrides and reports completeness', () => {
  const settings = S.defaultSettings();
  const scores = {};
  settings.criteria.bv.forEach((c) => { scores[c.id] = 5; });
  settings.criteria.tf.forEach((c) => { scores[c.id] = 1; });

  const plain = S.assess({ scores }, settings);
  assert.equal(plain.bv, 5);
  assert.equal(plain.tf, 1);
  assert.equal(plain.category, 'migrate');
  assert.equal(plain.completeness, 1);
  assert.equal(plain.overridden, false);

  const over = S.assess({ scores, override: { category: 'eliminate', reason: 'Replaced by new ERP' } }, settings);
  assert.equal(over.calculated, 'migrate');
  assert.equal(over.category, 'eliminate');
  assert.equal(over.overridden, true);
});

test('sample portfolio covers all four quadrants', () => {
  global.self = {};
  require('../sample-data.js');
  const settings = S.defaultSettings();
  const cats = new Set(global.self.TIME_SAMPLE_APPS.map((a) => S.assess(a, settings).category));
  assert.deepEqual([...cats].sort(), ['eliminate', 'invest', 'migrate', 'tolerate']);
});
