import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./ntut-portal-helper.user.js", import.meta.url), "utf8");
const start = source.indexOf("function classifyLoginResponse(");
const renderStart = source.indexOf("function renderLoginResponse(");
const end = renderStart;
assert.notEqual(start, -1, "classifyLoginResponse must exist");
assert.notEqual(end, -1, "classifyLoginResponse must end before renderLoginResponse");
const classifyLoginResponse = vm.runInNewContext(
  `(${source.slice(start, end)})`,
);
const renderEnd = source.indexOf("\n\n  // ---- 登入流程 ----", renderStart);
assert.notEqual(renderStart, -1, "renderLoginResponse must exist");
assert.notEqual(renderEnd, -1, "renderLoginResponse must end before login flow");
const renderLoginResponse = vm.runInNewContext(
  `(${source.slice(renderStart, renderEnd)})`,
);

test("must treat a redirect away from login.do as success", () => {
  assert.equal(
    classifyLoginResponse(
      { redirected: true, url: "https://nportal.ntut.edu.tw/cloudPortal.do" },
      "登入成功",
    ),
    "success",
  );
});

test("must treat a redirect to a follow-up page as success to follow the response URL", () => {
  assert.equal(
    classifyLoginResponse(
      { redirected: true, url: "https://nportal.ntut.edu.tw/mySecurityConsent.do" },
      "手機驗證設定",
    ),
    "success",
  );
});

test("must treat a login-page response as needs-login (retry)", () => {
  assert.equal(
    classifyLoginResponse(
      { redirected: false, url: "https://nportal.ntut.edu.tw/index.do" },
      '<form name="login"><input id="authcode"></form>驗證碼錯誤',
    ),
    "login_page",
  );
});

test("must treat a password-reset form as follow-up page (not login page)", () => {
  assert.equal(
    classifyLoginResponse(
      { redirected: false, url: "https://nportal.ntut.edu.tw/login.do" },
      '<form id="pwdForceMdyForm"><input id="userPassword">密碼已過期',
    ),
    "follow_up",
  );
});

test("must treat a mobile verification form as follow-up page (not login page)", () => {
  assert.equal(
    classifyLoginResponse(
      { redirected: false, url: "https://nportal.ntut.edu.tw/mySecurityForm.do" },
      '<form id="mySecurityForm"><input id="validCode">請傳送驗證碼',
    ),
    "follow_up",
  );
});

test("must treat any other non-login response as follow-up page", () => {
  assert.equal(
    classifyLoginResponse(
      { redirected: false, url: "https://nportal.ntut.edu.tw/login.do" },
      "<html><body>服務條款同意頁</body></html>",
    ),
    "follow_up",
  );
});

test("renders a follow-up response into the document", () => {
  const document = { openCalled: false, html: "", open() { this.openCalled = true; }, write(html) { this.html = html; }, close() {} };
  renderLoginResponse(document, "<form id=\"pwdForceMdyForm\">重設密碼</form>");
  assert.equal(document.openCalled, true);
  assert.match(document.html, /pwdForceMdyForm/);
});