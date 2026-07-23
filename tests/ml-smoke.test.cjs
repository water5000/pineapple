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

assert.equal(run('FARM_HEADERS.length'), 80);
assert.equal(run("FARM_HEADERS[79]"), 'Station');
propertyStore.set('DEFAULT_STATION', 'ประจวบคีรีขันธ์');
assert.equal(run('getRowStation(Array(80).fill(""))'), 'ประจวบคีรีขันธ์');
assert.equal(run('canAccessStation({ email: "officer@example.org", role: "operator", station: "ประจวบคีรีขันธ์" }, "ประจวบคีรีขันธ์")'), true);
assert.equal(run('canAccessStation({ email: "viewer@example.org", role: "viewer", station: "เพชรบุรี" }, "ประจวบคีรีขันธ์")'), false);
assert.equal(run("isFarmInForecastPeriod({ harvestDate: '15/10/2026' }, '2026-Q4')"), true);
assert.equal(run("isFarmInForecastPeriod({ harvestDate: '15/09/2026' }, '2026-Q4')"), false);
run(`
  globalThis.__originalDashboardReader = getDashboardData;
  getDashboardData = () => ({ success: true, data: { farms: [
    { name: 'private-farm', lat: 12.3, lng: 99.4, area: 10, yield: 20, risk: 'High', harvestDate: '15/10/2026' },
    { name: 'other-quarter', lat: 12.4, lng: 99.5, area: 5, yield: 8, risk: 'Low', harvestDate: '15/09/2026' }
  ] } });
  globalThis.__publicOverview = getPublicOverview(
    { email: 'public-overview@system.local', role: 'viewer', station: 'ประจวบคีรีขันธ์' },
    { period: '2026-Q4' }
  );
  getDashboardData = globalThis.__originalDashboardReader;
`);
assert.equal(run('__publicOverview.data.plotCount'), 1);
assert.equal(run('__publicOverview.data.totalYield'), 20);
assert.equal(run('__publicOverview.data.risks.High'), 1);
assert.equal(run('Object.prototype.hasOwnProperty.call(__publicOverview.data, "farms")'), false);
assert.equal(run('JSON.stringify(__publicOverview).includes("private-farm")'), false);
run(`
  getDashboardData = () => ({ success: true, data: {
    totalYield: 20, totalArea: 10, totalBrix: 13, countBrix: 1, totalRevenue: 200000,
    urgentTasks: [], harvestSoon: [], noPhoto: [], monthlyYields: {},
    risks: { Low: 0, Medium: 0, High: 1 },
    aiGrades: { Level0: 0, Level1: 0, Level2: 1, Level3: 0, Unknown: 0 },
    farms: [{
      rowNumber: 2, name: 'public-farm', lat: 12.3, lng: 99.4,
      photo: 'https://example.test/farm.jpg', notes: 'internal-note',
      actualYieldTon: 18, outcomeObservedAt: '2026-07-20', risk: 'High',
      diseaseClassification: { predictedClass: 'risk', trainingLabel: 'observed-disease' },
      yieldMl: { predictionTon: 20, trainingTargetTon: 18 }
    }]
  } });
  globalThis.__publicDashboard = getPublicDashboardData(
    { email: 'public-overview@system.local', role: 'viewer', station: 'public-station' }
  );
  getDashboardData = globalThis.__originalDashboardReader;
`);
assert.equal(run('__publicDashboard.data.readOnly'), true);
assert.equal(run('__publicDashboard.data.farms[0].name'), 'public-farm');
assert.equal(run('__publicDashboard.data.farms[0].lat'), 12.3);
assert.equal(run('__publicDashboard.data.farms[0].lng'), 99.4);
assert.equal(run('__publicDashboard.data.farms[0].photo'), 'https://example.test/farm.jpg');
assert.equal(run('Object.prototype.hasOwnProperty.call(__publicDashboard.data.farms[0], "notes")'), false);
assert.equal(run('Object.prototype.hasOwnProperty.call(__publicDashboard.data.farms[0], "actualYieldTon")'), false);
assert.equal(run('Object.prototype.hasOwnProperty.call(__publicDashboard.data.farms[0], "outcomeObservedAt")'), false);
assert.equal(run('Object.prototype.hasOwnProperty.call(__publicDashboard.data.farms[0].diseaseClassification, "trainingLabel")'), false);
assert.equal(run('Object.prototype.hasOwnProperty.call(__publicDashboard.data.farms[0].yieldMl, "trainingTargetTon")'), false);
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
