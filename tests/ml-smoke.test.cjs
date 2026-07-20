const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'code.gs'), 'utf8');
const propertyStore = new Map();
const context = {
  console,
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty: key => propertyStore.get(key) || null,
        setProperty: (key, value) => propertyStore.set(key, value)
      };
    }
  }
};
vm.createContext(context);
vm.runInContext(source, context);

const run = expression => vm.runInContext(expression, context);

assert.equal(run('FARM_HEADERS.length'), 79);
assert.deepEqual(
  Array.from(run("parseDiseaseLabels('Low Disease Risk|Root/Crown Rot Risk|Fungal Spot/Leaf Disease Risk')")),
  ['Root/Crown Rot Risk', 'Fungal Spot/Leaf Disease Risk']
);
assert.equal(run("hasOutcomeMeasurement({ outcomeObservedAt: '2026-07-20' })"), false);
assert.equal(run("hasOutcomeMeasurement({ actualYieldTon: 0 })"), true);

run(`
  globalThis.__existingSnapshot = Array.from({ length: FARM_HEADERS.length }, (_, index) => 'old-' + index);
  globalThis.__nextSnapshot = Array.from({ length: FARM_HEADERS.length }, (_, index) => 'new-' + index);
  preservePredictionColumns(globalThis.__nextSnapshot, globalThis.__existingSnapshot);
  preserveRipenessColumns(globalThis.__nextSnapshot, globalThis.__existingSnapshot);
`);
assert.equal(run('__nextSnapshot[64]'), 'old-64');
assert.equal(run('__nextSnapshot[75]'), 'old-75');
assert.equal(run('__nextSnapshot[70]'), 'old-70');
assert.equal(run('__nextSnapshot[65]'), 'new-65');
assert.equal(run('__nextSnapshot[68]'), 'new-68');

run(`
  globalThis.__yieldSamples = Array.from({ length: 60 }, (_, index) => {
    const farm = 'farm-' + (index % 6);
    const x = Array.from({ length: YIELD_FEATURE_NAMES.length }, (_, feature) =>
      ((index * (feature + 3)) % 19) / 19
    );
    return {
      x,
      y: 2.4 + (x[0] * 0.8) - (x[1] * 0.35) + (x[2] * 0.5),
      group: farm
    };
  });
  globalThis.__yieldCv = crossValidateYield(globalThis.__yieldSamples);
  globalThis.__yieldModel = fitLinearRegression(
    globalThis.__yieldSamples,
    'smoke-yield',
    YIELD_FEATURE_NAMES
  );
`);
assert.equal(run('__yieldCv.sampleCount'), 60);
assert.ok(Number.isFinite(run('__yieldCv.rmse')));
assert.ok(run('__yieldCv.conformalError90') >= 0);
assert.equal(run('__yieldModel.weights.length'), 9);

run(`
  globalThis.__diseaseSamples = Array.from({ length: 72 }, (_, index) => {
    const x = Array.from({ length: DISEASE_FEATURE_NAMES.length }, (_, feature) =>
      ((index * (feature + 5)) % 23) / 23
    );
    const root = index % 4 === 0 || x[0] > 0.72;
    const fungal = index % 5 === 0 || x[1] > 0.68;
    return {
      x,
      targets: {
        'Root/Crown Rot Risk': root ? 1 : 0,
        'Fungal Spot/Leaf Disease Risk': fungal ? 1 : 0
      },
      group: 'farm-' + (index % 6)
    };
  });
  globalThis.__diseaseCv = crossValidateDisease(
    globalThis.__diseaseSamples,
    DISEASE_TARGET_LABELS
  );
  globalThis.__diseaseModel = fitMultiLabelLogistic(
    globalThis.__diseaseSamples,
    DISEASE_TARGET_LABELS,
    'smoke-disease',
    DISEASE_FEATURE_NAMES
  );
  globalThis.__diseasePrediction = predictMultiLabelProbabilities(
    globalThis.__diseaseSamples[0].x,
    globalThis.__diseaseModel,
    DISEASE_TARGET_LABELS
  );
`);
assert.equal(run('__diseaseCv.sampleCount'), 72);
assert.ok(Number.isFinite(run('__diseaseCv.macroF1')));
assert.ok(Number.isFinite(run('__diseaseCv.balancedAccuracy')));
assert.equal(run('__diseaseModel.targetLabels.length'), 2);
assert.ok(run("__diseasePrediction['Root/Crown Rot Risk']") >= 0);
assert.ok(run("__diseasePrediction['Root/Crown Rot Risk']") <= 1);

console.log('ML smoke tests passed');
