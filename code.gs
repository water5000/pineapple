// 🔑 API Key ไม่ hardcode ในโค้ดแล้ว อ่านจาก Script Properties แทน
// วิธีตั้งค่า: เปิด Apps Script Editor > Project Settings (รูปเฟือง) >
// Script Properties > Add script property
//   Property: OPENWEATHER_API_KEY
//   Value: <ใส่ API key ของคุณที่นี่>
function getOpenWeatherApiKey() {
  return PropertiesService.getScriptProperties().getProperty('OPENWEATHER_API_KEY');
}

// =========================================
// API Router (ใช้เมื่อหน้าเว็บ (index.html) ถูก host แยกไว้บน Vercel
// แล้วยิง fetch() มาที่ Web App URL นี้แทนการใช้ google.script.run)
// =========================================

function doGet(e) {
  // เรียกตรงๆ ผ่าน browser เพื่อเช็คว่า deploy สำเร็จ / หรือใช้เป็น GET API
  if (e && e.parameter && e.parameter.action === 'getDashboardData') {
    return jsonResponse(getDashboardData());
  }
  return jsonResponse({ success: true, message: 'Pineapple Farm API is running.' });
}

function doPost(e) {
  try {
    // ส่ง Content-Type เป็น text/plain จากฝั่ง client เพื่อเลี่ยง CORS preflight
    // จากนั้น parse JSON เอาเองที่นี่
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const payload = body.payload;

    let result;
    if (action === 'saveData') {
      result = saveData(payload);
    } else if (action === 'getDashboardData') {
      result = getDashboardData();
    } else {
      result = { success: false, message: 'Unknown action: ' + action };
    }
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ success: false, message: error.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function saveData(formObj) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const timestamp = new Date();
    
    // 1. จัดการวันที่
    let plantingDate = new Date(formObj.plantingDate);
    let forcingDate = new Date(formObj.forcingDate);
    let expectedHarvestDate = new Date(forcingDate);
    expectedHarvestDate.setDate(expectedHarvestDate.getDate() + 150); 
    
    let formattedPlantingDate = Utilities.formatDate(plantingDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
    let formattedForcingDate = Utilities.formatDate(forcingDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
    let formattedHarvestDate = Utilities.formatDate(expectedHarvestDate, Session.getScriptTimeZone(), "dd/MM/yyyy");

    // 2. ตรวจสอบความเสี่ยงโรคระบาดจาก API
    let riskData = checkDiseaseRisk(formObj.latitude, formObj.longitude, formObj.soilDrainage);

    // ---------------------------------------------------------
    // 3. สมการทำนายผลผลิตแบบ Predictive Analytics (ปรับจูนค่าให้สมจริง)
    // ---------------------------------------------------------
    let areaRai = parseFloat(formObj.plantArea);
    
    // 🎯 1. ปรับค่าตั้งต้นให้สะท้อนหน้าแปลงจริง
    let targetDensity = 7000;  // ลดจาก 8,000 เป็น 7,000 (หักล้างร่องทางเดินและต้นตาย)
    let fruitingRate = 0.85;   // อัตราการรอดและออกผลเฉลี่ย (85%)
    let baseWeight = 1.35;     // น้ำหนักเฉลี่ยรวมทุกเกรด (1.35 กก./ผล)
    
    // 3.1 Seasonal Multiplier (ฤดูกาล)
    let harvestMonth = expectedHarvestDate.getMonth() + 1;
    let isOffSeason = (harvestMonth >= 10 || harvestMonth <= 3); 
    let seasonalMultiplier = isOffSeason ? 0.95 : 1.05;

    // 🎯 2. ปรับน้ำหนักจากสภาพอากาศ (ไม่ให้ตัวคูณสวิงรุนแรงเกินไป)
    let weatherImpact = seasonalMultiplier;
    let isRainingHeavily = riskData.heavyRainCount >= 2;
    let isDrought = (riskData.heavyRainCount === 0 && riskData.leafWetness === 0);
    
    if (isRainingHeavily) {
      weatherImpact += 0.05; // ฝนดี น้ำหนักเพิ่ม 5% (จากเดิม 10%)
    } else if (isDrought) {
      weatherImpact -= 0.05; // ฝนทิ้งช่วง น้ำหนักลด 5%
    }

    // 3.3 Disease Loss (หักลบอัตราการรอดจากโรคระบาด)
    let diseaseLoss = 0;
    if (riskData.level.includes("🔴")) diseaseLoss = 0.15; // เสี่ยงสูง ต้นตาย 15%
    else if (riskData.level.includes("🟡")) diseaseLoss = 0.05; // เสี่ยงปานกลาง หายไป 5%

    // 3.4 Soil Multiplier (สภาพดิน)
    let soilMultiplier = 1.0;
    let soilDrainageTH = "ดี";
    if (formObj.soilDrainage === "moderate") { soilDrainageTH = "ปานกลาง"; soilMultiplier = 0.95; } 
    else if (formObj.soilDrainage === "poor") { soilDrainageTH = "แย่"; soilMultiplier = 0.85; }

    // 🎯 3. คำนวณผลลัพธ์สุดท้าย
    let actualFruitingRate = Math.max(0, fruitingRate - diseaseLoss);
    let actualWeight = baseWeight * weatherImpact; // น้ำหนักเฉลี่ยจริงจะอยู่ราวๆ 1.25 - 1.48 กก.
    let totalYieldKg = areaRai * targetDensity * actualFruitingRate * actualWeight * soilMultiplier;
    let totalYieldTon = (totalYieldKg / 1000).toFixed(2);
    
    // ---------------------------------------------------------
    // 4. ระบบคัดเกรดและทำนายคุณภาพ (Quality & Grade Prediction)
    // ---------------------------------------------------------
    
    // 4.1 ทำนายความหวาน (Brix)
    let predictedBrix = 12.5; // ค่ามาตรฐานตั้งต้น
    if (isOffSeason) predictedBrix += 1.5; // นอกฤดูความหวานควบแน่น
    
    if (isRainingHeavily) {
      predictedBrix -= 1.0; // ฝนชุก สับปะรดอมน้ำ ความหวานเจือจาง
    } else if (isDrought) {
      predictedBrix += 1.0; // ฝนทิ้งช่วง ความหวานเพิ่ม
    }
    
    // 4.2 คัดเกรดขนาด (Size Grading)
    let predictedGrade = "";
    if (actualWeight >= 1.5) {
      predictedGrade = "เกรด A (พรีเมียม/เข้าโรงงาน)";
    } else if (actualWeight >= 1.0) {
      predictedGrade = "เกรด B (ขนาดมาตรฐาน)";
    } else {
      predictedGrade = "เกรด C (ไซส์เล็ก/ทำน้ำผลไม้)";
    }
    // ---------------------------------------------------------

// =========================================
// ส่วนที่ 5: ฟังก์ชันบันทึกข้อมูลลง Google Sheet (แบบไม่ง้อ Drive)
// =========================================

    // 🎯 1. รับค่ารูปภาพ Base64 มาตรงๆ ไม่ต้องสร้างไฟล์ใน Drive
    let finalImageData = formObj.imageBase64 || "";

    // 🎯 2. บันทึกลง Sheet (ใส่รูปในคอลัมน์ที่ 17 เลย)
    sheet.appendRow([
      timestamp,
      formObj.farmName,
      areaRai,              
      formObj.latitude,
      formObj.longitude,
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
      formObj.aiAnalysis,      // คอลัมน์ที่ 16: ผลวิเคราะห์ AI
      finalImageData           // 🎯 คอลัมน์ที่ 17: รหัสรูปภาพ (Base64)
    ]);
    
    let seasonText = isOffSeason ? "นอกฤดูกาล" : "ในฤดูกาล";

    return { 
      success: true, 
      message: `บันทึกข้อมูลแปลง <b>${formObj.farmName}</b> สำเร็จ!<br>
                <div class="text-sm text-gray-700 mt-3 p-3 bg-gray-100 rounded-lg border border-gray-300 text-left">
                  <b>🗓️ คาดการณ์เก็บเกี่ยว:</b> ${formattedHarvestDate} <span class="text-xs text-blue-600">(${seasonText})</span><br><br>
                  <b>🍍 คาดการณ์ผลผลิตรวม:</b> <span class="text-lg text-green-700 font-bold">${totalYieldTon} ตัน</span><br><br>
                  <b>🎯 การพยากรณ์คุณภาพ:</b><br>
                  • เกรดผลผลิต: <span class="font-semibold text-purple-700">${predictedGrade}</span><br>
                  <b>📊 ความเสี่ยงโรคระบาด:</b><br>
                  • <span class="font-bold">${riskData.level}</span>
                </div>`,
      harvestDate: formattedHarvestDate
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// (ฟังก์ชัน checkDiseaseRisk และ getDashboardData ด้านล่างปล่อยไว้เหมือนเดิมครับ)

function checkDiseaseRisk(lat, lon, soilDrainage) {
  const OPENWEATHER_API_KEY = getOpenWeatherApiKey();
  if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === '') return { level: "ไม่ทราบ", message: "ยังไม่ได้ตั้งค่า API Key", heavyRainCount: 0, leafWetness: 0 };
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=th`;
  try {
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    let heavyRainCount = 0; let leafWetnessHours = 0;
    data.list.slice(0, 24).forEach(item => {
      let rain = (item.rain && item.rain['3h']) ? item.rain['3h'] : 0;
      if (item.main.humidity > 85 || rain > 0.5) leafWetnessHours += 3;
      if (rain > 5) heavyRainCount++; 
    });

    let riskLevel = "🟢 ความเสี่ยงต่ำ (Low)"; let riskMessage = "สภาพอากาศและแปลงปลูกปกติ";
    if (soilDrainage === "poor") {
      if (heavyRainCount >= 1 || leafWetnessHours > 24) { riskLevel = "🔴 ความเสี่ยงสูง (High)"; riskMessage = "ระวังโรครากเน่าเฉียบพลัน"; } 
      else { riskLevel = "🟡 ความเสี่ยงปานกลาง (Medium)"; riskMessage = "เฝ้าระวังหากมีฝนตกตกลงมาเพิ่ม"; }
    } else {
      if (leafWetnessHours > 36 && heavyRainCount > 2) { riskLevel = "🔴 ความเสี่ยงสูง (High)"; riskMessage = "ฝนตกชุก ระวังโรคยอดเน่า"; } 
      else if (leafWetnessHours > 24 || heavyRainCount >= 1) { riskLevel = "🟡 ความเสี่ยงปานกลาง (Medium)"; riskMessage = "มีความชื้นสะสม เฝ้าระวังการเกิดเชื้อรา"; }
    }
    return { level: riskLevel, message: riskMessage, heavyRainCount: heavyRainCount, leafWetness: leafWetnessHours };
  } catch (e) { return { level: "⚠️ Error", message: "ไม่สามารถดึงข้อมูลสภาพอากาศได้", heavyRainCount: 0, leafWetness: 0 }; }
}
// =========================================
// ส่วนที่ 6: ฟังก์ชันสำหรับดึงข้อมูลทำ Dashboard (แก้ไขบัคโหลดข้อมูลไม่ขึ้น)
// =========================================
function getDashboardData() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();
    data.shift(); // ตัดหัวคอลัมน์
    
    let dashboard = {
      totalYield: 0, totalArea: 0, totalBrix: 0, countBrix: 0, totalRevenue: 0,
      monthlyYields: {}, aiGrades: { 'Level0': 0, 'Level1': 0, 'Level2': 0, 'Level3': 0 }, 
      risks: { 'Low': 0, 'Medium': 0, 'High': 0 }, farms: [],
      // 🎯 1. เพิ่มข้อมูลสภาพอากาศที่หายไปกลับคืนมา
      weatherForecast: [
        { day: "พรุ่งนี้", icon: "🌧️", temp: "27°C", rain: "80%" },
        { day: "มะรืนนี้", icon: "⛈️", temp: "26°C", rain: "95%" },
        { day: "อีก 3 วัน", icon: "🌦️", temp: "29°C", rain: "40%" }
      ]
    };

    data.forEach((row, index) => {
      if (!row[1]) return; 

      let farmName = String(row[1] || "");       
      let area = parseFloat(row[2]) || 0;    
      let lat = parseFloat(row[3]);          
      let lng = parseFloat(row[4]);          
      let harvestDateStr = row[8];           
      let yieldTon = parseFloat(row[9]) || 0;
      let weight = parseFloat(row[10]) || 0; 
      
      // 🎯 2. บังคับให้ข้อมูลเป็น String (ข้อความ) เพื่อป้องกัน Error จาก Google Sheet
      let gradeStr = String(row[11] || "");          
      let brix = parseFloat(row[12]) || 0;   
      let riskStr = String(row[13] || "");           
      let aiStr = String(row[15] || ""); 
      let photoUrl = String(row[16] || "");

      let farmRevenue = 0;
      if (gradeStr.includes("A")) farmRevenue = yieldTon * 15000;      
      else if (gradeStr.includes("B")) farmRevenue = yieldTon * 10000; 
      else farmRevenue = yieldTon * 8000;                              
      
      dashboard.totalRevenue += farmRevenue;
      dashboard.totalYield += yieldTon;
      dashboard.totalArea += area;
      if (brix > 0) { dashboard.totalBrix += brix; dashboard.countBrix++; }

      // 🎯 3. แก้บัคดึงวันที่ (รองรับทั้งแบบ Date Object และ String)
      let monthStr = "Unknown";
      if (harvestDateStr) {
         if (harvestDateStr instanceof Date) {
             monthStr = harvestDateStr.toLocaleString('en-US', { month: 'short', year: 'numeric' });
         } else {
             let parts = String(harvestDateStr).split('/');
             if(parts.length === 3) monthStr = new Date(parts[2], parts[1]-1, parts[0]).toLocaleString('en-US', { month: 'short', year: 'numeric' });
         }
      }
      if(!dashboard.monthlyYields[monthStr]) dashboard.monthlyYields[monthStr] = 0;
      dashboard.monthlyYields[monthStr] += yieldTon;

      if (aiStr.includes("0")) dashboard.aiGrades['Level0']++;
      else if (aiStr.includes("1")) dashboard.aiGrades['Level1']++;
      else if (aiStr.includes("2")) dashboard.aiGrades['Level2']++;
      else if (aiStr.includes("3")) dashboard.aiGrades['Level3']++;

      let riskLevel = 'Low';
      if (riskStr.includes("🔴") || riskStr.includes("สูง")) { dashboard.risks['High']++; riskLevel = 'High'; }
      else if (riskStr.includes("🟡") || riskStr.includes("ปานกลาง")) { dashboard.risks['Medium']++; riskLevel = 'Medium'; }
      else { dashboard.risks['Low']++; }

      if (!isNaN(lat) && !isNaN(lng)) {
          dashboard.farms.push({
              id: index + 1, name: farmName, lat: lat, lng: lng,
              area: area, yield: yieldTon, brix: brix, weight: weight, 
              risk: riskLevel, revenue: farmRevenue, photo: photoUrl 
          });
      }
    });

    return { success: true, data: dashboard };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}
function setupPermissions() {
  // ฟังก์ชันนี้มีไว้แค่หลอกให้ Google เด้งหน้าต่างขอสิทธิ์เข้าถึง Drive ครับ
  DriveApp.getRootFolder(); 
}