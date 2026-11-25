/**
 * 网页版适配层：把小游戏用到的 wx.* 接口"翻译"成浏览器里的东西
 * （画布、触摸、图片、存储、音频）。游戏代码本身一行不用改。
 */
(function () {
  var canvas = document.getElementById('game');
  var listeners = { touchstart: [], touchmove: [], touchend: [], touchcancel: [] };
  var activeId = null;

  /* ---------- 尺寸：手机上铺满全屏；电脑/平板上居中成一个竖屏的"手机屏" ---------- */
  function layout() {
    var w = window.innerWidth, h = window.innerHeight;
    var cw = Math.min(w, Math.floor(h * 0.5625), 480);
    canvas.style.width = cw + 'px';
    canvas.style.height = h + 'px';
    canvas.style.left = Math.max(0, Math.floor((w - cw) / 2)) + 'px';
  }
  layout();

  /* ---------- 触摸：Pointer 事件 → wx.onTouch* ---------- */
  function pt(e) {
    var r = canvas.getBoundingClientRect();
    return { identifier: e.pointerId, clientX: e.clientX - r.left, clientY: e.clientY - r.top,
             pageX: e.clientX - r.left, pageY: e.clientY - r.top };
  }
  function fire(name, e) {
    var t = pt(e);
    var ev = { touches: (name === 'touchend' || name === 'touchcancel') ? [] : [t], changedTouches: [t], timeStamp: e.timeStamp };
    for (var i = 0; i < listeners[name].length; i++) {
      try { listeners[name][i](ev); } catch (err) { console.error(err); }
    }
  }
  canvas.addEventListener('pointerdown', function (e) {
    if (activeId !== null) return;
    activeId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件会报错，忽略 */ }
    e.preventDefault();
    fire('touchstart', e);
    unlockAudio();
  });
  canvas.addEventListener('pointermove', function (e) { if (e.pointerId === activeId) fire('touchmove', e); });
  canvas.addEventListener('pointerup', function (e) {
    if (e.pointerId !== activeId) return;
    activeId = null; fire('touchend', e); unlockAudio();
  });
  canvas.addEventListener('pointercancel', function (e) {
    if (e.pointerId !== activeId) return;
    activeId = null; fire('touchcancel', e);
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  // 不让页面滚动 / 回弹 / 双指缩放
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  /* ---------- 音频：iOS / 微信里必须在用户手势里 resume ---------- */
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctxs = [];
  function unlockAudio() {
    for (var i = 0; i < ctxs.length; i++) {
      if (ctxs[i].state === 'suspended') { try { ctxs[i].resume(); } catch (err) { /* 忽略 */ } }
    }
  }
  window.addEventListener('touchend', unlockAudio, { passive: true });
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { for (var i = 0; i < ctxs.length; i++) { try { ctxs[i].suspend(); } catch (err) { /* 忽略 */ } } }
    else unlockAudio();
  });

  /* ---------- wx 对象 ---------- */
  var ua = navigator.userAgent;
  window.wx = {
    createCanvas: function () { return canvas; },
    getSystemInfoSync: function () {
      var r = canvas.getBoundingClientRect();
      return {
        windowWidth: Math.round(r.width), windowHeight: Math.round(r.height),
        screenWidth: window.innerWidth, screenHeight: window.innerHeight,
        pixelRatio: Math.min(window.devicePixelRatio || 2, 2),   // 手机上 3 倍屏太吃力，2 倍够清楚
        platform: /iPhone|iPad|iPod/.test(ua) ? 'ios' : (/Android/.test(ua) ? 'android' : 'devtools'),
        statusBarHeight: 0, language: 'zh_CN', SDKVersion: '3.0.0', version: '8.0.0'
      };
    },
    createImage: function () { return new Image(); },
    setKeepScreenOn: function (o) {
      try { if (o && o.keepScreenOn && navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen'); } catch (err) { /* 忽略 */ }
    },
    setStorageSync: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (err) { /* 忽略 */ } },
    getStorageSync: function (k) {
      try { var v = localStorage.getItem(k); return v == null ? '' : JSON.parse(v); } catch (err) { return ''; }
    },
    createWebAudioContext: function () {
      if (!AC) return null;
      var c = new AC(); ctxs.push(c); return c;
    },
    onTouchStart: function (cb) { listeners.touchstart.push(cb); },
    onTouchMove: function (cb) { listeners.touchmove.push(cb); },
    onTouchEnd: function (cb) { listeners.touchend.push(cb); },
    onTouchCancel: function (cb) { listeners.touchcancel.push(cb); }
    // 故意不提供 createInnerAudioContext：没有 mp3 时游戏会自动用八音盒
  };

  /* ---------- 横竖屏切换：画面比例变了就重新开始加载（已拆过的礼物会记住） ---------- */
  var landscape = window.innerWidth > window.innerHeight;
  window.addEventListener('orientationchange', function () {
    setTimeout(function () {
      if ((window.innerWidth > window.innerHeight) !== landscape) location.reload();
    }, 400);
  });
})();
