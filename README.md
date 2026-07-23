# Smart Pineapple

ระบบจัดการแปลงปลูกสับปะรดแบบ Predictive Analytics สำหรับบันทึกแปลง, คาดการณ์ผลผลิต, ประเมินความเสี่ยงโรค, วิเคราะห์ภาพด้วย AI และดูข้อมูลผ่าน dashboard

## โครงสร้างระบบ

- `index.html` คือ frontend ที่ deploy บน Vercel
- `api/apps-script.js` คือ Vercel API proxy
- `code.gs` คือ backend บน Google Apps Script
- Google Sheet ใช้เป็นฐานข้อมูล
- Google Drive ใช้เก็บรูปภาพที่อัปโหลด

Flow การทำงาน:

```text
Browser -> Vercel /api/apps-script -> Google Apps Script -> Google Sheet / Google Drive
```

## Production authentication และขอบเขตสถานี

ระบบใช้ Google Identity Services สำหรับเข้าสู่ระบบ ตรวจ ID token ที่ Vercel ด้วย `google-auth-library` และออก signed HttpOnly session cookie อายุ 8 ชั่วโมง ผู้ใช้ต้องอยู่ใน `APP_USERS_JSON` จึงจะเข้าสู่ระบบได้

หน้าเว็บเปิดในโหมดผู้เยี่ยมชมก่อนโดยไม่บังคับเข้าสู่ระบบ ผู้เยี่ยมชมดูข้อมูลของ `PUBLIC_STATION` แบบอ่านอย่างเดียวได้จากทุกหน้าหลัก รวมถึงชื่อแปลง พิกัดบนแผนที่ และภาพแปลงจริง ระบบไม่ส่งหมายเหตุภายในหรือผลติดตามหลังเก็บเกี่ยวผ่าน public endpoint เมนูเพิ่มข้อมูลและการเขียนข้อมูลทุกชนิดต้อง Google Sign-In และตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์

ตั้งค่า Vercel Environment Variables:

```text
GOOGLE_CLIENT_ID = OAuth 2.0 Web Client ID
SESSION_SECRET = ค่าสุ่มอย่างน้อย 32 ตัวอักษร
APP_USERS_JSON = รายชื่อผู้ใช้ สิทธิ์ และสถานีในรูปแบบ JSON
DEFAULT_FORECAST_PERIOD = ช่วงเริ่มต้น เช่น 2026-Q4
PUBLIC_STATION = สถานีที่อนุญาตให้ผู้ใช้ทั่วไปดูข้อมูลรายแปลงแบบอ่านอย่างเดียว เช่น ประจวบคีรีขันธ์
APPS_SCRIPT_URL = Google Apps Script Web app URL
API_SECRET = ค่าลับเดียวกับ Script Properties
```

ตัวอย่าง `APP_USERS_JSON`:

```json
[
  { "email": "officer@example.go.th", "name": "สมชาย ใจดี", "role": "operator", "station": "ประจวบคีรีขันธ์" },
  { "email": "director@example.go.th", "name": "ผู้บริหาร", "role": "viewer", "station": "ประจวบคีรีขันธ์" },
  { "email": "admin@example.go.th", "name": "ผู้ดูแลระบบ", "role": "admin", "station": "*" }
]
```

สิทธิ์ที่รองรับ:

- `operator`: ดูข้อมูลของสถานี สร้างงาน และบันทึกข้อมูลภาคสนาม
- `viewer`: ดูรายงานและส่งออกข้อมูลของสถานีเท่านั้น
- `admin`: ดูทุกสถานีและฝึกโมเดลใหม่ได้

ใน Google Cloud Console ให้สร้าง OAuth client ชนิด Web application และเพิ่มโดเมน Vercel จริงใน Authorized JavaScript origins จากนั้นตั้งค่า Apps Script Properties เพิ่มเติม:

```text
API_SECRET = ค่าเดียวกับ Vercel
DEFAULT_STATION = ประจวบคีรีขันธ์
```

`DEFAULT_STATION` ใช้กำหนดสถานีให้ข้อมูลเดิมที่สร้างก่อนมีคอลัมน์ `Station` เท่านั้น ข้อมูลใหม่จะรับสถานีจาก session ที่ Vercel ตรวจสอบแล้ว และ Apps Script จะเพิ่มคอลัมน์ `Station` ให้ชีต `Farms`/`Tasks` อัตโนมัติ

## สิ่งที่ระบบรองรับแล้ว

- แยก frontend/backend ชัดเจนผ่าน Vercel proxy
- ใช้ `APPS_SCRIPT_URL` และ `API_SECRET` จาก Environment Variables
- Apps Script ตรวจ `API_SECRET` ก่อนรับ request
- บันทึกรูปลง Google Drive แล้วเก็บเฉพาะ URL ใน Sheet
- สร้าง/ตรวจ header ของชีต `Farms` อัตโนมัติ
- สร้างชีต `Logs` เพื่อเก็บประวัติ action/error
- สร้างชีต `Tasks` อัตโนมัติเมื่อมอบหมายงานตรวจแปลง พร้อมผู้รับผิดชอบ วันกำหนด และสถานะ
- บันทึกข้อมูลใหม่
- แก้ไขข้อมูลแปลงจาก dashboard
- ลบข้อมูลแบบ soft delete
- validate input ก่อนบันทึก
- error message อ่านง่ายขึ้น
- dashboard แสดงผลผลิต, พื้นที่, รายได้, ความเสี่ยง, แผนที่ และรูปภาพ
- เก็บผล AI label/confidence เพิ่มเติม
- เพิ่ม UX: ใช้ตำแหน่งปัจจุบัน, สถานะฟอร์ม, งานด่วนวันนี้, ใกล้เก็บเกี่ยว 14 วัน, และแปลงที่ยังไม่มีรูป
- เพิ่ม data model: Variety, Plant Density, Soil Type, Irrigation, Drainage Score, Notes, Actual Harvest Date, Actual Yield, Actual Brix, Actual Grade, Disease Observed
- เพิ่ม weather feature columns สำหรับฝึก ML: rain forecast, humidity, temperature, leaf wetness, drought score, disease weather score, weather stress score, weather impact factor
- เพิ่ม disease classification columns สำหรับฝึก ML: predicted disease class, risk score, probability, severity, reasons, recommended action, training label

## 1. ตั้งค่า Google Apps Script

1. เปิด Google Sheet ที่ต้องการใช้เก็บข้อมูล
2. ไปที่ `Extensions > Apps Script`
3. ลบโค้ดเดิม แล้ววางเนื้อหาจากไฟล์ `code.gs`
4. เปิด `Project Settings`
5. เปิด `Show "appsscript.json" manifest file in editor`
6. เปิดไฟล์ `appsscript.json` แล้วให้มี scopes เหล่านี้:

```json
[
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/script.external_request"
]
```

7. กลับไปที่ `Project Settings > Script Properties`
8. เพิ่ม properties:

```text
OPENWEATHER_API_KEY = OpenWeather API key ของคุณ
API_SECRET = รหัสลับยาวๆ ที่เดายาก และต้องตรงกับ Vercel
```

ถ้าต้องการกำหนดโฟลเดอร์เก็บรูปเอง เพิ่ม:

```text
IMAGE_FOLDER_ID = Google Drive folder ID
```

ตัวอย่างโฟลเดอร์เก็บรูปที่ให้มา:

```text
IMAGE_FOLDER_ID = 13jFy3C0RaFcwpz8houNyckUF_2xUe08F
```

ถ้าไม่ใส่ `IMAGE_FOLDER_ID` ระบบจะสร้างโฟลเดอร์ `Smart Pineapple Uploads` ให้อัตโนมัติ

## 2. อนุญาตสิทธิ์ Apps Script

1. ใน Apps Script เลือกฟังก์ชัน `setupPermissions`
2. กด `Run`
3. กด `Review permissions`
4. เลือกบัญชี Google
5. กด `Allow`

ขั้นตอนนี้จำเป็น เพราะระบบต้องใช้สิทธิ์:

- เขียน Google Sheet
- สร้างไฟล์รูปใน Google Drive
- เรียก OpenWeather API

## 3. Deploy Apps Script

1. กด `Deploy > New deployment`
2. Select type: `Web app`
3. ตั้งค่า:

```text
Execute as: Me
Who has access: Anyone
```

4. กด `Deploy`
5. คัดลอก `Web app URL`

หลังจากแก้ `code.gs` ทุกครั้ง ให้ใช้:

```text
Deploy > Manage deployments > Edit > Version: New version > Deploy
```

อย่าสร้าง deployment ใหม่ถ้าไม่จำเป็น เพราะ URL จะเปลี่ยน

## 4. ตั้งค่า Vercel Environment Variables

ใน Vercel ไปที่:

```text
Project > Settings > Environment Variables
```

เพิ่ม:

```text
APPS_SCRIPT_URL = Web app URL จาก Apps Script
API_SECRET = ค่าเดียวกับ Script Properties ใน Apps Script
```

เลือกอย่างน้อย `Production` ถ้าใช้งานจริง และแนะนำให้เลือก `Preview` ด้วย

หลังตั้งค่า env แล้วต้อง redeploy:

```text
Deployments > เลือก deployment ล่าสุด > ... > Redeploy
```

## 5. ทดสอบระบบ

เปิด Apps Script Web app URL โดยตรง ควรเห็น:

```json
{"success":true,"message":"Pineapple Farm API is running."}
```

จากนั้นเปิดเว็บ Vercel แล้วลอง:

1. เพิ่มข้อมูลแปลงใหม่
2. อัปโหลดรูป
3. ไป dashboard
4. กดดูรายละเอียดแปลง
5. กดแก้ไข
6. กดลบ

## 6. โครงสร้างชีต

ระบบจะใช้ชีต `Farms`, `Logs` และ `Tasks`

ชีต `Farms` เก็บข้อมูลหลัก เช่น:

- ชื่อแปลง
- พื้นที่
- พิกัด
- วันที่ปลูก
- วันที่บังคับดอก
- วันคาดการณ์เก็บเกี่ยว
- ผลผลิตคาดการณ์
- เกรด
- Brix
- ความเสี่ยงโรค
- ผล AI
- URL รูปภาพ
- สถานะ `Active` หรือ `Deleted`

ชีต `Logs` เก็บ:

- เวลา
- action
- success/failure
- message
- detail

ชีต `Tasks` เก็บงานภาคสนาม เช่น:

- รหัสงาน
- แปลงและระดับความเสี่ยง
- ผู้รับผิดชอบ
- วันกำหนด
- คำแนะนำและสถานะงาน

## 7. แก้ปัญหาที่พบบ่อย

`Unauthorized request.`

ค่า `API_SECRET` ใน Vercel และ Apps Script ไม่ตรงกัน

`Apps Script URL ยังเป็นหน้าเว็บ HTML ไม่ใช่ API JSON`

ยัง deploy Apps Script ผิด version หรือใช้ URL ของ deployment เก่า ให้กด `Manage deployments > Edit > New version > Deploy`

`You do not have permission to call DriveApp...`

ยังไม่ได้รัน `setupPermissions` หรือยังไม่ได้กด Allow สิทธิ์ Google Drive

รูปไม่แสดง แต่ข้อมูลบันทึกได้

บัญชี Google Workspace อาจบล็อก public sharing ของ Drive ให้ตั้ง `IMAGE_FOLDER_ID` เป็นโฟลเดอร์ที่แชร์ได้ หรือปรับ sharing policy

Dashboard ไม่เห็นข้อมูลที่เพิ่งลบ

ระบบใช้ soft delete ข้อมูลยังอยู่ใน Sheet แต่ `Status` เป็น `Deleted` และ dashboard จะซ่อนรายการนั้น

## 8. ML v3 workflow

1. ลงทะเบียนแปลงใหม่เพื่อสร้าง prediction snapshot ระบบจะเก็บเวลา prediction, weather features, model version และ probability ไว้ในแถวเดียวกัน
2. เมื่อมีผลสำรวจหรือผลเก็บเกี่ยวจริง ไปที่ `Grading Analysis > Model Intelligence > Record Observed Outcome`
3. เลือกแปลงเดิม แล้วบันทึก Actual Yield, Harvested Area, Brix, Grade, Ripeness, Disease หรือ Drought ตามข้อมูลที่มี
4. ระบบจะเติม outcome ลงในแถวเดิมโดยไม่เขียนทับ prediction snapshot
5. เมื่อมีข้อมูลเพียงพอ กด `Train New Challenger`

เกณฑ์ข้อมูลสำหรับฝึก:

- Yield ใช้ Elastic Net regression, Group K-fold CV และ conformal interval
- Yield ต้องมีอย่างน้อย 20 outcome rows จาก 3 แปลงเพื่อประเมิน challenger
- Yield จะ promote เป็น champion เมื่อมีอย่างน้อย 50 rows จาก 5 แปลงและ CV RMSE ดีกว่าเดิม
- Yield outcome ต้องถูกบันทึกหลัง prediction อย่างน้อย 7 วัน
- Disease ใช้ one-vs-rest regularized logistic classification พร้อม probability blend
- Disease ต้องมีอย่างน้อย 10 positive และ 10 negative ต่อโรค
- Disease จะ promote เมื่อมีอย่างน้อย 50 rows จาก 5 แปลงและ CV Macro F1 ดีกว่าเดิม
- Disease outcome ต้องถูกบันทึกหลัง prediction อย่างน้อย 1 วัน
- แถวที่ weather data quality ต่ำหรือเวลา prediction/outcome ไม่ถูกต้องจะไม่ถูกใช้ฝึก
- Ripeness runtime มี image-quality gate, confidence margin และ abstain; การ train CNN รุ่นใหม่ต้องใช้ชุดภาพที่ติดป้ายกำกับแยกต่างหาก

ทดสอบ logic ของ ML ในเครื่อง:

```text
node tests/ml-smoke.test.cjs
```

เมื่อแก้คลาสของ Tailwind ใน `index.html` ให้สร้างไฟล์ CSS สำหรับ Production ใหม่:

```text
npm run build:css
```
