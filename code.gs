const DATA_SHEET_NAME = 'Farms';
const LOG_SHEET_NAME = 'Logs';

const FARM_HEADERS = [
  'Timestamp',
  'Farm Name',
  'Area Rai',
  'Latitude',
  'Longitude',
  'Planting Date',
  'Forcing Date',
  'Soil Drainage',
  'Expected Harvest Date',
  'Predicted Yield Ton',
  'Predicted Weight Kg',
  'Predicted Grade',
  'Predicted Brix',
  'Risk Level',
  'Risk Message',
  'AI Analysis',
  'Photo URL',
  'AI Label',
  'AI Confidence',
  'Updated At',
  'Status',
  'Variety',
  'Plant Density',
  'Soil Type',
  'Irrigation',
  'Drainage Score',
  'Notes',
  'Actual Harvest Date',
  'Actual Yield Ton',
  'Actual Brix',
  'Actual Grade',
  'Disease Observed',
  'Weather Retrieved At',
  'Weather Source',
  'Rain 24h mm',
  'Rain 72h mm',
  'Rain 120h mm',
  'Humidity Avg %',
  'Humidity Max %',
  'Temp Avg C',
  'Temp Min C',
  'Temp Max C',
  'Leaf Wetness Hours',
  'Heavy Rain Events',
  'Dry Forecast Slots',
  'Weather Stress Score',
  'Drought Score',
  'Disease Weather Score',
  'Weather Impact Factor',
  'Disease Classifier Version',
  'Disease Predicted Class',
  'Disease Risk Score',
  'Disease Probability %',
  'Disease Severity Predicted',
  'Disease Reasons',
  'Recommended Disease Action',
  'Disease Training Label',
  'Yield Model Version',
  'Yield ML Prediction Ton',
  'Yield ML Confidence %',
  'Yield Prediction Low Ton',
  'Yield Prediction High Ton',
  'Yield Training Target Ton',
  'ML Feature Version',
  'Prediction Timestamp',
  'Outcome Observed At',
  'Actual Harvested Area Rai',
  'Plant Survival %',
  'Actual Ripeness Level',
  'Ripeness Model Version',
  'Ripeness Probabilities JSON',
  'Ripeness Expected Level',
  'Ripeness Confidence Margin',
  'Image Quality Score',
  'Ripeness Status',
  'Disease Probabilities JSON',
  'Drought Stress Risk %',
  'Data Contract Version',
  'Drought Stress Observed'
];

const LOG_HEADERS = ['Timestamp', 'Action', 'Success', 'Message', 'Detail'];
const YIELD_MODEL_KEY = 'YIELD_ML_MODEL_JSON';
const DISEASE_MODEL_KEY = 'DISEASE_ML_MODEL_JSON';
const YIELD_CHALLENGER_MODEL_KEY = 'YIELD_ML_CHALLENGER_JSON';
const DISEASE_CHALLENGER_MODEL_KEY = 'DISEASE_ML_CHALLENGER_JSON';
const ML_FEATURE_VERSION = 'pineapple-ml-features-v3';
const DATA_CONTRACT_VERSION = 'pineapple-data-contract-v3';
const YIELD_FEATURE_NAMES = [
  'plantDensity',
  'drainageScore',
  'rain72hMm',
  'humidityAvg',
  'leafWetnessHours',
  'weatherStressScore',
  'varietyCode',
  'daysForcingToHarvest',
  'weatherMissingCount'
];
const DISEASE_FEATURE_NAMES = [
  'drainageScore',
  'rain72hMm',
  'humidityAvg',
  'leafWetnessHours',
  'diseaseWeatherScore',
  'varietyCode',
  'daysForcingToHarvest',
  'weatherMissingCount'
];
const DISEASE_TARGET_LABELS = [
  'Root/Crown Rot Risk',
  'Fungal Spot/Leaf Disease Risk'
];

function getOpenWeatherApiKey() {
  return PropertiesService.getScriptProperties().getProperty('OPENWEATHER_API_KEY');
}

function getApiSecret() {
  return PropertiesService.getScriptProperties().getProperty('API_SECRET');
}

function isAuthorizedRequest(body) {
  const expectedSecret = getApiSecret();
  if (!expectedSecret) return true;
  return body && body.apiSecret === expectedSecret;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getDashboardData') {
    return jsonResponse(getDashboardData());
  }
  if (e && e.parameter && e.parameter.action === 'getMLModelStatus') {
    return jsonResponse(getMLModelStatus());
  }
  return jsonResponse({ success: true, message: 'Pineapple Farm API is running.' });
}

function doPost(e) {
  let action = 'unknown';
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (!isAuthorizedRequest(body)) {
      logEvent('auth', false, 'Unauthorized request', '');
      return jsonResponse({ success: false, message: 'Unauthorized request.' });
    }

    action = body.action || 'unknown';
    const payload = body.payload || {};
    let result;

    if (action === 'saveData') {
      result = saveData(payload);
    } else if (action === 'saveOutcome') {
      result = saveOutcome(payload);
    } else if (action === 'updateData') {
      result = updateData(payload);
    } else if (action === 'deleteData') {
      result = deleteData(payload);
    } else if (action === 'getDashboardData') {
      result = getDashboardData();
    } else if (action === 'trainMLModels') {
      result = trainMLModels(payload);
    } else if (action === 'getMLModelStatus') {
      result = getMLModelStatus();
    } else {
      result = { success: false, message: 'Unknown action: ' + action };
    }

    logEvent(action, !!result.success, result.message || '', JSON.stringify(safeLogPayload(payload)));
    return jsonResponse(result);
  } catch (error) {
    logEvent(action, false, error.toString(), '');
    return jsonResponse({ success: false, message: friendlyError(error), detail: error.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getDataSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(DATA_SHEET_NAME);
  if (!sheet) {
    const sheets = ss.getSheets();
    sheet = sheets[0] || ss.insertSheet(DATA_SHEET_NAME);
    if (sheet.getName() !== DATA_SHEET_NAME) sheet.setName(DATA_SHEET_NAME);
  }
  ensureHeader(sheet, FARM_HEADERS);
  return sheet;
}

function getLogSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(LOG_SHEET_NAME);
  ensureHeader(sheet, LOG_HEADERS);
  return sheet;
}

function ensureHeader(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }

  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  const hasAnyHeader = current.some(value => String(value || '').trim() !== '');
  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const missingWidth = headers.length - sheet.getLastColumn();
  if (missingWidth > 0) {
    sheet.insertColumnsAfter(sheet.getLastColumn(), missingWidth);
  }

  const normalized = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const shouldUpdate = headers.some((header, index) => !normalized[index]);
  if (shouldUpdate) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function logEvent(action, success, message, detail) {
  try {
    getLogSheet().appendRow([new Date(), action, success ? 'TRUE' : 'FALSE', message, detail || '']);
  } catch (error) {
    console.error('Log failed: ' + error.toString());
  }
}

function safeLogPayload(payload) {
  const clone = Object.assign({}, payload || {});
  if (clone.imageBase64) clone.imageBase64 = '[image omitted]';
  return clone;
}

function friendlyError(error) {
  const text = error ? error.toString() : '';
  if (text.includes('DriveApp') || text.includes('drive')) {
    return 'ไม่สามารถบันทึกรูปลง Google Drive ได้ กรุณาตรวจสิทธิ์ Drive หรือรัน setupPermissions ใน Apps Script';
  }
  if (text.includes('Unauthorized')) return 'ไม่มีสิทธิ์เรียก API กรุณาตรวจ API_SECRET';
  return text || 'เกิดข้อผิดพลาด';
}

function validateFarmInput(formObj) {
  if (!formObj) throw new Error('Missing form data.');
  if (!String(formObj.farmName || '').trim()) throw new Error('กรุณากรอกชื่อแปลง');
  const area = parseFloat(formObj.plantArea);
  if (!isFinite(area) || area <= 0) throw new Error('พื้นที่ปลูกต้องมากกว่า 0');
  const density = formObj.plantDensity ? parseFloat(formObj.plantDensity) : 7000;
  if (!isFinite(density) || density <= 0) throw new Error('จำนวนต้นต่อไร่ต้องมากกว่า 0');
  const lat = parseFloat(formObj.latitude);
  const lng = parseFloat(formObj.longitude);
  if (!isFinite(lat) || !isFinite(lng)) throw new Error('กรุณาปักหมุดพิกัดบนแผนที่');
  if (!formObj.plantingDate || !formObj.forcingDate) throw new Error('กรุณากรอกวันที่ปลูกและวันที่บังคับดอก');
}

function calculateFarmRecord(formObj, existingPhotoUrl, options) {
  validateFarmInput(formObj);
  const calculationOptions = options || {};
  const existingRow = calculationOptions.existingRow || [];
  const preservePredictionSnapshot = Boolean(calculationOptions.preservePredictionSnapshot);

  const timestamp = formObj.timestamp ? new Date(formObj.timestamp) : new Date();
  const plantingDate = new Date(formObj.plantingDate);
  const forcingDate = new Date(formObj.forcingDate);
  const expectedHarvestDate = new Date(forcingDate);
  expectedHarvestDate.setDate(expectedHarvestDate.getDate() + 150);

  const formattedPlantingDate = Utilities.formatDate(plantingDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const formattedForcingDate = Utilities.formatDate(forcingDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const formattedHarvestDate = Utilities.formatDate(expectedHarvestDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');

  const areaRai = parseFloat(formObj.plantArea);
  const weatherFeatures = preservePredictionSnapshot
    ? weatherFeaturesFromRow(existingRow)
    : getWeatherFeatures(formObj.latitude, formObj.longitude);
  const riskData = preservePredictionSnapshot
    ? riskDataFromRow(existingRow)
    : checkDiseaseRisk(formObj.latitude, formObj.longitude, formObj.soilDrainage, weatherFeatures);
  const harvestMonth = expectedHarvestDate.getMonth() + 1;
  const isOffSeason = harvestMonth >= 10 || harvestMonth <= 3;
  const seasonalMultiplier = isOffSeason ? 0.95 : 1.05;
  const hasWeatherData = weatherFeatures.source === 'openweather_forecast_5d_3h';
  const isRainingHeavily = hasWeatherData && riskData.heavyRainCount >= 2;
  const isDrought = hasWeatherData && riskData.heavyRainCount === 0 && riskData.leafWetness === 0;

  let weatherImpact = seasonalMultiplier * weatherFeatures.weatherImpactFactor;
  if (isRainingHeavily) weatherImpact += 0.03;
  else if (isDrought) weatherImpact -= 0.03;

  let diseaseLoss = 0;
  if (riskData.normalizedRisk === 'High') diseaseLoss = 0.15;
  else if (riskData.normalizedRisk === 'Medium') diseaseLoss = 0.05;

  let soilMultiplier = 1.0;
  let soilDrainageTH = 'ดี';
  if (formObj.soilDrainage === 'moderate') {
    soilDrainageTH = 'ปานกลาง';
    soilMultiplier = 0.95;
  } else if (formObj.soilDrainage === 'poor') {
    soilDrainageTH = 'แย่';
    soilMultiplier = 0.85;
  }

  const drainageScore = formObj.drainageScore ? Math.max(1, Math.min(5, parseFloat(formObj.drainageScore))) : '';
  if (drainageScore !== '') {
    if (drainageScore <= 2) soilMultiplier -= 0.06;
    else if (drainageScore >= 4) soilMultiplier += 0.03;
  }

  const variety = String(formObj.variety || 'ไม่ระบุ').trim();
  const soilType = String(formObj.soilType || 'ไม่ระบุ').trim();
  const irrigation = String(formObj.irrigation || 'ไม่ระบุ').trim();
  const notes = String(formObj.notes || '').trim();
  const actualHarvestDate = formObj.actualHarvestDate || '';
  const actualYieldTon = formObj.actualYieldTon || '';
  const actualBrix = formObj.actualBrix || '';
  const actualGrade = formObj.actualGrade || '';
  const diseaseObserved = formObj.diseaseObserved || '';
  const outcomeObservedAt = formObj.outcomeObservedAt || '';
  const actualHarvestedAreaRai = formObj.actualHarvestedAreaRai || '';
  const plantSurvivalPct = formObj.plantSurvivalPct || '';
  const actualRipenessLevel = formObj.actualRipenessLevel || '';
  const droughtStressObserved = formObj.droughtStressObserved || '';

  let varietyMultiplier = 1.0;
  const varietyLower = variety.toLowerCase();
  if (varietyLower.includes('md2')) varietyMultiplier = 1.08;
  else if (varietyLower.includes('ภูแล')) varietyMultiplier = 0.82;
  else if (varietyLower.includes('ปัตตาเวีย')) varietyMultiplier = 1.0;

  let irrigationMultiplier = 1.0;
  const irrigationLower = irrigation.toLowerCase();
  if (irrigationLower.includes('drip') || irrigation.includes('หยด')) irrigationMultiplier = 1.04;
  else if (irrigation.includes('ไม่มี')) irrigationMultiplier = 0.94;

  const targetDensity = formObj.plantDensity ? parseFloat(formObj.plantDensity) : 7000;
  const fruitingRate = 0.85;
  const baseWeight = 1.35;
  const actualFruitingRate = Math.max(0, fruitingRate - diseaseLoss);
  const actualWeight = baseWeight * weatherImpact * varietyMultiplier;
  const totalYieldKg = areaRai * targetDensity * actualFruitingRate * actualWeight * soilMultiplier * irrigationMultiplier;
  const baselineYieldTon = Number((totalYieldKg / 1000).toFixed(2));

  let predictedBrix = 12.5;
  if (isOffSeason) predictedBrix += 1.5;
  if (isRainingHeavily) predictedBrix -= 1.0;
  else if (isDrought) predictedBrix += 1.0;

  let predictedGrade = '';
  if (actualWeight >= 1.5) predictedGrade = 'เกรด A (พรีเมียม/เข้าโรงงาน)';
  else if (actualWeight >= 1.0) predictedGrade = 'เกรด B (ขนาดมาตรฐาน)';
  else predictedGrade = 'เกรด C (ไซส์เล็ก/ทำน้ำผลไม้)';

  const imageResult = saveImageToDrive(formObj.imageBase64, formObj.farmName);
  const photoUrl = imageResult.url || existingPhotoUrl || '';
  const aiLabel = String(formObj.aiLabel || '').trim();
  const aiConfidence = formObj.aiConfidence !== undefined && formObj.aiConfidence !== ''
    ? Number(formObj.aiConfidence)
    : '';
  const predictionTimestamp = new Date();
  const ripenessModelVersion = String(formObj.ripenessModelVersion || '').trim();
  const ripenessProbabilities = String(formObj.ripenessProbabilities || '').trim();
  const ripenessExpectedLevel = formObj.ripenessExpectedLevel !== undefined ? formObj.ripenessExpectedLevel : '';
  const ripenessMargin = formObj.ripenessMargin !== undefined ? formObj.ripenessMargin : '';
  const imageQualityScore = formObj.imageQualityScore !== undefined ? formObj.imageQualityScore : '';
  const ripenessStatus = String(formObj.ripenessStatus || '').trim();
  const mlFeatures = buildMlFeatureObject({
    areaRai,
    plantDensity: targetDensity,
    drainageScore,
    predictedWeightKg: actualWeight,
    predictedBrix,
    soilDrainage: formObj.soilDrainage,
    variety,
    irrigation,
    plantingDate,
    forcingDate,
    harvestDate: expectedHarvestDate,
    weatherFeatures,
    aiConfidence
  });
  const yieldMlPrediction = predictYieldML(mlFeatures, areaRai, baselineYieldTon);
  const totalYieldTon = yieldMlPrediction.available ? yieldMlPrediction.blendedPredictionTon : baselineYieldTon;
  const diseaseClassification = classifyDiseaseML(formObj, weatherFeatures, riskData, drainageScore, aiLabel, aiConfidence, mlFeatures);

  const row = [
      timestamp,
      String(formObj.farmName || '').trim(),
      areaRai,
      parseFloat(formObj.latitude),
      parseFloat(formObj.longitude),
      formattedPlantingDate,
      formattedForcingDate,
      soilDrainageTH,
      formattedHarvestDate,
      totalYieldTon.toFixed(2),
      actualWeight.toFixed(2),
      predictedGrade,
      predictedBrix.toFixed(1),
      riskData.level,
      riskData.message,
      formObj.aiAnalysis || 'ไม่ได้วิเคราะห์',
      photoUrl,
      aiLabel,
      aiConfidence,
      new Date(),
      'Active',
      variety,
      targetDensity,
      soilType,
      irrigation,
      drainageScore,
      notes,
      actualHarvestDate,
      actualYieldTon,
      actualBrix,
      actualGrade,
      diseaseObserved,
      weatherFeatures.retrievedAt,
      weatherFeatures.source,
      weatherFeatures.rain24hMm,
      weatherFeatures.rain72hMm,
      weatherFeatures.rain120hMm,
      weatherFeatures.humidityAvg,
      weatherFeatures.humidityMax,
      weatherFeatures.tempAvgC,
      weatherFeatures.tempMinC,
      weatherFeatures.tempMaxC,
      weatherFeatures.leafWetnessHours,
      weatherFeatures.heavyRainEvents,
      weatherFeatures.dryForecastSlots,
      weatherFeatures.weatherStressScore,
      weatherFeatures.droughtScore,
      weatherFeatures.diseaseWeatherScore,
      weatherFeatures.weatherImpactFactor,
      diseaseClassification.version,
      diseaseClassification.predictedClass,
      diseaseClassification.riskScore,
      diseaseClassification.probability,
      diseaseClassification.severity,
      diseaseClassification.reasons,
      diseaseClassification.action,
      diseaseClassification.trainingLabel,
      yieldMlPrediction.version,
      yieldMlPrediction.available ? yieldMlPrediction.blendedPredictionTon.toFixed(2) : '',
      yieldMlPrediction.available ? yieldMlPrediction.confidence : '',
      yieldMlPrediction.available ? yieldMlPrediction.lowTon.toFixed(2) : '',
      yieldMlPrediction.available ? yieldMlPrediction.highTon.toFixed(2) : '',
      actualYieldTon,
      ML_FEATURE_VERSION,
      predictionTimestamp,
      outcomeObservedAt,
      actualHarvestedAreaRai,
      plantSurvivalPct,
      actualRipenessLevel,
      ripenessModelVersion,
      ripenessProbabilities,
      ripenessExpectedLevel,
      ripenessMargin,
      imageQualityScore,
      ripenessStatus,
      JSON.stringify(diseaseClassification.probabilities || {}),
      diseaseClassification.droughtRisk,
      DATA_CONTRACT_VERSION,
      droughtStressObserved
    ];

  if (preservePredictionSnapshot) {
    preservePredictionColumns(row, existingRow);
    if (!String(formObj.imageBase64 || '').trim()) preserveRipenessColumns(row, existingRow);
  }

  return {
    row,
    harvestDate: formattedHarvestDate,
    yieldTon: totalYieldTon.toFixed(2),
    grade: predictedGrade,
    riskData,
    imageWarning: imageResult.warning || ''
  };
}

function saveData(formObj) {
  try {
    const sheet = getDataSheet();
    const record = calculateFarmRecord(formObj, '');
    sheet.appendRow(record.row);
    return {
      success: true,
      message: `บันทึกข้อมูลแปลง <b>${record.row[1]}</b> สำเร็จ${record.imageWarning ? '<br><small class="text-orange-600">' + record.imageWarning + '</small>' : ''}`,
      harvestDate: record.harvestDate
    };
  } catch (error) {
    return { success: false, message: friendlyError(error), detail: error.toString() };
  }
}

function saveOutcome(payload) {
  try {
    const sheet = getDataSheet();
    const rowNumber = parseInt(payload.rowNumber, 10);
    if (!rowNumber || rowNumber <= 1 || rowNumber > sheet.getLastRow()) {
      throw new Error('Invalid row number.');
    }

    const outcomeObservedAt = String(payload.outcomeObservedAt || '').trim();
    if (!outcomeObservedAt || !parseSheetDate(outcomeObservedAt)) {
      throw new Error('Outcome observed date is required.');
    }
    if (!hasOutcomeMeasurement(payload)) {
      throw new Error('Enter at least one observed result.');
    }

    const row = sheet.getRange(rowNumber, 1, 1, FARM_HEADERS.length).getValues()[0];
    if (String(row[20] || 'Active') === 'Deleted') {
      throw new Error('Cannot add an outcome to a deleted plot.');
    }

    const actualYieldTon = validatedOutcomeNumber(payload.actualYieldTon, 'Actual yield', 0, null);
    const harvestedAreaRai = validatedOutcomeNumber(payload.actualHarvestedAreaRai, 'Harvested area', 0.0001, null);
    const plantSurvivalPct = validatedOutcomeNumber(payload.plantSurvivalPct, 'Plant survival', 0, 100);
    const actualBrix = validatedOutcomeNumber(payload.actualBrix, 'Actual Brix', 0, null);
    const observedDiseases = parseDiseaseLabels(payload.diseaseObserved);

    row[19] = new Date();
    row[27] = payload.actualHarvestDate || '';
    row[28] = actualYieldTon;
    row[29] = actualBrix;
    row[30] = payload.actualGrade || '';
    row[31] = observedDiseases.join('|');
    row[56] = observedDiseases.join('|');
    row[62] = actualYieldTon;
    row[65] = outcomeObservedAt;
    row[66] = harvestedAreaRai;
    row[67] = plantSurvivalPct;
    row[68] = payload.actualRipenessLevel || '';
    row[77] = DATA_CONTRACT_VERSION;
    row[78] = payload.droughtStressObserved || '';

    sheet.getRange(rowNumber, 1, 1, FARM_HEADERS.length).setValues([row]);
    return {
      success: true,
      message: `Recorded observed outcome for <b>${row[1]}</b> without overwriting its prediction snapshot.`
    };
  } catch (error) {
    return { success: false, message: friendlyError(error), detail: error.toString() };
  }
}

function validatedOutcomeNumber(value, label, minimum, maximum) {
  if (value === undefined || value === null || String(value).trim() === '') return '';
  const number = Number(value);
  if (!isFinite(number) || number < minimum || (maximum !== null && number > maximum)) {
    throw new Error(`${label} is outside the valid range.`);
  }
  return number;
}

function hasOutcomeMeasurement(formObj) {
  const measurementFields = [
    'actualHarvestDate',
    'actualYieldTon',
    'actualHarvestedAreaRai',
    'plantSurvivalPct',
    'actualBrix',
    'actualGrade',
    'actualRipenessLevel',
    'diseaseObserved',
    'droughtStressObserved'
  ];
  return measurementFields.some(field => {
    const value = formObj[field];
    return value !== undefined && value !== null && String(value).trim() !== '';
  });
}

function updateData(payload) {
  try {
    const sheet = getDataSheet();
    const rowNumber = parseInt(payload.rowNumber, 10);
    if (!rowNumber || rowNumber <= 1 || rowNumber > sheet.getLastRow()) {
      throw new Error('Invalid row number.');
    }

    const existing = sheet.getRange(rowNumber, 1, 1, FARM_HEADERS.length).getValues()[0];
    const existingPhotoUrl = existing[16] || '';
    const payloadForm = payload.formData || {};
    const formObj = Object.assign({}, payloadForm, { timestamp: existing[0] || new Date() });
    const preservePredictionSnapshot = hasObservedOutcome(payloadForm) && Boolean(existing[64] || existing[32]);
    const record = calculateFarmRecord(formObj, existingPhotoUrl, {
      existingRow: existing,
      preservePredictionSnapshot
    });
    sheet.getRange(rowNumber, 1, 1, FARM_HEADERS.length).setValues([record.row]);

    return {
      success: true,
      message: `อัปเดตข้อมูลแปลง <b>${record.row[1]}</b> สำเร็จ${record.imageWarning ? '<br><small class="text-orange-600">' + record.imageWarning + '</small>' : ''}`
    };
  } catch (error) {
    return { success: false, message: friendlyError(error), detail: error.toString() };
  }
}

function hasObservedOutcome(formObj) {
  const outcomeFields = [
    'outcomeObservedAt',
    'actualHarvestDate',
    'actualYieldTon',
    'actualHarvestedAreaRai',
    'plantSurvivalPct',
    'actualBrix',
    'actualGrade',
    'actualRipenessLevel',
    'diseaseObserved',
    'droughtStressObserved'
  ];
  return outcomeFields.some(field => {
    const value = formObj[field];
    return value !== undefined && value !== null && String(value).trim() !== '';
  });
}

function weatherFeaturesFromRow(row) {
  return {
    retrievedAt: row[32] || '',
    source: String(row[33] || ''),
    rain24hMm: optionalNumber(row[34]),
    rain72hMm: optionalNumber(row[35]),
    rain120hMm: optionalNumber(row[36]),
    humidityAvg: optionalNumber(row[37]),
    humidityMax: optionalNumber(row[38]),
    tempAvgC: optionalNumber(row[39]),
    tempMinC: optionalNumber(row[40]),
    tempMaxC: optionalNumber(row[41]),
    leafWetnessHours: optionalNumber(row[42]),
    heavyRainEvents: toNumber(row[43], 0),
    dryForecastSlots: toNumber(row[44], 0),
    weatherStressScore: optionalNumber(row[45]),
    droughtScore: optionalNumber(row[46]),
    diseaseWeatherScore: optionalNumber(row[47]),
    weatherImpactFactor: toNumber(row[48], 1)
  };
}

function riskDataFromRow(row) {
  return {
    level: String(row[13] || 'Low'),
    message: String(row[14] || ''),
    normalizedRisk: normalizeRisk(row[13]),
    heavyRainCount: toNumber(row[43], 0),
    leafWetness: toNumber(row[42], 0)
  };
}

function preservePredictionColumns(nextRow, existingRow) {
  const predictionColumns = [
    8, 9, 10, 11, 12, 13, 14,
    32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
    49, 50, 51, 52, 53, 54, 55,
    57, 58, 59, 60, 61, 63, 64, 75, 76
  ];
  predictionColumns.forEach(index => {
    nextRow[index] = existingRow[index];
  });
}

function preserveRipenessColumns(nextRow, existingRow) {
  [15, 17, 18, 69, 70, 71, 72, 73, 74].forEach(index => {
    nextRow[index] = existingRow[index];
  });
}

function deleteData(payload) {
  try {
    const sheet = getDataSheet();
    const rowNumber = parseInt(payload.rowNumber, 10);
    if (!rowNumber || rowNumber <= 1 || rowNumber > sheet.getLastRow()) {
      throw new Error('Invalid row number.');
    }

    const farmName = sheet.getRange(rowNumber, 2).getValue();
    sheet.getRange(rowNumber, 21).setValue('Deleted');
    sheet.getRange(rowNumber, 20).setValue(new Date());
    return { success: true, message: `ลบข้อมูลแปลง <b>${farmName}</b> แล้ว` };
  } catch (error) {
    return { success: false, message: friendlyError(error), detail: error.toString() };
  }
}

function getImageUploadFolder() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('IMAGE_FOLDER_ID');
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (error) {
      console.error('Invalid IMAGE_FOLDER_ID: ' + error.toString());
    }
  }

  const folder = DriveApp.createFolder('Smart Pineapple Uploads');
  props.setProperty('IMAGE_FOLDER_ID', folder.getId());
  return folder;
}

function saveImageToDrive(imageBase64, farmName) {
  if (!imageBase64) return { url: '', warning: '' };
  if (!imageBase64.startsWith('data:image')) {
    return { url: '', warning: 'ไม่ได้บันทึกรูป: รูปแบบไฟล์ไม่ถูกต้อง' };
  }

  try {
    const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return { url: '', warning: 'ไม่ได้บันทึกรูป: อ่านข้อมูลรูปภาพไม่ได้' };

    const mimeType = match[1];
    const extension = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const bytes = Utilities.base64Decode(match[2]);
    const safeFarmName = String(farmName || 'pineapple')
      .replace(/[\\/:*?"<>|]/g, '-')
      .slice(0, 80);
    const fileName = `${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')}-${safeFarmName}.${extension}`;
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const file = getImageUploadFolder().createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (error) {
      console.error('Drive sharing skipped: ' + error.toString());
    }

    return { url: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w600`, warning: '' };
  } catch (error) {
    console.error('Image upload skipped: ' + error.toString());
    return {
      url: imageBase64,
      warning: 'บันทึกข้อมูลแล้ว แต่ยังอัปโหลดรูปลง Google Drive ไม่สำเร็จ จึงเก็บรูปแบบ Base64 แทน: ' + friendlyError(error)
    };
  }
}

function getEmptyWeatherFeatures(source, message) {
  return {
    retrievedAt: new Date(),
    source: source || 'none',
    message: message || '',
    rain24hMm: null,
    rain72hMm: null,
    rain120hMm: null,
    humidityAvg: null,
    humidityMax: null,
    tempAvgC: null,
    tempMinC: null,
    tempMaxC: null,
    leafWetnessHours: null,
    heavyRainEvents: null,
    dryForecastSlots: null,
    weatherStressScore: null,
    droughtScore: null,
    diseaseWeatherScore: null,
    weatherImpactFactor: 1
  };
}

function getWeatherFeatures(lat, lon) {
  const OPENWEATHER_API_KEY = getOpenWeatherApiKey();
  if (!OPENWEATHER_API_KEY) {
    return getEmptyWeatherFeatures('missing_openweather_key', 'OPENWEATHER_API_KEY is not set');
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=th`;
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const statusCode = response.getResponseCode ? response.getResponseCode() : 200;
    const data = JSON.parse(response.getContentText());
    if (statusCode >= 400 || !data.list || !Array.isArray(data.list)) {
      return getEmptyWeatherFeatures('openweather_error', data.message || 'OpenWeather response has no forecast list');
    }

    const items = data.list.slice(0, 40);
    let rain24h = 0;
    let rain72h = 0;
    let rain120h = 0;
    let humiditySum = 0;
    let humidityCount = 0;
    let humidityMax = 0;
    let tempSum = 0;
    let tempCount = 0;
    let tempMin = null;
    let tempMax = null;
    let leafWetnessHours = 0;
    let heavyRainEvents = 0;
    let dryForecastSlots = 0;

    items.forEach((item, index) => {
      const rain = item.rain && item.rain['3h'] ? Number(item.rain['3h']) : 0;
      const humidity = item.main && item.main.humidity !== undefined ? Number(item.main.humidity) : null;
      const temp = item.main && item.main.temp !== undefined ? Number(item.main.temp) : null;

      if (index < 8) rain24h += rain;
      if (index < 24) rain72h += rain;
      rain120h += rain;

      if (humidity !== null && isFinite(humidity)) {
        humiditySum += humidity;
        humidityCount++;
        humidityMax = Math.max(humidityMax, humidity);
      }

      if (temp !== null && isFinite(temp)) {
        tempSum += temp;
        tempCount++;
        tempMin = tempMin === null ? temp : Math.min(tempMin, temp);
        tempMax = tempMax === null ? temp : Math.max(tempMax, temp);
      }

      if ((humidity !== null && humidity > 85) || rain > 0.5) leafWetnessHours += 3;
      if (rain > 5) heavyRainEvents++;
      if (rain < 0.1 && humidity !== null && humidity < 65) dryForecastSlots++;
    });

    const humidityAvg = humidityCount ? humiditySum / humidityCount : 0;
    const tempAvgC = tempCount ? tempSum / tempCount : 0;
    const droughtScore = Math.min(100, Math.round((dryForecastSlots / Math.max(items.length, 1)) * 100));
    const diseaseWeatherScore = Math.min(100, Math.round((leafWetnessHours * 1.6) + (heavyRainEvents * 10) + (rain72h * 0.7)));
    const weatherStressScore = Math.min(100, Math.round((Math.max(0, rain72h - 35) * 0.9) + (droughtScore * 0.35) + (Math.max(0, humidityAvg - 85) * 1.5)));

    let weatherImpactFactor = 1;
    if (diseaseWeatherScore >= 70) weatherImpactFactor -= 0.08;
    else if (diseaseWeatherScore >= 45) weatherImpactFactor -= 0.04;
    if (droughtScore >= 70) weatherImpactFactor -= 0.06;
    else if (droughtScore >= 45) weatherImpactFactor -= 0.03;
    if (rain72h >= 20 && rain72h <= 45 && droughtScore < 35) weatherImpactFactor += 0.02;
    weatherImpactFactor = Math.max(0.82, Math.min(1.05, weatherImpactFactor));

    return {
      retrievedAt: new Date(),
      source: 'openweather_forecast_5d_3h',
      message: '',
      rain24hMm: Number(rain24h.toFixed(2)),
      rain72hMm: Number(rain72h.toFixed(2)),
      rain120hMm: Number(rain120h.toFixed(2)),
      humidityAvg: Number(humidityAvg.toFixed(1)),
      humidityMax,
      tempAvgC: Number(tempAvgC.toFixed(1)),
      tempMinC: tempMin === null ? 0 : Number(tempMin.toFixed(1)),
      tempMaxC: tempMax === null ? 0 : Number(tempMax.toFixed(1)),
      leafWetnessHours,
      heavyRainEvents,
      dryForecastSlots,
      weatherStressScore,
      droughtScore,
      diseaseWeatherScore,
      weatherImpactFactor: Number(weatherImpactFactor.toFixed(3))
    };
  } catch (error) {
    return getEmptyWeatherFeatures('openweather_fetch_error', error.toString());
  }
}

function checkDiseaseRisk(lat, lon, soilDrainage, weatherFeatures) {
  const features = weatherFeatures || getWeatherFeatures(lat, lon);
  if (features.source === 'missing_openweather_key') {
    return {
      level: 'ไม่ทราบ',
      message: 'ยังไม่ได้ตั้งค่า OpenWeather API Key',
      heavyRainCount: 0,
      leafWetness: 0,
      normalizedRisk: 'Low'
    };
  }

  try {
    let heavyRainCount = features.heavyRainEvents || 0;
    let leafWetnessHours = features.leafWetnessHours || 0;

    let normalizedRisk = 'Low';
    let riskLevel = 'ความเสี่ยงต่ำ (Low)';
    let riskMessage = 'สภาพอากาศและแปลงปลูกปกติ';

    if (soilDrainage === 'poor') {
      if (heavyRainCount >= 1 || leafWetnessHours > 24) {
        normalizedRisk = 'High';
        riskLevel = 'ความเสี่ยงสูง (High)';
        riskMessage = 'ระวังโรครากเน่าเฉียบพลัน';
      } else {
        normalizedRisk = 'Medium';
        riskLevel = 'ความเสี่ยงปานกลาง (Medium)';
        riskMessage = 'เฝ้าระวังหากมีฝนตกเพิ่ม';
      }
    } else if (leafWetnessHours > 36 && heavyRainCount > 2) {
      normalizedRisk = 'High';
      riskLevel = 'ความเสี่ยงสูง (High)';
      riskMessage = 'ฝนตกชุก ระวังโรคยอดเน่า';
    } else if (leafWetnessHours > 24 || heavyRainCount >= 1) {
      normalizedRisk = 'Medium';
      riskLevel = 'ความเสี่ยงปานกลาง (Medium)';
      riskMessage = 'มีความชื้นสะสม เฝ้าระวังการเกิดเชื้อรา';
    }

    return {
      level: riskLevel,
      message: riskMessage,
      heavyRainCount,
      leafWetness: leafWetnessHours,
      normalizedRisk
    };
  } catch (error) {
    return {
      level: 'Weather Error',
      message: 'ไม่สามารถดึงข้อมูลสภาพอากาศได้',
      heavyRainCount: 0,
      leafWetness: 0,
      normalizedRisk: 'Low'
    };
  }
}

function classifyDiseaseML(formObj, weatherFeatures, riskData, drainageScore, aiLabel, aiConfidence, mlFeatures) {
  const reasons = [];
  const soilDrainage = String(formObj.soilDrainage || '').toLowerCase();
  const diseaseObserved = String(formObj.diseaseObserved || '').trim();

  let drainageScoreRisk = 20;
  if (soilDrainage === 'poor') drainageScoreRisk = 90;
  else if (soilDrainage === 'moderate') drainageScoreRisk = 55;
  if (drainageScore !== '' && isFinite(Number(drainageScore))) {
    drainageScoreRisk = Math.max(drainageScoreRisk, Math.round((6 - Number(drainageScore)) * 18));
  }

  const weatherScore = Number(weatherFeatures.diseaseWeatherScore || 0);
  const droughtScore = Number(weatherFeatures.droughtScore || 0);
  const rain72h = Number(weatherFeatures.rain72hMm || 0);
  const leafWetness = Number(weatherFeatures.leafWetnessHours || 0);
  const humidityAvg = Number(weatherFeatures.humidityAvg || 0);

  if (rain72h >= 35) reasons.push(`rain72h ${rain72h}mm`);
  if (leafWetness >= 24) reasons.push(`leaf wetness ${leafWetness}h`);
  if (humidityAvg >= 85) reasons.push(`humidity avg ${humidityAvg}%`);
  if (drainageScoreRisk >= 70) reasons.push('poor drainage condition');

  const riskFloor = riskData.normalizedRisk === 'High' ? 0.18 : riskData.normalizedRisk === 'Medium' ? 0.08 : 0;
  const heuristicProbabilities = {
    'Root/Crown Rot Risk': clamp(
      0.03 +
      (drainageScoreRisk / 100 * 0.42) +
      (Math.min(rain72h, 80) / 80 * 0.24) +
      (Math.min(leafWetness, 72) / 72 * 0.18) +
      riskFloor,
      0.02,
      0.95
    ),
    'Fungal Spot/Leaf Disease Risk': clamp(
      0.03 +
      (Math.min(weatherScore, 100) / 100 * 0.36) +
      (Math.min(humidityAvg, 100) / 100 * 0.24) +
      (Math.min(leafWetness, 72) / 72 * 0.28) +
      riskFloor,
      0.02,
      0.95
    )
  };

  const trainedPrediction = predictDiseaseML(mlFeatures || {});
  const mlWeight = trainedPrediction.available ? trainedPrediction.mlWeight : 0;
  const probabilities = {};
  DISEASE_TARGET_LABELS.forEach(label => {
    const heuristicProbability = heuristicProbabilities[label] || 0;
    const trainedProbability = trainedPrediction.probabilities
      ? Number(trainedPrediction.probabilities[label] || 0)
      : heuristicProbability;
    probabilities[label] = clamp(
      (heuristicProbability * (1 - mlWeight)) + (trainedProbability * mlWeight),
      0,
      1
    );
  });

  const rootProbability = probabilities['Root/Crown Rot Risk'] || 0;
  const fungalProbability = probabilities['Fungal Spot/Leaf Disease Risk'] || 0;
  probabilities['Low Disease Risk'] = clamp((1 - rootProbability) * (1 - fungalProbability), 0, 1);

  const positiveClasses = DISEASE_TARGET_LABELS.filter(label => probabilities[label] >= 0.5);
  const rankedDiseaseClasses = DISEASE_TARGET_LABELS
    .map(label => ({ label, probability: probabilities[label] }))
    .sort((a, b) => b.probability - a.probability);
  const topDisease = rankedDiseaseClasses[0];
  const secondDisease = rankedDiseaseClasses[1];
  const probabilityMargin = topDisease.probability - secondDisease.probability;

  let predictedClass = 'Low Disease Risk';
  if (positiveClasses.length) predictedClass = positiveClasses.join(' + ');
  else if (
    topDisease.probability >= 0.35 ||
    (topDisease.probability >= 0.25 && probabilityMargin < 0.12)
  ) {
    predictedClass = 'Insufficient confidence';
  }

  const riskScore = Math.round(clamp(
    100 * ((rootProbability * 0.9) + (fungalProbability * 0.7)),
    0,
    100
  ));
  const probability = Math.round(Math.max(
    probabilities['Low Disease Risk'],
    rootProbability,
    fungalProbability
  ) * 100);
  const severity = riskScore >= 85 ? 5 : riskScore >= 70 ? 4 : riskScore >= 50 ? 3 : riskScore >= 30 ? 2 : riskScore >= 15 ? 1 : 0;
  const action = recommendedDiseaseAction(predictedClass);

  if (trainedPrediction.available) {
    reasons.unshift(`trained model ${trainedPrediction.version}; blend ${Math.round(mlWeight * 100)}%`);
  }

  return {
    version: trainedPrediction.available ? trainedPrediction.version + '+probability-blend-v3' : 'pineapple-disease-rules-v3',
    predictedClass,
    riskScore,
    probability,
    severity,
    reasons: reasons.slice(0, 5).join('; '),
    action,
    trainingLabel: diseaseObserved,
    probabilities,
    droughtRisk: Math.round(clamp(droughtScore, 0, 100))
  };
}

function trainMLModels() {
  try {
    const sheet = getDataSheet();
    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, FARM_HEADERS.length).getValues() : [];
    const yieldResult = trainYieldModel(rows);
    const diseaseResult = trainDiseaseModel(rows);
    const status = getMLModelStatus();
    return {
      success: true,
      message: 'ML training completed.',
      yieldModel: yieldResult,
      diseaseModel: diseaseResult,
      status: status.data
    };
  } catch (error) {
    return { success: false, message: friendlyError(error), detail: error.toString() };
  }
}

function getMLModelStatus() {
  const yieldModel = loadStoredModel(YIELD_MODEL_KEY);
  const diseaseModel = loadStoredModel(DISEASE_MODEL_KEY);
  const yieldChallenger = loadStoredModel(YIELD_CHALLENGER_MODEL_KEY);
  const diseaseChallenger = loadStoredModel(DISEASE_CHALLENGER_MODEL_KEY);
  return {
    success: true,
    data: {
      featureVersion: ML_FEATURE_VERSION,
      yield: yieldModel ? modelSummary(yieldModel) : { trained: false },
      disease: diseaseModel ? modelSummary(diseaseModel) : { trained: false },
      yieldChallenger: yieldChallenger ? modelSummary(yieldChallenger) : { trained: false },
      diseaseChallenger: diseaseChallenger ? modelSummary(diseaseChallenger) : { trained: false }
    }
  };
}

function trainYieldModel(rows) {
  const samples = [];
  let excludedLowQuality = 0;
  let excludedTemporalLeakage = 0;
  rows.forEach(row => {
    if (String(row[20] || 'Active') === 'Deleted') return;
    const actualYieldTon = toNumber(row[28], NaN);
    const harvestedAreaRai = toNumber(row[66], toNumber(row[2], 0));
    if (!isFinite(actualYieldTon) || actualYieldTon < 0 || harvestedAreaRai <= 0) return;
    const predictionAt = parseSheetDate(row[64] || row[0]);
    const outcomeAt = parseSheetDate(row[65]);
    const elapsedDays = predictionAt && outcomeAt
      ? (outcomeAt.getTime() - predictionAt.getTime()) / 86400000
      : -1;
    if (elapsedDays < 7) {
      excludedTemporalLeakage++;
      return;
    }
    const features = buildMlFeatureObjectFromRow(row);
    if (features.weatherDataQuality < 0.6) {
      excludedLowQuality++;
      return;
    }
    samples.push({
      x: vectorizeFeatures(features, YIELD_FEATURE_NAMES),
      y: actualYieldTon / harvestedAreaRai,
      group: String(row[1] || `row-${samples.length}`),
      observedAt: parseSheetDate(row[65] || row[27] || row[0])
    });
  });

  const groupCount = uniqueValues(samples.map(sample => sample.group)).length;
  if (samples.length < 20 || groupCount < 3) {
    return {
      trained: false,
      sampleCount: samples.length,
      groupCount,
      excludedLowQuality,
      excludedTemporalLeakage,
      message: 'Need at least 20 outcome rows from 3 farms/groups, with outcomes recorded at least 7 days after prediction.'
    };
  }

  const cv = crossValidateYield(samples);
  const model = fitLinearRegression(samples, 'pineapple-yield-elastic-net-v3', YIELD_FEATURE_NAMES);
  model.cvRmse = cv.rmse;
  model.cvMae = cv.mae;
  model.cvFoldCount = cv.foldCount;
  model.cvSampleCount = cv.sampleCount;
  model.conformalError90 = cv.conformalError90;
  model.groupCount = groupCount;
  model.excludedLowQuality = excludedLowQuality;
  model.excludedTemporalLeakage = excludedTemporalLeakage;
  return registerModelCandidate(model, {
    championKey: YIELD_MODEL_KEY,
    challengerKey: YIELD_CHALLENGER_MODEL_KEY,
    metric: 'cvRmse',
    lowerIsBetter: true,
    minimumImprovement: 0.01,
    promotionEligible: samples.length >= 50 && groupCount >= 5
  });
}

function trainDiseaseModel(rows) {
  const samples = [];
  let excludedLowQuality = 0;
  let excludedTemporalLeakage = 0;
  rows.forEach(row => {
    if (String(row[20] || 'Active') === 'Deleted') return;
    const observedLabels = parseDiseaseLabels(row[56] || row[31]);
    if (!observedLabels.length) return;
    const predictionAt = parseSheetDate(row[64] || row[0]);
    const outcomeAt = parseSheetDate(row[65]);
    const elapsedDays = predictionAt && outcomeAt
      ? (outcomeAt.getTime() - predictionAt.getTime()) / 86400000
      : -1;
    if (elapsedDays < 1) {
      excludedTemporalLeakage++;
      return;
    }
    const features = buildMlFeatureObjectFromRow(row);
    if (features.weatherDataQuality < 0.6) {
      excludedLowQuality++;
      return;
    }
    samples.push({
      x: vectorizeFeatures(features, DISEASE_FEATURE_NAMES),
      targets: DISEASE_TARGET_LABELS.reduce((result, label) => {
        result[label] = observedLabels.includes(label) ? 1 : 0;
        return result;
      }, {}),
      group: String(row[1] || `row-${samples.length}`),
      observedAt: parseSheetDate(row[65] || row[27] || row[0])
    });
  });

  const targetCounts = {};
  const eligibleTargets = DISEASE_TARGET_LABELS.filter(label => {
    const positive = samples.filter(sample => sample.targets[label] === 1).length;
    const negative = samples.length - positive;
    targetCounts[label] = { positive, negative };
    return positive >= 10 && negative >= 10;
  });
  const groupCount = uniqueValues(samples.map(sample => sample.group)).length;
  if (samples.length < 20 || groupCount < 3 || !eligibleTargets.length) {
    return {
      trained: false,
      sampleCount: samples.length,
      classCount: eligibleTargets.length,
      targetCounts,
      groupCount,
      excludedLowQuality,
      excludedTemporalLeakage,
      message: 'Need at least 20 labeled rows from 3 farms/groups, with disease outcomes recorded after prediction.'
    };
  }

  const cv = crossValidateDisease(samples, eligibleTargets);
  const model = fitMultiLabelLogistic(samples, eligibleTargets, 'pineapple-disease-logistic-ovr-v3', DISEASE_FEATURE_NAMES);
  model.cvMacroF1 = cv.macroF1;
  model.cvBalancedAccuracy = cv.balancedAccuracy;
  model.cvFoldCount = cv.foldCount;
  model.cvSampleCount = cv.sampleCount;
  model.targetCounts = targetCounts;
  model.groupCount = groupCount;
  model.excludedLowQuality = excludedLowQuality;
  model.excludedTemporalLeakage = excludedTemporalLeakage;
  return registerModelCandidate(model, {
    championKey: DISEASE_MODEL_KEY,
    challengerKey: DISEASE_CHALLENGER_MODEL_KEY,
    metric: 'cvMacroF1',
    lowerIsBetter: false,
    minimumImprovement: 0.5,
    promotionEligible: eligibleTargets.length === DISEASE_TARGET_LABELS.length && samples.length >= 50 && groupCount >= 5
  });
}

function fitLinearRegression(samples, version, featureNames) {
  const dimension = featureNames.length;
  const stats = featureStats(samples.map(sample => sample.x), dimension);
  const weights = Array(dimension).fill(0);
  let intercept = average(samples.map(sample => sample.y));
  const learningRate = 0.025;
  const ridge = 0.003;
  const lasso = 0.0008;
  const epochs = 700;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let interceptGrad = 0;
    const weightGrad = Array(dimension).fill(0);
    samples.forEach(sample => {
      const x = standardizeVector(sample.x, stats);
      const pred = intercept + dot(weights, x);
      const error = pred - sample.y;
      interceptGrad += error;
      for (let i = 0; i < dimension; i++) weightGrad[i] += error * x[i] + ridge * weights[i];
    });
    intercept -= learningRate * interceptGrad / samples.length;
    for (let i = 0; i < dimension; i++) {
      const updated = weights[i] - (learningRate * weightGrad[i] / samples.length);
      weights[i] = Math.sign(updated) * Math.max(0, Math.abs(updated) - (learningRate * lasso));
    }
  }

  const errors = samples.map(sample => {
    const pred = intercept + dot(weights, standardizeVector(sample.x, stats));
    return pred - sample.y;
  });
  const rmse = Math.sqrt(average(errors.map(error => error * error)));
  const mae = average(errors.map(error => Math.abs(error)));

  return {
    trained: true,
    version,
    featureVersion: ML_FEATURE_VERSION,
    trainedAt: new Date().toISOString(),
    sampleCount: samples.length,
    featureNames,
    stats,
    weights,
    intercept,
    rmse,
    mae
  };
}

function fitMultiLabelLogistic(samples, targetLabels, version, featureNames) {
  const dimension = featureNames.length;
  const stats = featureStats(samples.map(sample => sample.x), dimension);
  const standardizedRows = samples.map(sample => standardizeVector(sample.x, stats));
  const binaryModels = {};
  targetLabels.forEach(label => {
    binaryModels[label] = fitBinaryLogistic(
      standardizedRows,
      samples.map(sample => Number(sample.targets[label] || 0))
    );
  });

  const metrics = evaluateMultiLabelPredictions(
    samples,
    samples.map(sample => predictMultiLabelProbabilities(sample.x, { stats, binaryModels }, targetLabels)),
    targetLabels
  );
  return {
    trained: true,
    version,
    featureVersion: ML_FEATURE_VERSION,
    trainedAt: new Date().toISOString(),
    sampleCount: samples.length,
    classCount: targetLabels.length,
    featureNames,
    targetLabels,
    stats,
    binaryModels,
    trainingMacroF1: metrics.macroF1,
    trainingBalancedAccuracy: metrics.balancedAccuracy
  };
}

function fitBinaryLogistic(vectors, targets) {
  const dimension = vectors[0] ? vectors[0].length : 0;
  const weights = Array(dimension).fill(0);
  const positiveCount = targets.filter(value => value === 1).length;
  const negativeCount = Math.max(1, targets.length - positiveCount);
  const positiveWeight = targets.length / Math.max(2 * positiveCount, 1);
  const negativeWeight = targets.length / Math.max(2 * negativeCount, 1);
  let intercept = Math.log((positiveCount + 1) / (negativeCount + 1));
  const learningRate = 0.035;
  const l2 = 0.012;

  for (let epoch = 0; epoch < 800; epoch++) {
    let interceptGradient = 0;
    const gradients = Array(dimension).fill(0);
    vectors.forEach((vector, index) => {
      const target = targets[index];
      const sampleWeight = target === 1 ? positiveWeight : negativeWeight;
      const probability = sigmoid(intercept + dot(weights, vector));
      const error = (probability - target) * sampleWeight;
      interceptGradient += error;
      for (let i = 0; i < dimension; i++) {
        gradients[i] += (error * vector[i]) + (l2 * weights[i]);
      }
    });
    intercept -= learningRate * interceptGradient / vectors.length;
    for (let i = 0; i < dimension; i++) {
      weights[i] -= learningRate * gradients[i] / vectors.length;
    }
  }
  return { weights, intercept, positiveCount, negativeCount };
}

function predictMultiLabelProbabilities(vector, model, targetLabels) {
  const standardized = standardizeVector(vector, model.stats);
  return targetLabels.reduce((result, label) => {
    const binaryModel = model.binaryModels[label];
    result[label] = binaryModel
      ? sigmoid(binaryModel.intercept + dot(binaryModel.weights, standardized))
      : 0;
    return result;
  }, {});
}

function crossValidateYield(samples) {
  const groups = uniqueValues(samples.map(sample => sample.group));
  const foldCount = Math.min(5, groups.length);
  const groupFolds = {};
  groups.sort().forEach((group, index) => {
    groupFolds[group] = index % foldCount;
  });
  const errors = [];
  for (let fold = 0; fold < foldCount; fold++) {
    const training = samples.filter(sample => groupFolds[sample.group] !== fold);
    const testing = samples.filter(sample => groupFolds[sample.group] === fold);
    if (training.length < 10 || !testing.length) continue;
    const model = fitLinearRegression(training, 'cv-yield', YIELD_FEATURE_NAMES);
    testing.forEach(sample => {
      const prediction = model.intercept + dot(model.weights, standardizeVector(sample.x, model.stats));
      errors.push(prediction - sample.y);
    });
  }
  return {
    foldCount,
    sampleCount: errors.length,
    rmse: errors.length ? Math.sqrt(average(errors.map(error => error * error))) : null,
    mae: errors.length ? average(errors.map(error => Math.abs(error))) : null,
    conformalError90: errors.length ? quantile(errors.map(error => Math.abs(error)), 0.9) : null
  };
}

function crossValidateDisease(samples, targetLabels) {
  const groups = uniqueValues(samples.map(sample => sample.group));
  const foldCount = Math.min(5, groups.length);
  const groupFolds = {};
  groups.sort().forEach((group, index) => {
    groupFolds[group] = index % foldCount;
  });
  const testedSamples = [];
  const predictions = [];
  for (let fold = 0; fold < foldCount; fold++) {
    const training = samples.filter(sample => groupFolds[sample.group] !== fold);
    const testing = samples.filter(sample => groupFolds[sample.group] === fold);
    if (training.length < 10 || !testing.length) continue;
    const model = fitMultiLabelLogistic(training, targetLabels, 'cv-disease', DISEASE_FEATURE_NAMES);
    testing.forEach(sample => {
      testedSamples.push(sample);
      predictions.push(predictMultiLabelProbabilities(sample.x, model, targetLabels));
    });
  }
  const metrics = evaluateMultiLabelPredictions(testedSamples, predictions, targetLabels);
  metrics.foldCount = foldCount;
  metrics.sampleCount = testedSamples.length;
  return metrics;
}

function evaluateMultiLabelPredictions(samples, predictions, targetLabels) {
  const perTarget = {};
  targetLabels.forEach(label => {
    let truePositive = 0;
    let trueNegative = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    samples.forEach((sample, index) => {
      const actual = Number(sample.targets[label] || 0);
      const predicted = Number((predictions[index] || {})[label] || 0) >= 0.5 ? 1 : 0;
      if (actual === 1 && predicted === 1) truePositive++;
      else if (actual === 0 && predicted === 0) trueNegative++;
      else if (actual === 0 && predicted === 1) falsePositive++;
      else falseNegative++;
    });
    const precision = truePositive / Math.max(truePositive + falsePositive, 1);
    const recall = truePositive / Math.max(truePositive + falseNegative, 1);
    const specificity = trueNegative / Math.max(trueNegative + falsePositive, 1);
    perTarget[label] = {
      precision,
      recall,
      specificity,
      f1: (2 * precision * recall) / Math.max(precision + recall, 0.000001),
      balancedAccuracy: (recall + specificity) / 2,
      support: truePositive + falseNegative
    };
  });
  const rows = Object.keys(perTarget).map(label => perTarget[label]);
  return {
    macroF1: rows.length ? Math.round(average(rows.map(row => row.f1)) * 1000) / 10 : null,
    balancedAccuracy: rows.length ? Math.round(average(rows.map(row => row.balancedAccuracy)) * 1000) / 10 : null,
    perTarget
  };
}

function registerModelCandidate(model, options) {
  const properties = PropertiesService.getScriptProperties();
  const champion = loadStoredModel(options.championKey);

  const candidateMetric = model[options.metric];
  const championMetric = champion ? champion[options.metric] : null;
  const comparableChampion = champion &&
    champion.trained &&
    champion.featureVersion === ML_FEATURE_VERSION &&
    championMetric !== null &&
    championMetric !== undefined &&
    isFinite(Number(championMetric));
  const validCandidateMetric = candidateMetric !== null &&
    candidateMetric !== undefined &&
    isFinite(Number(candidateMetric));
  const promotionEligible = options.promotionEligible !== false;
  let promoted = !comparableChampion && validCandidateMetric && promotionEligible;
  let promotionReason = promoted
    ? 'No comparable champion exists for the current feature version.'
    : 'Champion kept after cross-validation comparison.';

  if (!promotionEligible) {
    promotionReason = 'Challenger was not promoted because the production sample/group threshold is not met.';
  } else if (comparableChampion && validCandidateMetric) {
    const minimumImprovement = Math.max(0, Number(options.minimumImprovement || 0));
    promoted = options.lowerIsBetter
      ? Number(candidateMetric) <= Number(championMetric) - minimumImprovement
      : Number(candidateMetric) >= Number(championMetric) + minimumImprovement;
    promotionReason = promoted
      ? 'Challenger improved the out-of-sample metric.'
      : `Challenger did not improve the out-of-sample metric by the required margin (${minimumImprovement}).`;
  } else if (!validCandidateMetric) {
    promotionReason = 'Challenger was not promoted because cross-validation produced no valid metric.';
  }

  model.promoted = promoted;
  model.promotionReason = promotionReason;
  properties.setProperty(options.challengerKey, JSON.stringify(model));
  if (promoted) properties.setProperty(options.championKey, JSON.stringify(model));
  const summary = modelSummary(model);
  summary.promoted = promoted;
  summary.promotionReason = promotionReason;
  summary.championVersion = promoted ? model.version : (champion ? champion.version : '');
  summary.championMetric = promoted ? candidateMetric : championMetric;
  return summary;
}

function predictYieldML(features, areaRai, fallbackTon) {
  const model = loadStoredModel(YIELD_MODEL_KEY);
  if (!model || !model.trained || model.featureVersion !== ML_FEATURE_VERSION) {
    return { available: false, version: '' };
  }
  const x = standardizeVector(vectorizeFeatures(features, model.featureNames), model.stats);
  const predPerRai = Math.max(0.1, Math.min(20, model.intercept + dot(model.weights, x)));
  const rawPredictionTon = Math.max(0, predPerRai * Math.max(0, Number(areaRai) || 0));
  const cvError = model.cvRmse !== null && model.cvRmse !== undefined && isFinite(Number(model.cvRmse))
    ? Number(model.cvRmse)
    : Number(model.rmse || 0.5);
  const errorReliability = clamp(1 - (cvError / Math.max(predPerRai, 0.1)), 0.2, 1);
  const sampleReliability = clamp(Number(model.sampleCount || 0) / 100, 0.15, 1);
  const qualityReliability = clamp(Number(features.weatherDataQuality || 0), 0, 1);
  const mlWeight = clamp(0.15 + (0.65 * errorReliability * sampleReliability * qualityReliability), 0.15, 0.8);
  const baselineTon = Math.max(0, Number(fallbackTon) || 0);
  const blendedPredictionTon = (baselineTon * (1 - mlWeight)) + (rawPredictionTon * mlWeight);
  const conformalError = model.conformalError90 !== null && model.conformalError90 !== undefined
    ? Number(model.conformalError90)
    : Math.max(cvError, 0.1) * 1.64;
  const interval = (Math.max(conformalError, 0.1) * Math.max(1, Number(areaRai) || 1)) +
    (Math.abs(rawPredictionTon - baselineTon) * (1 - mlWeight));
  const confidence = Math.round(mlWeight * 100);
  return {
    available: true,
    version: model.version + '+blend-v2',
    rawPredictionTon,
    blendedPredictionTon,
    mlWeight: Math.round(mlWeight * 1000) / 1000,
    confidence,
    lowTon: Math.max(0, blendedPredictionTon - interval),
    highTon: blendedPredictionTon + interval,
    fallbackTon
  };
}

function predictDiseaseML(features) {
  const model = loadStoredModel(DISEASE_MODEL_KEY);
  if (!model || !model.trained || model.featureVersion !== ML_FEATURE_VERSION) {
    return { available: false };
  }
  const vector = vectorizeFeatures(features, model.featureNames);
  const probabilities = predictMultiLabelProbabilities(vector, model, model.targetLabels || DISEASE_TARGET_LABELS);
  const accuracyMetric = model.cvMacroF1 !== null && model.cvMacroF1 !== undefined
    ? model.cvMacroF1
    : (model.trainingMacroF1 || 0);
  const cvReliability = clamp(Number(accuracyMetric) / 100, 0.15, 1);
  const sampleReliability = clamp(Number(model.sampleCount || 0) / 100, 0.15, 1);
  const qualityReliability = clamp(Number(features.weatherDataQuality || 0), 0, 1);
  const mlWeight = clamp(0.15 + (0.65 * cvReliability * sampleReliability * qualityReliability), 0.15, 0.8);
  return {
    available: true,
    version: model.version,
    probabilities,
    mlWeight,
  };
}

function buildMlFeatureObjectFromRow(row) {
  const plantingDate = parseSheetDate(row[5]);
  const forcingDate = parseSheetDate(row[6]);
  const harvestDate = parseSheetDate(row[8]);
  return buildMlFeatureObject({
    areaRai: row[2],
    plantDensity: row[22],
    drainageScore: row[25],
    predictedWeightKg: row[10],
    predictedBrix: row[12],
    soilDrainage: row[7],
    variety: row[21],
    irrigation: row[24],
    plantingDate,
    forcingDate,
    harvestDate,
    aiConfidence: row[18],
    weatherFeatures: {
      source: row[33],
      rain24hMm: row[34],
      rain72hMm: row[35],
      rain120hMm: row[36],
      humidityAvg: row[37],
      humidityMax: row[38],
      tempAvgC: row[39],
      tempMinC: row[40],
      tempMaxC: row[41],
      leafWetnessHours: row[42],
      heavyRainEvents: row[43],
      dryForecastSlots: row[44],
      weatherStressScore: row[45],
      droughtScore: row[46],
      diseaseWeatherScore: row[47],
      weatherImpactFactor: row[48]
    }
  });
}

function buildMlFeatureObject(input) {
  const weather = input.weatherFeatures || {};
  const plantingDate = input.plantingDate instanceof Date ? input.plantingDate : parseSheetDate(input.plantingDate);
  const forcingDate = input.forcingDate instanceof Date ? input.forcingDate : parseSheetDate(input.forcingDate);
  const harvestDate = input.harvestDate instanceof Date ? input.harvestDate : parseSheetDate(input.harvestDate);
  const criticalWeatherValues = [
    optionalNumber(weather.rain72hMm),
    optionalNumber(weather.humidityAvg),
    optionalNumber(weather.leafWetnessHours),
    optionalNumber(weather.weatherStressScore),
    optionalNumber(weather.diseaseWeatherScore)
  ];
  const validWeatherCount = criticalWeatherValues.filter(value => value !== null).length;
  const source = String(weather.source || '');
  const sourceFailed = source && source !== 'openweather_forecast_5d_3h';
  const weatherDataQuality = sourceFailed ? 0 : validWeatherCount / criticalWeatherValues.length;
  return {
    areaRai: toNumber(input.areaRai, 0),
    plantDensity: toNumber(input.plantDensity, 7000),
    drainageScore: toNumber(input.drainageScore, 3),
    predictedWeightKg: toNumber(input.predictedWeightKg, 1.35),
    predictedBrix: toNumber(input.predictedBrix, 12.5),
    rain24hMm: optionalNumber(weather.rain24hMm),
    rain72hMm: optionalNumber(weather.rain72hMm),
    rain120hMm: optionalNumber(weather.rain120hMm),
    humidityAvg: optionalNumber(weather.humidityAvg),
    humidityMax: optionalNumber(weather.humidityMax),
    tempAvgC: optionalNumber(weather.tempAvgC),
    tempMinC: optionalNumber(weather.tempMinC),
    tempMaxC: optionalNumber(weather.tempMaxC),
    leafWetnessHours: optionalNumber(weather.leafWetnessHours),
    heavyRainEvents: optionalNumber(weather.heavyRainEvents),
    dryForecastSlots: optionalNumber(weather.dryForecastSlots),
    weatherStressScore: optionalNumber(weather.weatherStressScore),
    droughtScore: optionalNumber(weather.droughtScore),
    diseaseWeatherScore: optionalNumber(weather.diseaseWeatherScore),
    weatherImpactFactor: optionalNumber(weather.weatherImpactFactor),
    soilDrainageCode: encodeDrainage(input.soilDrainage),
    varietyCode: encodeVariety(input.variety),
    irrigationCode: encodeIrrigation(input.irrigation),
    daysPlantingToForcing: daysBetween(plantingDate, forcingDate, 300),
    daysForcingToHarvest: daysBetween(forcingDate, harvestDate, 150),
    harvestMonth: harvestDate ? harvestDate.getMonth() + 1 : 0,
    aiConfidence: optionalNumber(input.aiConfidence),
    weatherMissingCount: criticalWeatherValues.length - validWeatherCount,
    weatherDataQuality
  };
}

function vectorizeFeatures(features, featureNames) {
  return featureNames.map(name => optionalNumber(features[name]));
}

function loadStoredModel(key) {
  const raw = PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function modelSummary(model) {
  if (!model || !model.trained) return { trained: false };
  return {
    trained: true,
    version: model.version,
    trainedAt: model.trainedAt,
    sampleCount: model.sampleCount,
    featureVersion: model.featureVersion,
    rmse: model.rmse === undefined ? undefined : Math.round(model.rmse * 1000) / 1000,
    mae: model.mae === undefined ? undefined : Math.round(model.mae * 1000) / 1000,
    cvRmse: model.cvRmse === null || model.cvRmse === undefined ? undefined : Math.round(model.cvRmse * 1000) / 1000,
    cvMae: model.cvMae === null || model.cvMae === undefined ? undefined : Math.round(model.cvMae * 1000) / 1000,
    conformalError90: model.conformalError90,
    cvMacroF1: model.cvMacroF1,
    cvBalancedAccuracy: model.cvBalancedAccuracy,
    cvFoldCount: model.cvFoldCount,
    cvSampleCount: model.cvSampleCount,
    classCount: model.classCount,
    trainingMacroF1: model.trainingMacroF1,
    trainingBalancedAccuracy: model.trainingBalancedAccuracy,
    targetCounts: model.targetCounts,
    groupCount: model.groupCount,
    excludedLowQuality: model.excludedLowQuality || 0,
    excludedTemporalLeakage: model.excludedTemporalLeakage || 0,
    promoted: model.promoted,
    promotionReason: model.promotionReason
  };
}

function featureStats(vectors, dimension) {
  const means = [];
  const stds = [];
  for (let i = 0; i < dimension; i++) {
    const values = vectors
      .map(vector => optionalNumber(vector[i]))
      .filter(value => value !== null);
    const mean = average(values);
    const variance = average(values.map(value => Math.pow(value - mean, 2)));
    means.push(mean);
    stds.push(Math.sqrt(variance) || 1);
  }
  return { means, stds };
}

function standardizeVector(vector, stats) {
  return vector.map((value, index) => {
    const number = optionalNumber(value);
    const imputed = number === null ? stats.means[index] : number;
    return (imputed - stats.means[index]) / (stats.stds[index] || 1);
  });
}

function meanVector(vectors, dimension) {
  if (!vectors.length) return Array(dimension).fill(0);
  return Array.from({ length: dimension }, (_, index) => average(vectors.map(vector => vector[index])));
}

function dot(a, b) {
  return a.reduce((sum, value, index) => sum + value * (b[index] || 0), 0);
}

function average(values) {
  const clean = values.filter(value => isFinite(Number(value))).map(Number);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function quantile(values, probability) {
  const sorted = values.filter(value => isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(probability * sorted.length) - 1));
  return sorted[index];
}

function uniqueValues(values) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function parseJsonObject(value) {
  if (!value) return {};
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function toNumber(value, fallback) {
  const number = Number(value);
  return isFinite(number) ? number : fallback;
}

function optionalNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return isFinite(number) ? number : null;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value)));
}

function parseSheetDate(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const parts = String(value).split('/');
  if (parts.length === 3) {
    const date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    if (!isNaN(date.getTime())) return date;
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function daysBetween(start, end, fallback) {
  if (!start || !end) return fallback;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function encodeDrainage(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('poor') || text.includes('แย่') || text.includes('เนเธข')) return 0;
  if (text.includes('moderate') || text.includes('ปาน') || text.includes('เธเธฒเธ')) return 1;
  if (text.includes('good') || text.includes('ดี') || text.includes('เธ”เธต')) return 2;
  return 1;
}

function encodeVariety(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('md2')) return 3;
  if (text.includes('queen') || text.includes('ภูแล') || text.includes('เธ เธน')) return 2;
  if (text.includes('pattavia') || text.includes('ปัตตา') || text.includes('เธเธฑเธ•')) return 1;
  return 0;
}

function encodeIrrigation(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('drip') || text.includes('หยด') || text.includes('เธซเธข')) return 3;
  if (text.includes('sprinkler') || text.includes('สปริง') || text.includes('rain')) return 2;
  if (text.includes('none') || text.includes('ไม่มี') || text.includes('เนเธก')) return 0;
  return 1;
}

function normalizeDiseaseLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower === 'none' || lower === 'no' || lower === 'unknown' || lower === '-') return '';
  if (lower.includes('root') || lower.includes('crown') || lower.includes('ราก') || lower.includes('ยอด')) return 'Root/Crown Rot Risk';
  if (lower.includes('spot') || lower.includes('leaf') || lower.includes('fung') || lower.includes('จุด') || lower.includes('ใบ')) return 'Fungal Spot/Leaf Disease Risk';
  if (lower.includes('drought') || lower.includes('dry') || lower.includes('แล้ง')) return 'Drought Stress Risk';
  if (lower.includes('low') || lower.includes('healthy') || lower.includes('normal') || lower.includes('ปกติ')) return 'Low Disease Risk';
  return text;
}

function parseDiseaseLabels(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  const normalized = text
    .split(/[,+;|]/)
    .map(item => normalizeDiseaseLabel(item))
    .filter(Boolean);
  const positiveLabels = uniqueValues(
    normalized.filter(label => DISEASE_TARGET_LABELS.includes(label))
  );
  if (positiveLabels.length) return positiveLabels;
  return normalized.includes('Low Disease Risk') ? ['Low Disease Risk'] : [];
}

function recommendedDiseaseAction(label) {
  const text = String(label || '').toLowerCase();
  if (text.includes('insufficient')) return 'ถ่ายภาพและสำรวจอาการซ้ำภายใน 24-48 ชั่วโมงก่อนตัดสินใจจัดการโรค';
  if ((text.includes('root') || text.includes('crown')) && (text.includes('fungal') || text.includes('spot') || text.includes('leaf'))) {
    return 'ตรวจโคน/รากและใบพร้อมกันภายใน 48 ชั่วโมง ปรับการระบายน้ำและลดความชื้นสะสม';
  }
  if (text.includes('root') || text.includes('crown')) return 'Inspect crown/root zone within 48 hours and improve drainage.';
  if (text.includes('fungal') || text.includes('spot') || text.includes('leaf')) return 'Scout leaves/fruits for spots and reduce humidity accumulation.';
  if (text.includes('drought')) return 'Check soil moisture and schedule supplemental irrigation.';
  return 'Continue routine monitoring and capture a new reference image.';
}

function sigmoid(value) {
  const bounded = clamp(value, -35, 35);
  return 1 / (1 + Math.exp(-bounded));
}

function getDashboardData() {
  try {
    const sheet = getDataSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { success: true, data: emptyDashboard() };
    }

    const data = sheet.getRange(2, 1, lastRow - 1, FARM_HEADERS.length).getValues();
    const dashboard = emptyDashboard();

    data.forEach((row, index) => {
      const status = String(row[20] || 'Active');
      if (status === 'Deleted') return;
      if (!row[1]) return;

      const farmName = String(row[1] || '');
      const area = parseFloat(row[2]) || 0;
      const lat = parseFloat(row[3]);
      const lng = parseFloat(row[4]);
      const harvestDateStr = row[8];
      const yieldTon = parseFloat(row[9]) || 0;
      const weight = parseFloat(row[10]) || 0;
      const gradeStr = String(row[11] || '');
      const brix = parseFloat(row[12]) || 0;
      const riskStr = String(row[13] || '');
      const aiStr = String(row[15] || '');
      const photoUrl = String(row[16] || '');
      const aiLabel = String(row[17] || '');
      const aiConfidence = row[18] === '' ? '' : Number(row[18]);
      const variety = String(row[21] || '');
      const plantDensity = row[22] || '';
      const soilType = String(row[23] || '');
      const irrigation = String(row[24] || '');
      const drainageScore = row[25] || '';
      const notes = String(row[26] || '');
      const actualHarvestDate = row[27] || '';
      const actualYieldTon = row[28] || '';
      const actualBrix = row[29] || '';
      const actualGrade = String(row[30] || '');
      const diseaseObserved = String(row[31] || '');
      const weatherFeatures = {
        retrievedAt: row[32] || '',
        source: String(row[33] || ''),
        rain24hMm: Number(row[34]) || 0,
        rain72hMm: Number(row[35]) || 0,
        rain120hMm: Number(row[36]) || 0,
        humidityAvg: Number(row[37]) || 0,
        humidityMax: Number(row[38]) || 0,
        tempAvgC: Number(row[39]) || 0,
        tempMinC: Number(row[40]) || 0,
        tempMaxC: Number(row[41]) || 0,
        leafWetnessHours: Number(row[42]) || 0,
        heavyRainEvents: Number(row[43]) || 0,
        dryForecastSlots: Number(row[44]) || 0,
        weatherStressScore: Number(row[45]) || 0,
        droughtScore: Number(row[46]) || 0,
        diseaseWeatherScore: Number(row[47]) || 0,
        weatherImpactFactor: Number(row[48]) || 1
      };
      const diseaseClassification = {
        version: String(row[49] || ''),
        predictedClass: String(row[50] || ''),
        riskScore: Number(row[51]) || 0,
        probability: Number(row[52]) || 0,
        severity: Number(row[53]) || 0,
        reasons: String(row[54] || ''),
        action: String(row[55] || ''),
        trainingLabel: String(row[56] || '')
      };
      const yieldMl = {
        version: String(row[57] || ''),
        predictionTon: row[58] === '' ? '' : Number(row[58]),
        confidence: row[59] === '' ? '' : Number(row[59]),
        lowTon: row[60] === '' ? '' : Number(row[60]),
        highTon: row[61] === '' ? '' : Number(row[61]),
        trainingTargetTon: row[62] === '' ? '' : Number(row[62]),
        featureVersion: String(row[63] || '')
      };
      diseaseClassification.probabilities = parseJsonObject(row[75]);
      diseaseClassification.droughtRisk = row[76] === '' ? '' : Number(row[76]);
      const outcomeObservedAt = row[65] || '';
      const actualHarvestedAreaRai = row[66] === '' ? '' : Number(row[66]);
      const plantSurvivalPct = row[67] === '' ? '' : Number(row[67]);
      const actualRipenessLevel = String(row[68] || '');
      const ripeness = {
        modelVersion: String(row[69] || ''),
        probabilities: parseJsonObject(row[70]),
        expectedLevel: row[71] === '' ? '' : Number(row[71]),
        margin: row[72] === '' ? '' : Number(row[72]),
        imageQualityScore: row[73] === '' ? '' : Number(row[73]),
        status: String(row[74] || '')
      };
      const dataContractVersion = String(row[77] || '');
      const droughtStressObserved = String(row[78] || '');

      let farmRevenue = 0;
      if (gradeStr.includes('A')) farmRevenue = yieldTon * 15000;
      else if (gradeStr.includes('B')) farmRevenue = yieldTon * 10000;
      else farmRevenue = yieldTon * 8000;

      dashboard.totalRevenue += farmRevenue;
      dashboard.totalYield += yieldTon;
      dashboard.totalArea += area;
      if (brix > 0) {
        dashboard.totalBrix += brix;
        dashboard.countBrix++;
      }

      const monthStr = getMonthKey(harvestDateStr);
      if (!dashboard.monthlyYields[monthStr]) dashboard.monthlyYields[monthStr] = 0;
      dashboard.monthlyYields[monthStr] += yieldTon;

      const gradeBucket = getAiGradeBucket(aiLabel || aiStr);
      dashboard.aiGrades[gradeBucket]++;

      const riskLevel = normalizeRisk(riskStr);
      dashboard.risks[riskLevel]++;

      const daysToHarvest = getDaysUntilHarvest(harvestDateStr);
      const hasPhoto = !!photoUrl;
      if (riskLevel === 'High') {
        dashboard.urgentTasks.push({
          type: 'risk',
          severity: 'High',
          rowNumber: index + 2,
          farmName,
          message: diseaseClassification.action || 'เสี่ยงโรคสูง ควรตรวจแปลงภายใน 48 ชั่วโมง'
        });
      }
      if (diseaseClassification.riskScore >= 70 && riskLevel !== 'High') {
        dashboard.urgentTasks.push({
          type: 'disease_classifier',
          severity: 'Medium',
          rowNumber: index + 2,
          farmName,
          message: `${diseaseClassification.predictedClass}: ${diseaseClassification.action}`
        });
      }
      if (daysToHarvest !== null && daysToHarvest >= 0 && daysToHarvest <= 14) {
        dashboard.harvestSoon.push({
          rowNumber: index + 2,
          farmName,
          daysToHarvest,
          harvestDate: harvestDateStr
        });
      }
      if (!hasPhoto) {
        dashboard.noPhoto.push({ rowNumber: index + 2, farmName });
      }

      if (actualYieldTon !== '' && isFinite(Number(actualYieldTon))) {
        dashboard.actuals.count++;
        dashboard.actuals.totalYield += Number(actualYieldTon);
        dashboard.actuals.totalPredictedYield += yieldTon;
      }

      if (!isNaN(lat) && !isNaN(lng)) {
        dashboard.farms.push({
          rowNumber: index + 2,
          id: index + 1,
          name: farmName,
          lat,
          lng,
          area,
          variety,
          plantDensity,
          soilType,
          irrigation,
          drainageScore,
          plantingDate: row[5],
          forcingDate: row[6],
          soilDrainage: row[7],
          harvestDate: harvestDateStr,
          yield: yieldTon,
          weight,
          grade: gradeStr,
          brix,
          risk: riskLevel,
          riskText: riskStr,
          riskMessage: row[14],
          revenue: farmRevenue,
          aiAnalysis: aiStr,
          aiLabel,
          aiConfidence,
          photo: photoUrl,
          notes,
          actualHarvestDate,
          actualYieldTon,
          actualBrix,
          actualGrade,
          outcomeObservedAt,
          actualHarvestedAreaRai,
          plantSurvivalPct,
          actualRipenessLevel,
          diseaseObserved,
          droughtStressObserved,
          weatherFeatures,
          diseaseClassification,
          yieldMl,
          ripeness,
          dataContractVersion,
          daysToHarvest
        });
      }
    });

    return { success: true, data: dashboard };
  } catch (error) {
    return { success: false, message: friendlyError(error), detail: error.toString() };
  }
}

function emptyDashboard() {
  return {
    totalYield: 0,
    totalArea: 0,
    totalBrix: 0,
    countBrix: 0,
    totalRevenue: 0,
    urgentTasks: [],
    harvestSoon: [],
    noPhoto: [],
    actuals: { count: 0, totalYield: 0, totalPredictedYield: 0 },
    monthlyYields: {},
    aiGrades: { Level0: 0, Level1: 0, Level2: 0, Level3: 0, Unknown: 0 },
    risks: { Low: 0, Medium: 0, High: 0 },
    farms: [],
    weatherForecast: [
      { day: 'พรุ่งนี้', icon: '🌧️', temp: '27°C', rain: '80%' },
      { day: 'มะรืนนี้', icon: '⛈️', temp: '26°C', rain: '95%' },
      { day: 'อีก 3 วัน', icon: '🌦️', temp: '29°C', rain: '40%' }
    ]
  };
}

function getMonthKey(value) {
  if (!value) return 'Unknown';
  if (value instanceof Date) {
    return value.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  }

  const parts = String(value).split('/');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]).toLocaleString('en-US', { month: 'short', year: 'numeric' });
  }
  return 'Unknown';
}

function getDaysUntilHarvest(value) {
  if (!value) return null;
  let harvestDate = null;
  if (value instanceof Date) {
    harvestDate = value;
  } else {
    const parts = String(value).split('/');
    if (parts.length === 3) harvestDate = new Date(parts[2], parts[1] - 1, parts[0]);
  }
  if (!harvestDate || isNaN(harvestDate.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  harvestDate.setHours(0, 0, 0, 0);
  return Math.ceil((harvestDate.getTime() - today.getTime()) / 86400000);
}

function normalizeRisk(riskStr) {
  const text = String(riskStr || '').toLowerCase();
  if (text.includes('high') || text.includes('สูง')) return 'High';
  if (text.includes('medium') || text.includes('ปานกลาง')) return 'Medium';
  return 'Low';
}

function getAiGradeBucket(text) {
  const value = String(text || '');
  if (value.includes('0')) return 'Level0';
  if (value.includes('1')) return 'Level1';
  if (value.includes('2')) return 'Level2';
  if (value.includes('3')) return 'Level3';
  return 'Unknown';
}

function setupPermissions() {
  DriveApp.getRootFolder();
  UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  getDataSheet();
  getLogSheet();
}
