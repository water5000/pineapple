import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

const decisionIndex = html.indexOf('class="decision-strip"');
const summaryIndex = html.indexOf('class="summary-ribbon"', decisionIndex);
const searchIndex = html.indexOf('id="globalSearch"');
const fieldSplitIndex = html.indexOf('class="field-split"');

assert.ok(decisionIndex > 0, "homepage recommendation should exist");
assert.ok(summaryIndex > decisionIndex, "recommendation should appear before summary metrics");
assert.ok(searchIndex > summaryIndex, "dashboard search should follow the recommendation and metrics");
assert.ok(fieldSplitIndex > searchIndex, "field queue should follow dashboard search");
assert.equal(html.includes('id="todayYieldCount"'), false, "forecast yield belongs with the forecast chart, not today's ribbon");
assert.match(html, /id="todayUrgentCount">—</);
assert.match(html, /id="selectedActionEvidence"/);
assert.match(html, /id="selectedActionDeadline"/);
assert.match(html, /กำลังแสดงข้อมูลล่าสุดที่มี/);
assert.match(html, /reportForecastPeriodSelect/);
assert.match(html, /ภาพรวมความเสี่ยง แปลงที่ควรติดตาม และกำหนดเก็บเกี่ยวจากข้อมูลล่าสุด/);
assert.match(html, /function matchesDashboardSearch\(farm, text\)/);
assert.match(html, /renderDashboardMap\(matchedFarms\)/);
assert.match(html, /renderOperationalQueueList\(\);/);
assert.match(html, /#todaySummaryRibbon \{ grid-template-columns: repeat\(3/);
assert.match(html, /const actionVerb = canOperate \? 'ดูแล' : 'ติดตาม'/);
assert.match(html, /id="operationsQueueTitle" class="panel-title" hidden>ภาคสนาม/);
assert.match(html, /operationsQueueTitle'\)\?\.toggleAttribute\('hidden', !canOperate\)/);
assert.match(html, /id="dashboardLoginButton"[^>]*hidden>เข้าสู่ระบบ</);
assert.match(html, /dashboardLoginButton'\)\?\.removeAttribute\('hidden'\)/);
assert.match(html, /dashboardLoginButton'\)\?\.setAttribute\('hidden', ''\)/);
assert.match(html, /pageId !== 'dashboardPage'/);
assert.equal(html.includes('id="guestLoginButton"'), false, "login entry should only appear on the overview page");
assert.match(html, /id="overviewUtilities" class="top-utilities"/);
assert.match(html, /overviewUtilities'\)\?\.toggleAttribute\('hidden', pageId !== 'dashboardPage'\)/);
assert.equal((html.match(/ประจวบคีรีขันธ์ · ศูนย์ติดตามแปลง/g) || []).length, 1, "station context should appear once");
assert.ok(html.indexOf("ประจวบคีรีขันธ์ · ศูนย์ติดตามแปลง") < html.indexOf('id="fieldPage"'), "station context should remain on overview only");

console.log("UI smoke tests passed");
