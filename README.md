# ระบบจัดการแปลงปลูกสับปะรด (Predictive Analytics)

โครงสร้างใหม่:
- **Frontend (`index.html`)** → host บน **Vercel** ผ่าน **GitHub**
- **Backend (`code.gs`)** → ยังคงเป็น **Google Apps Script Web App** (อ่าน/เขียน Google Sheet เหมือนเดิม)

หน้าเว็บจะเรียก Apps Script ผ่าน `fetch()` แทน `google.script.run` เดิม

---

## ขั้นตอนที่ 1: Deploy Backend (Google Apps Script)

1. เปิด Google Sheet ที่จะใช้เก็บข้อมูล → เมนู **ส่วนขยาย (Extensions) > Apps Script**
2. ลบโค้ดเดิมทั้งหมด แล้ววางเนื้อหาจากไฟล์ `code.gs` (เวอร์ชันใหม่ในโปรเจกต์นี้) ลงไป
3. เปิดไฟล์ `appscript.json` (Project Settings > Show "appsscript.json") แล้วแทนที่ด้วยเนื้อหาจากไฟล์ `appscript.json` ที่แนบมา
4. ตั้งค่า API Key ของ OpenWeather แบบปลอดภัย (ไม่ hardcode ในโค้ดแล้ว):
   - ใน Apps Script Editor กดไอคอน **⚙️ Project Settings** ทางซ้าย
   - เลื่อนลงไปที่ **Script Properties** > **Add script property**
   - Property: `OPENWEATHER_API_KEY`
   - Value: ใส่ API key ของคุณ (ขอใหม่ได้ที่ https://home.openweathermap.org/api_keys ถ้า key เดิมเคยหลุดไปที่ไหนมาก่อน)
   - กด **Save script properties**
5. กด **Deploy > New deployment**
   - Select type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. กด **Deploy** → อนุมัติสิทธิ์ (จะมีหน้าต่างขอ permission ให้เข้าถึง Sheet/Drive/External request — กด Allow)
7. คัดลอก **Web app URL** ที่ได้ (รูปแบบ `https://script.google.com/macros/s/xxxxxxxx/exec`)

> ⚠️ ทุกครั้งที่แก้โค้ดใน `code.gs` แล้วอยากให้ URL เดิมอัปเดต ต้องกด **Deploy > Manage deployments > แก้ไข (ไอคอนดินสอ) > New version > Deploy** ไม่ใช่สร้าง deployment ใหม่ (ไม่งั้น URL จะเปลี่ยน)

## ขั้นตอนที่ 2: ใส่ URL ลงในหน้าเว็บ

เปิดไฟล์ `index.html` หาบรรทัด:

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXX/exec";
```

แทนที่ด้วย Web app URL ที่ได้จากขั้นตอนที่ 1

## ขั้นตอนที่ 3: Push ขึ้น GitHub

```bash
git init
git add .
git commit -m "Initial commit: pineapple farm predictive analytics"
git branch -M main
git remote add origin https://github.com/<username>/<repo-name>.git
git push -u origin main
```

## ขั้นตอนที่ 4: Deploy บน Vercel

1. เข้า [vercel.com](https://vercel.com) → **Add New... > Project**
2. เลือก **Import Git Repository** แล้วเลือก repo ที่เพิ่ง push
3. Framework Preset: เลือก **Other** (เพราะเป็น static HTML ล้วนๆ ไม่ต้อง build)
4. Build Command: เว้นว่าง, Output Directory: เว้นว่าง (หรือ `.`)
5. กด **Deploy**

เท่านี้เว็บจะขึ้นที่ `https://<project-name>.vercel.app` และทุกครั้งที่ push โค้ดใหม่ขึ้น GitHub branch `main`, Vercel จะ deploy ให้อัตโนมัติ

---

## หมายเหตุด้านความปลอดภัย

- `OPENWEATHER_API_KEY` ใน `code.gs` ยังทำงานบนฝั่ง Apps Script (ไม่หลุดไปที่ browser) ปลอดภัยอยู่แล้ว เพราะ frontend ไม่เห็น key นี้เลย
- เนื่องจาก `access: "ANYONE_ANONYMOUS"` ใครก็ตามที่มี Web App URL สามารถยิง `saveData` เข้ามาเขียน Sheet ได้ ถ้าต้องการจำกัดการเข้าถึง ให้พิจารณาเพิ่มการเช็ค token/secret key ง่ายๆ ใน payload แล้วตรวจสอบใน `doPost`
