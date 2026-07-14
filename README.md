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

## สิ่งที่ระบบรองรับแล้ว

- แยก frontend/backend ชัดเจนผ่าน Vercel proxy
- ใช้ `APPS_SCRIPT_URL` และ `API_SECRET` จาก Environment Variables
- Apps Script ตรวจ `API_SECRET` ก่อนรับ request
- บันทึกรูปลง Google Drive แล้วเก็บเฉพาะ URL ใน Sheet
- สร้าง/ตรวจ header ของชีต `Farms` อัตโนมัติ
- สร้างชีต `Logs` เพื่อเก็บประวัติ action/error
- บันทึกข้อมูลใหม่
- แก้ไขข้อมูลแปลงจาก dashboard
- ลบข้อมูลแบบ soft delete
- validate input ก่อนบันทึก
- error message อ่านง่ายขึ้น
- dashboard แสดงผลผลิต, พื้นที่, รายได้, ความเสี่ยง, แผนที่ และรูปภาพ
- เก็บผล AI label/confidence เพิ่มเติม
- เพิ่ม UX: ใช้ตำแหน่งปัจจุบัน, สถานะฟอร์ม, งานด่วนวันนี้, ใกล้เก็บเกี่ยว 14 วัน, และแปลงที่ยังไม่มีรูป
- เพิ่ม data model: Variety, Plant Density, Soil Type, Irrigation, Drainage Score, Notes, Actual Harvest Date, Actual Yield, Actual Brix, Actual Grade, Disease Observed

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

ระบบจะใช้ชีต `Farms` และ `Logs`

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
