import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough-123";
process.env.APP_USERS_JSON = JSON.stringify([
  { email: "officer@example.org", name: "Field Officer", role: "operator", station: "ประจวบคีรีขันธ์" },
  { email: "viewer@example.org", role: "viewer", station: "ประจวบคีรีขันธ์" },
  { email: "admin@example.org", role: "admin", station: "*" }
]);

const auth = await import("../api/_auth.js");
const officer = auth.resolveAuthorizedUser({ sub: "google-1", email: "OFFICER@example.org", name: "Google Name" });
assert.equal(officer.role, "operator");
assert.equal(officer.station, "ประจวบคีรีขันธ์");
assert.equal(auth.resolveAuthorizedUser({ sub: "google-2", email: "unknown@example.org" }), null);

const token = auth.createSessionToken(officer);
const session = auth.readSession({ headers: { cookie: `pineapple_session=${encodeURIComponent(token)}` } });
assert.equal(session.email, "officer@example.org");
assert.equal(session.station, "ประจวบคีรีขันธ์");
assert.equal(auth.isMutationAllowed(session, "saveData"), true);
assert.equal(auth.isMutationAllowed({ ...session, role: "viewer" }, "saveData"), false);
assert.equal(auth.isMutationAllowed(session, "trainMLModels"), false);
assert.equal(auth.isMutationAllowed({ ...session, role: "admin" }, "trainMLModels"), true);

const createResponse = () => ({
  statusCode: 200,
  headers: {},
  body: null,
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; }
});

const { default: sessionHandler } = await import("../api/session.js");
const sessionResponse = createResponse();
await sessionHandler({ method: "GET", headers: {} }, sessionResponse);
assert.equal(sessionResponse.statusCode, 200);
assert.ok(sessionResponse.body.csrfToken);
assert.match(sessionResponse.headers["Set-Cookie"], /pineapple_login_csrf=/);

const { default: proxyHandler } = await import("../api/apps-script.js");
const unauthorizedResponse = createResponse();
await proxyHandler({ method: "POST", headers: {}, body: { action: "getDashboardData", payload: {} } }, unauthorizedResponse);
assert.equal(unauthorizedResponse.statusCode, 401);

process.env.APPS_SCRIPT_URL = " https://example.test/apps-script ";
process.env.API_SECRET = " test-api-secret ";
process.env.PUBLIC_STATION = "ประจวบคีรีขันธ์";
let forwardedBody;
let forwardedUrl;
globalThis.fetch = async (url, options) => {
  forwardedUrl = url;
  forwardedBody = JSON.parse(options.body);
  return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, data: { plotCount: 3 } }), headers: { get: () => "application/json" } };
};
const publicResponse = createResponse();
await proxyHandler({ method: "POST", headers: {}, body: { action: "getPublicDashboardData", payload: {} } }, publicResponse);
assert.equal(publicResponse.statusCode, 200);
assert.equal(forwardedBody.requestContext.station, "ประจวบคีรีขันธ์");
assert.equal(forwardedBody.requestContext.role, "viewer");
assert.equal(forwardedBody.action, "getPublicDashboardData");
assert.equal(forwardedBody.apiSecret, "test-api-secret");
assert.equal(forwardedUrl, "https://example.test/apps-script");

const blockedMutationResponse = createResponse();
await proxyHandler({ method: "POST", headers: {}, body: { action: "saveData", payload: { farmName: "blocked" } } }, blockedMutationResponse);
assert.equal(blockedMutationResponse.statusCode, 401);

console.log("Auth smoke tests passed");
