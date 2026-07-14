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
  'Disease Observed'
];

const LOG_HEADERS = ['Timestamp', 'Action', 'Success', 'Message', 'Detail'];

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
    } else if (action === 'updateData') {
      result = updateData(payload);
    } else if (action === 'deleteData') {
      result = deleteData(payload);
    } else if (action === 'getDashboardData') {
      result = getDashboardData();
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

function calculateFarmRecord(formObj, existingPhotoUrl) {
  validateFarmInput(formObj);

  const timestamp = formObj.timestamp ? new Date(formObj.timestamp) : new Date();
  const plantingDate = new Date(formObj.plantingDate);
  const forcingDate = new Date(formObj.forcingDate);
  const expectedHarvestDate = new Date(forcingDate);
  expectedHarvestDate.setDate(expectedHarvestDate.getDate() + 150);

  const formattedPlantingDate = Utilities.formatDate(plantingDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const formattedForcingDate = Utilities.formatDate(forcingDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const formattedHarvestDate = Utilities.formatDate(expectedHarvestDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');

  const areaRai = parseFloat(formObj.plantArea);
  const riskData = checkDiseaseRisk(formObj.latitude, formObj.longitude, formObj.soilDrainage);
  const harvestMonth = expectedHarvestDate.getMonth() + 1;
  const isOffSeason = harvestMonth >= 10 || harvestMonth <= 3;
  const seasonalMultiplier = isOffSeason ? 0.95 : 1.05;
  const isRainingHeavily = riskData.heavyRainCount >= 2;
  const isDrought = riskData.heavyRainCount === 0 && riskData.leafWetness === 0;

  let weatherImpact = seasonalMultiplier;
  if (isRainingHeavily) weatherImpact += 0.05;
  else if (isDrought) weatherImpact -= 0.05;

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
  const totalYieldTon = (totalYieldKg / 1000).toFixed(2);

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

  return {
    row: [
      timestamp,
      String(formObj.farmName || '').trim(),
      areaRai,
      parseFloat(formObj.latitude),
      parseFloat(formObj.longitude),
      formattedPlantingDate,
      formattedForcingDate,
      soilDrainageTH,
      formattedHarvestDate,
      totalYieldTon,
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
      diseaseObserved
    ],
    harvestDate: formattedHarvestDate,
    yieldTon: totalYieldTon,
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

function updateData(payload) {
  try {
    const sheet = getDataSheet();
    const rowNumber = parseInt(payload.rowNumber, 10);
    if (!rowNumber || rowNumber <= 1 || rowNumber > sheet.getLastRow()) {
      throw new Error('Invalid row number.');
    }

    const existing = sheet.getRange(rowNumber, 1, 1, FARM_HEADERS.length).getValues()[0];
    const existingPhotoUrl = existing[16] || '';
    const formObj = Object.assign({}, payload.formData || {}, { timestamp: existing[0] || new Date() });
    const record = calculateFarmRecord(formObj, existingPhotoUrl);
    sheet.getRange(rowNumber, 1, 1, FARM_HEADERS.length).setValues([record.row]);

    return {
      success: true,
      message: `อัปเดตข้อมูลแปลง <b>${record.row[1]}</b> สำเร็จ${record.imageWarning ? '<br><small class="text-orange-600">' + record.imageWarning + '</small>' : ''}`
    };
  } catch (error) {
    return { success: false, message: friendlyError(error), detail: error.toString() };
  }
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

function checkDiseaseRisk(lat, lon, soilDrainage) {
  const OPENWEATHER_API_KEY = getOpenWeatherApiKey();
  if (!OPENWEATHER_API_KEY) {
    return {
      level: 'ไม่ทราบ',
      message: 'ยังไม่ได้ตั้งค่า OpenWeather API Key',
      heavyRainCount: 0,
      leafWetness: 0,
      normalizedRisk: 'Low'
    };
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=th`;
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    let heavyRainCount = 0;
    let leafWetnessHours = 0;

    if (data.list && Array.isArray(data.list)) {
      data.list.slice(0, 24).forEach(item => {
        const rain = item.rain && item.rain['3h'] ? item.rain['3h'] : 0;
        if (item.main && (item.main.humidity > 85 || rain > 0.5)) leafWetnessHours += 3;
        if (rain > 5) heavyRainCount++;
      });
    }

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
          message: 'เสี่ยงโรคสูง ควรตรวจแปลงภายใน 48 ชั่วโมง'
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
          diseaseObserved,
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
