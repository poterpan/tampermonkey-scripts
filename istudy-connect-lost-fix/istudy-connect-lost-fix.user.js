// ==UserScript==
// @name         NTUT iStudy connect_lost 修復
// @namespace    https://github.com/poterpan/tampermonkey-scripts/istudy-connect-lost-fix
// @version      1.3.0
// @description  修復 NTUT iStudy (istudy.ntut.edu.tw) 登入後偶發的 "connect lost" 錯誤：自動清除 iStudy 殘留的 session cookie 並重新登入。30 秒內僅重試一次以避免無限迴圈。
// @author       PoterPan
// @match        https://istudy.ntut.edu.tw/login2.php*
// @run-at       document-start
// @grant        GM.cookie
// @grant        GM_cookie
// @icon         https://istudy.ntut.edu.tw/base/10001/door/tpl/icon.ico
// @homepageURL  https://github.com/poterpan/tampermonkey-scripts
// @supportURL   https://github.com/poterpan/tampermonkey-scripts/issues
// @updateURL    https://raw.githubusercontent.com/poterpan/tampermonkey-scripts/main/istudy-connect-lost-fix/istudy-connect-lost-fix.user.js
// @downloadURL  https://raw.githubusercontent.com/poterpan/tampermonkey-scripts/main/istudy-connect-lost-fix/istudy-connect-lost-fix.user.js
// @license      MIT
// ==/UserScript==

(() => {
    'use strict';

    const MARKER = 'connect lost';
    const LOST_PATH = 'connect_lost.php';
    const GUARD_KEY = 'ntut_istudy_fix_last_retry';
    const GUARD_WINDOW_MS = 30_000;
    const TARGET_DOMAIN = 'istudy.ntut.edu.tw';

    let recovered = false;

    const shouldRetry = () => {
        try {
            const last = parseInt(sessionStorage.getItem(GUARD_KEY) || '0', 10);
            return Date.now() - last > GUARD_WINDOW_MS;
        } catch (_) { return true; }
    };

    const markRetry = () => {
        try { sessionStorage.setItem(GUARD_KEY, String(Date.now())); } catch (_) {}
    };

    // 只清 istudy.ntut.edu.tw 這個 exact host 的 cookie，
    // 不動 parent domain ntut.edu.tw 上共享給其他服務（如 app.ntut.edu.tw）的 SSO cookie
    async function cleanPollution() {
        if (typeof GM === 'undefined' || !GM.cookie || !GM.cookie.list) {
            console.error('[istudy-fix] 此 userscript 管理器不支援 GM.cookie，無法清除 HttpOnly cookie');
            return false;
        }
        let all;
        try {
            all = await GM.cookie.list({ url: 'https://istudy.ntut.edu.tw/' });
        } catch (e) {
            console.error('[istudy-fix] GM.cookie.list 失敗:', e);
            return false;
        }

        const targets = all.filter(c => c.domain === TARGET_DOMAIN);
        const preserved = all.filter(c => c.domain !== TARGET_DOMAIN);

        console.groupCollapsed('[istudy-fix] 清除 cookie');
        console.info('清除 %d 顆 (exact=%s):', targets.length, TARGET_DOMAIN);
        console.table(targets.map(c => ({ name: c.name, domain: c.domain, path: c.path, value: String(c.value).slice(0, 40) })));
        console.info('保留 %d 顆 (parent domain 共享，不動):', preserved.length);
        console.table(preserved.map(c => ({ name: c.name, domain: c.domain, path: c.path })));
        console.groupEnd();

        for (const c of targets) {
            try {
                await GM.cookie.delete({ name: c.name, domain: c.domain, path: c.path });
            } catch (e) {
                console.warn('[istudy-fix] 清除失敗', c.name, e);
            }
        }
        return true;
    }

    function overlay(msg) {
        try {
            const existing = document.getElementById('istudy-fix-overlay');
            if (existing) { existing.textContent = msg; return; }
            const div = document.createElement('div');
            div.id = 'istudy-fix-overlay';
            div.textContent = msg;
            div.style.cssText = [
                'position:fixed', 'inset:0', 'background:#fff', 'z-index:2147483647',
                'display:flex', 'align-items:center', 'justify-content:center',
                'font:14px/1.5 -apple-system,system-ui,sans-serif', 'color:#444',
                'padding:24px', 'text-align:center',
            ].join(';');
            (document.body || document.documentElement).appendChild(div);
        } catch (_) {}
    }

    async function recover(reason) {
        if (recovered) return;
        recovered = true;

        if (!shouldRetry()) {
            console.warn('[istudy-fix] %s 觸發，但 30 秒內已重試過，放行原本流程避免迴圈', reason);
            return;
        }
        markRetry();

        try { window.stop(); } catch (_) {}
        overlay('偵測到 iStudy session 異常，清除中…');

        await cleanPollution();

        console.info('[istudy-fix] %s → 清除完成，重新載入', reason);
        overlay('清除完成，重新載入中…');
        location.reload();
    }

    // (1) 攔截 login2.php 原始腳本導向 connect_lost.php
    const wrapNav = (loc, method) => {
        try {
            const orig = loc[method].bind(loc);
            loc[method] = function (url, ...rest) {
                if (typeof url === 'string' && url.includes(LOST_PATH)) {
                    recover('location.' + method);
                    return;
                }
                return orig(url, ...rest);
            };
        } catch (_) {}
    };
    wrapNav(window.location, 'replace');
    wrapNav(window.location, 'assign');
    try {
        if (window.parent && window.parent !== window) {
            wrapNav(window.parent.location, 'replace');
            wrapNav(window.parent.location, 'assign');
        }
    } catch (_) {}

    // (2) DOM observer 偵測 body 裡的 "connect lost" 字樣
    const observer = new MutationObserver(() => {
        if (recovered) { observer.disconnect(); return; }
        const text = document.body && document.body.textContent;
        if (text && text.toLowerCase().includes(MARKER)) {
            observer.disconnect();
            recover('DOM marker');
        }
    });

    const attach = () => {
        if (document.documentElement) {
            observer.observe(document.documentElement, { childList: true, subtree: true });
        } else {
            setTimeout(attach, 0);
        }
    };
    attach();

    // (3) 兜底：onload 時再檢查一次
    window.addEventListener('load', () => {
        if (recovered) return;
        const text = document.body && document.body.textContent;
        if (text && text.toLowerCase().includes(MARKER)) {
            recover('onload fallback');
        }
    }, { once: true });
})();
