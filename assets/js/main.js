/* Ritish Soechit — site interactions
   GSAP + ScrollTrigger + Lenis. Everything degrades to a readable page without JS
   and switches off for prefers-reduced-motion. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var mqDesk = window.matchMedia('(min-width: 961px)');

  /* ---------- scroll position: new pages start at the top, Back returns to where you were ---------- */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  var navEntry = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
  var isBackNav = navEntry.type === 'back_forward';
  var posKey = 'rs-pos:' + location.pathname;
  function readPos() { try { return +sessionStorage.getItem(posKey) || 0; } catch (e) { return 0; } }
  function savePos() { try { sessionStorage.setItem(posKey, String(Math.round(window.scrollY))); } catch (e) {} }
  var restoreY = isBackNav ? readPos() : 0;
  var wantTop = !isBackNav && !(location.hash && location.hash.length > 1);
  if (wantTop) window.scrollTo(0, 0);
  window.addEventListener('pagehide', savePos);
  var userScrolled = false;
  ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { userScrolled = true; }, { once: true, passive: true }); });
  window.__rsRestore = function (scroller) {
    if (isBackNav && restoreY > 0) scroller(restoreY);
    else if (wantTop) scroller(0);
  };

  /* ---------- page transition curtain ---------- */
  var curtain = $('.curtain');
  function store(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} }
  if (doc.classList.contains('arriving') && curtain && !reduce) {
    curtain.style.transform = 'scaleY(1)';
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      curtain.style.transform = ''; curtain.classList.add('reveal');
      setTimeout(function () { curtain.classList.remove('reveal'); doc.classList.remove('arriving'); }, 800);
    }); });
  }
  if (reduce || !curtain) doc.classList.remove('arriving');
  store('rs-curtain', null);
  window.addEventListener('pageshow', function (e) { if (e.persisted && curtain) { curtain.className = 'curtain'; curtain.style.transform = ''; doc.classList.remove('arriving'); } });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-transition]');
    if (!a || reduce || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    e.preventDefault();
    savePos();
    store('rs-curtain', '1');
    curtain.classList.add('cover');
    setTimeout(function () { window.location.href = a.href; }, 520);
  });

  /* ---------- nav ---------- */
  var nav = $('#nav');
  var toggle = nav && $('.nav-toggle', nav);
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }); });
  }

  /* ---------- copy email ---------- */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-copy'), msg = $('#copied');
      function done(t) { if (msg) msg.textContent = t; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v).then(function () { done('Email copied to clipboard.'); }, function () { selectEmail(); done('Press Ctrl+C or ⌘C to copy.'); });
      } else { selectEmail(); done('Press Ctrl+C or ⌘C to copy.'); }
    });
  });
  function selectEmail() { var o = $('#email'); if (!o) return; var r = document.createRange(); r.selectNodeContents(o); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }

  /* ---------- reveal on view ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) {
    en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }) : null;
  $$('[data-reveal]').forEach(function (el) { io ? io.observe(el) : el.classList.add('in'); });

  /* ---------- counters ---------- */
  function fmt(n, comma) { n = Math.round(n); return comma ? n.toLocaleString('en-US') : String(n); }
  var cio = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) {
    en.forEach(function (x) {
      if (!x.isIntersecting) return;
      cio.unobserve(x.target);
      var el = x.target, end = +el.getAttribute('data-count'), comma = el.getAttribute('data-format') === 'comma';
      if (reduce) { el.textContent = fmt(end, comma); return; }
      var t0 = performance.now(), dur = 1600;
      (function step(t) { var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(end * e, comma); if (p < 1) requestAnimationFrame(step); })(t0);
    });
  }, { threshold: 0.6 }) : null;
  $$('[data-count]').forEach(function (el) { if (cio) { el.textContent = '0'; cio.observe(el); } });


  /* ---------- lightbox: one viewer for photographs and project visuals ---------- */
  function bestSrc(img) {
    var best = null, bw = 0;
    (img.getAttribute('srcset') || '').split(',').forEach(function (c) {
      var m = c.trim().match(/^(\S+)\s+(\d+)w$/); if (m && +m[2] > bw) { bw = +m[2]; best = m[1]; }
    });
    return best || img.currentSrc || img.src;
  }
  var LB = (function () {
    var box = null, bg, stage, img, cap, cnt, bPrev, bNext, bClose, items = [], idx = 0, origin = null, opener = null, busy = false, isOpen = false;
    var G = function () { return window.gsap || null; };
    function build() {
      box = document.createElement('div'); box.className = 'lbx'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Image viewer');
      box.innerHTML = '<div class="lbx-bg"></div><div class="lbx-count" aria-live="polite"></div>' +
        '<button type="button" class="lbx-btn lbx-close" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
        '<div class="lbx-stage"><img class="lbx-img" alt=""></div>' +
        '<button type="button" class="lbx-btn lbx-prev" aria-label="Previous image"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
        '<button type="button" class="lbx-btn lbx-next" aria-label="Next image"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>' +
        '<div class="lbx-meta"></div>';
      document.body.appendChild(box);
      bg = $('.lbx-bg', box); stage = $('.lbx-stage', box); img = $('.lbx-img', box); cap = $('.lbx-meta', box); cnt = $('.lbx-count', box);
      bPrev = $('.lbx-prev', box); bNext = $('.lbx-next', box); bClose = $('.lbx-close', box);
      bClose.addEventListener('click', close);
      bPrev.addEventListener('click', function () { go(-1); });
      bNext.addEventListener('click', function () { go(1); });
      stage.addEventListener('click', function (e) { if (e.target === stage && !dragged) close(); });
      bg.addEventListener('click', close);
      document.addEventListener('keydown', function (e) {
        if (!isOpen) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        else if (e.key === 'Tab') { // keep focus inside the viewer
          var f = [bClose, bPrev, bNext].filter(function (b) { return !b.hidden; }), i = f.indexOf(document.activeElement);
          e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
      });
      // swipe: the image follows the finger, a short flick moves on
      var x0 = 0, y0 = 0, dx = 0, tracking = false, dragged = false, pid = null;
      stage.addEventListener('pointerdown', function (e) {
        if (busy || e.button > 0) return; tracking = true; dragged = false; pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = 0;
      });
      stage.addEventListener('pointermove', function (e) {
        if (!tracking || e.pointerId !== pid) return; dx = e.clientX - x0;
        if (!dragged && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - y0)) { dragged = true; try { stage.setPointerCapture(pid); } catch (er) {} }
        if (dragged && items.length > 1) { img.style.transform = 'translateX(' + dx + 'px)'; img.style.opacity = String(1 - Math.min(.5, Math.abs(dx) / 600)); }
      });
      function endDrag() {
        if (!tracking) return; tracking = false;
        if (!dragged) return;
        if (items.length > 1 && Math.abs(dx) > 60) go(dx < 0 ? 1 : -1, dx);
        else { var g = G(); if (g) g.to(img, { x: 0, opacity: 1, duration: .35, ease: 'power3.out', onComplete: function () { img.style.transform = ''; } }); else { img.style.transform = ''; img.style.opacity = ''; } }
        setTimeout(function () { dragged = false; }, 0);
      }
      stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
    }
    function meta(it) {
      cap.innerHTML = '';
      if (it.title) { var b = document.createElement('b'); b.textContent = it.title; cap.appendChild(b); }
      if (it.text) { var t = document.createElement('span'); t.textContent = it.text; cap.appendChild(t); }
      cnt.textContent = items.length > 1 ? (idx + 1) + ' / ' + items.length : '';
      bPrev.hidden = bNext.hidden = items.length < 2;
      img.alt = it.alt || it.title || '';
    }
    function load(src) { return new Promise(function (res) { var im = new Image(); im.decoding = 'async'; im.onload = im.onerror = function () { (im.decode ? im.decode().catch(function () {}) : Promise.resolve()).then(function () { res(im); }); }; im.src = src; }); }
    function preload(i) { var it = items[(i + items.length) % items.length]; if (it && !it.warm) { it.warm = true; var im = new Image(); im.src = it.src; } }
    function rectOf(el) { if (!el) return null; var r = el.getBoundingClientRect(); return (r.width > 4 && r.bottom > 0 && r.top < innerHeight) ? r : null; }
    function open(list, start, from) {
      if (!list.length) return;
      if (!box) build();
      items = list; idx = Math.max(0, Math.min(start || 0, list.length - 1)); opener = document.activeElement; origin = from || null;
      var it = items[idx]; meta(it);
      isOpen = true; busy = true; doc.classList.add('lbx-lock'); if (window.__lenis) window.__lenis.stop();
      box.classList.add('open');
      var g = G(), thumb = it.thumb || it.src;
      img.style.transform = ''; img.style.opacity = '';
      img.src = thumb; // show what is already on screen at once, sharpen when the full file is ready
      function settle() {
        busy = false; bClose.focus({ preventScroll: true });
        if (thumb !== it.src) load(it.src).then(function () { if (items[idx] === it) img.src = it.src; });
        preload(idx + 1); preload(idx - 1);
      }
      var start0 = function () {
        var r = rectOf(origin && (origin.querySelector('img') || origin)), to = img.getBoundingClientRect();
        if (!g || reduce) { if (g) g.set(bg, { opacity: 1 }); else bg.style.opacity = 1; settle(); return; }
        g.fromTo(bg, { opacity: 0 }, { opacity: 1, duration: .45, ease: 'power2.out' });
        if (r && to.width) {
          g.fromTo(img, { x: r.left - to.left, y: r.top - to.top, scaleX: r.width / to.width, scaleY: r.height / to.height, opacity: .6 },
            { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: .65, ease: 'expo.out', onComplete: function () { g.set(img, { clearProps: 'transform' }); settle(); } });
        } else {
          g.fromTo(img, { scale: .94, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'power3.out', onComplete: function () { g.set(img, { clearProps: 'transform' }); settle(); } });
        }
      };
      if (img.complete && img.naturalWidth) requestAnimationFrame(start0); else { img.onload = function () { img.onload = null; start0(); }; }
    }
    function go(d, fromDx) {
      if (busy || items.length < 2) return; busy = true;
      idx = (idx + d + items.length) % items.length;
      var it = items[idx], g = G(), dir = d > 0 ? 1 : -1;
      var out = g && !reduce ? new Promise(function (res) { g.to(img, { x: -dir * 60 + (fromDx || 0) * 0, opacity: 0, duration: .22, ease: 'power2.in', onComplete: res }); }) : Promise.resolve();
      Promise.all([out, load(it.src)]).then(function () {
        if (items[idx] !== it) { busy = false; return; }
        img.src = it.src; meta(it);
        if (g && !reduce) g.fromTo(img, { x: dir * 60, opacity: 0 }, { x: 0, opacity: 1, duration: .42, ease: 'power3.out', onComplete: function () { g.set(img, { clearProps: 'transform' }); busy = false; } });
        else { img.style.transform = ''; img.style.opacity = ''; busy = false; }
        preload(idx + 1); preload(idx - 1);
      });
    }
    function close() {
      if (!isOpen) return; isOpen = false;
      var g = G(), it = items[idx], back = it && it.el ? it.el() : null, r = rectOf(back), to = img.getBoundingClientRect();
      function done() {
        box.classList.remove('open'); img.removeAttribute('src'); img.style.transform = ''; img.style.opacity = ''; bg.style.opacity = '';
        doc.classList.remove('lbx-lock'); if (window.__lenis) window.__lenis.start(); busy = false;
        if (opener && opener.focus) opener.focus({ preventScroll: true });
      }
      if (!g || reduce) { done(); return; }
      busy = true;
      g.to(bg, { opacity: 0, duration: .4, ease: 'power2.inOut' });
      if (r && to.width) g.to(img, { x: r.left - to.left, y: r.top - to.top, scaleX: r.width / to.width, scaleY: r.height / to.height, opacity: .4, duration: .5, ease: 'power3.inOut', onComplete: done });
      else g.to(img, { scale: .94, opacity: 0, duration: .32, ease: 'power2.in', onComplete: done });
    }
    return { open: open, isOpen: function () { return isOpen; } };
  })();
  window.RSLightbox = LB;

  /* ---------- photo direction fan ---------- */
  var fan = $('#fan');
  if (fan) {
    var sets = JSON.parse(fan.getAttribute('data-sets'));
    var root = fan.getAttribute('data-root') || '';
    var tabs = $$('.fan-tabs button');
    var cards = $$('.fan-card', fan);
    var cur = 0, timer = null;
    function srcset(n) { return [480, 960, 1103].map(function (w) { return root + 'assets/img/' + n + '-' + w + '.webp ' + w + 'w'; }).join(', '); }
    function place() {
      var w = fan.clientWidth, small = w < 640;
      cards.forEach(function (c) {
        var p = +c.getAttribute('data-pos');
        var x = p * (small ? 0.34 : 0.27) * w, rot = p * -16, z = Math.abs(p) * -180, sc = p === 0 ? 1 : 0.86;
        c.style.transform = 'translate(-50%,-50%) translateX(' + x + 'px) translateZ(' + z + 'px) rotateY(' + rot + 'deg) scale(' + sc + ')';
        c.style.zIndex = p === 0 ? 5 : 3;
        c.style.filter = p === 0 ? 'none' : 'saturate(.85) brightness(.96)';
        c.className = 'fan-card ' + (p === 0 ? 'c0' : p > 0 ? 'c1' : 'cm1');
      });
    }
    function show(i, user) {
      cur = (i + sets.length) % sets.length;
      var s = sets[cur];
      tabs.forEach(function (t, k) { t.classList.toggle('on', k === cur); t.setAttribute('aria-selected', k === cur ? 'true' : 'false'); });
      cards.forEach(function (c, k) {
        var img = $('img', c), n = s.imgs[[0, 1, 2][k]];
        var next = new Image(); next.sizes = img.sizes || '(min-width: 900px) 30vw, 60vw'; next.srcset = srcset(n); next.src = root + 'assets/img/' + n + '-960.webp';
        var ready = next.decode ? next.decode().catch(function () {}) : Promise.resolve();
        c.style.opacity = '0';
        Promise.all([ready, new Promise(function (r) { setTimeout(r, 260 + k * 70); })]).then(function () {
          if (cur !== sets.indexOf(s)) return;
          img.srcset = next.srcset; img.src = next.src; img.alt = 'Photo direction: with ' + s.k + ', ' + s.d;
          var cap = $('figcaption', c); cap.innerHTML = '<b>With ' + s.k + '</b>' + s.d;
          c.style.opacity = '1';
        });
      });
      if (user) restart();
    }
    function restart() { clearInterval(timer); if (!reduce) timer = setInterval(function () { if (fanVisible) show(cur + 1); }, 5200); }
    var fanVisible = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { fanVisible = e[0].isIntersecting; }, { threshold: 0.3 }).observe(fan);
    // warm the other sets before they're needed, so swaps never flash
    if ('IntersectionObserver' in window) { var warmIO = new IntersectionObserver(function (e) {
      if (!e[0].isIntersecting) return; warmIO.disconnect();
      sets.forEach(function (st) { st.imgs.forEach(function (n) { var im = new Image(); im.decoding = 'async'; im.src = root + 'assets/img/' + n + (innerWidth < 640 ? '-480' : '-960') + '.webp'; }); });
    }, { rootMargin: '600px 0px' }); warmIO.observe(fan); }
    tabs.forEach(function (t, k) { t.addEventListener('click', function () { show(k, true); }); });
    function fanItems() {
      var out = [];
      sets.forEach(function (st, si) { st.imgs.forEach(function (n, k) {
        out.push({ src: root + 'assets/img/' + n + '-1103.webp', thumb: si === cur ? $('img', cards[k]).currentSrc : null,
          title: 'With ' + st.k, text: st.d, alt: 'Photo direction: with ' + st.k + ', ' + st.d,
          el: function () { return cur === si ? cards[k] : null; } });
      }); });
      return out;
    }
    function openFan(c) {
      var k = cards.indexOf(c), base = 0;
      for (var i = 0; i < cur; i++) base += sets[i].imgs.length;
      clearInterval(timer);
      LB.open(fanItems(), base + k, c);
      var wait = setInterval(function () { if (!LB.isOpen()) { clearInterval(wait); restart(); } }, 400);
    }
    function turnTo(c) {
      var p = +c.getAttribute('data-pos'); if (p === 0) return false;
      cards.forEach(function (o) { var q = +o.getAttribute('data-pos') - p; if (q > 1) q = -1; if (q < -1) q = 1; o.setAttribute('data-pos', q); });
      place(); restart(); return true;
    }
    cards.forEach(function (c) {
      c.addEventListener('click', function () { if (!turnTo(c)) openFan(c); });
      c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!turnTo(c)) openFan(c); } });
    });
    fan.addEventListener('mouseenter', function () { clearInterval(timer); });
    fan.addEventListener('mouseleave', function () { if (!LB.isOpen()) restart(); });
    place(); restart();
    window.addEventListener('resize', place);
  }

  /* ---------- project frames: Expand opens the visuals at full size ---------- */
  $$('.proj').forEach(function (el) {
    var view = $('.frame-view', el), btn = $('.frame-open', el); if (!view) return;
    var slides = $$('.slide', view);
    function list() {
      var out = [], first = [];
      slides.forEach(function (sl) {
        first.push(out.length);
        if (sl.querySelector('.goal')) return;
        var capEl = $('figcaption', sl), ttl = $('.frame-bar .ttl', el);
        $$('img', sl).forEach(function (im) {
          out.push({ src: bestSrc(im), thumb: im.currentSrc || im.src, title: ttl ? ttl.textContent : '', text: capEl ? capEl.textContent : (im.alt || ''), alt: im.alt,
            el: function () { return sl.classList.contains('on') ? im : null; } });
        });
      });
      return { items: out, first: first };
    }
    function openFrame() {
      var L = list(), step = +(el.getAttribute('data-step') || 0), i = L.first[step] || 0;
      if (i >= L.items.length) i = 0;
      var on = slides[step], from = on && !on.querySelector('.goal') ? $('img', on) : null;
      LB.open(L.items, i, from);
    }
    if (btn) btn.addEventListener('click', function (e) { e.stopPropagation(); openFrame(); });
    view.addEventListener('click', openFrame);
  });

  /* ---------- back button ---------- */
  $$('[data-back]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var same = false;
      try { same = document.referrer && new URL(document.referrer).origin === location.origin && document.referrer !== location.href; } catch (err) {}
      if (same && history.length > 1) { e.preventDefault(); history.back(); }
    });
  });

  /* ---------- films: poster first, YouTube loads only on play ---------- */
  var warmed = false;
  function warm() {
    if (warmed) return; warmed = true;
    if (sandboxed) return;
    ['https://www.youtube-nocookie.com', 'https://i.ytimg.com', 'https://www.google.com'].forEach(function (h) {
      var l = document.createElement('link'); l.rel = 'preconnect'; l.href = h; l.crossOrigin = ''; document.head.appendChild(l);
    });
  }
  /* Sandboxed previews (e.g. the Claude artifact viewer) block third-party iframes by policy.
     There, a click opens the film on YouTube instead; on the live site it plays inline. */
  var sandboxed = /claudeusercontent\.com$|claude\.ai$|anthropic\.com$/.test(location.hostname);
  if (sandboxed) document.documentElement.classList.add('vid-external');
  function stopAll(except) {
    $$('.vid.playing').forEach(function (v) {
      if (v === except) return;
      var f = $('iframe', v); if (f) f.remove();
      v.classList.remove('playing');
    });
  }
  $$('.vid').forEach(function (v) {
    var btn = $('.vid-btn', v), id = v.getAttribute('data-yt');
    btn.addEventListener('pointerenter', warm, { once: true });
    btn.addEventListener('focus', warm, { once: true });
    btn.addEventListener('click', function () {
      if (sandboxed) { window.open('https://www.youtube.com/watch?v=' + id, '_blank', 'noopener'); return; }
      stopAll(v);
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
      f.title = btn.getAttribute('aria-label').replace('Play film: ', '');
      f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      $('.vid-box', v).appendChild(f);
      v.classList.add('playing');
      setTimeout(function () { f.focus(); }, 300);
    });
  });

  /* ---------- index page: filters + lightbox ---------- */
  var mas = $('#masonry');
  if (mas) {
    var fb = $$('.filters button');
    fb.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-f');
        fb.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        $$('figure', mas).forEach(function (fig) { fig.hidden = !(f === 'all' || fig.getAttribute('data-cat') === f); });
        if (window.ScrollTrigger) ScrollTrigger.refresh();
      });
    });
    var lb = $('#lightbox'), lbImg = $('img', lb), lbCap = $('p', lb), lastFocus = null;
    function openLb(fig) {
      lastFocus = fig; lbImg.src = fig.getAttribute('data-full'); lbImg.alt = fig.getAttribute('data-title'); lbCap.textContent = fig.getAttribute('data-title');
      lb.classList.add('open'); $('button', lb).focus(); if (window.__lenis) window.__lenis.stop();
    }
    function closeLb() { lb.classList.remove('open'); if (window.__lenis) window.__lenis.start(); if (lastFocus) lastFocus.focus(); }
    $$('figure', mas).forEach(function (fig) {
      fig.addEventListener('click', function () { openLb(fig); });
      fig.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLb(fig); } });
    });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.tagName === 'BUTTON') closeLb(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && lb.classList.contains('open')) closeLb(); });
  }

  /* ---------- stepper helpers (projects + systems), work with or without GSAP ---------- */
  function setStep(el, i, kind) {
    if (el.getAttribute('data-step') === String(i)) return;
    el.setAttribute('data-step', i);
    if (kind === 'proj') {
      $$('.slide', el).forEach(function (s, k) { s.classList.toggle('on', k === i); });
      $$('.step', el).forEach(function (s, k) { s.classList.toggle('on', k === i); });
      $$('.proj-rail button', el).forEach(function (s, k) { s.classList.toggle('on', k === i); });
    } else {
      $$('.sys-panel', el).forEach(function (s, k) { s.classList.toggle('on', k === i); });
      $$('.sys-tabs button', el).forEach(function (s, k) { s.classList.toggle('on', k === i); s.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      drawPanel(el, i);
    }
  }
  function drawPanel(el, i) {
    if (!hasGsap || reduce) return;
    var p = $$('.sys-panel', el)[i]; if (!p) return;
    var paths = $$('path', p), nodes = $$('.node, .ui-card tr, .lib > *', p);
    paths.forEach(function (path) { var L = path.getTotalLength ? path.getTotalLength() : 400; gsap.fromTo(path, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.out', delay: 0.1 }); });
    if (nodes.length) gsap.fromTo(nodes, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05, ease: 'power2.out', overwrite: true });
  }

  if (!hasGsap) { window.addEventListener('load', function () { window.__rsRestore(function (y) { window.scrollTo(0, y); }); }); }
  if (!hasGsap) { // basic fallback: steppers by click
    $$('.proj, .systems').forEach(function (el) {
      var kind = el.classList.contains('proj') ? 'proj' : 'sys';
      $$('[data-go]', el).forEach(function (b) { b.addEventListener('click', function () { setStep(el, +b.getAttribute('data-go'), kind); }); });
    });
    return;
  }

  function holdSteps() {
    $$('.proj .steps').forEach(function (st) {
      st.style.minHeight = '';
      if (!mqDesk.matches) return;
      var open = $('.step.on span', st), cur = st.offsetHeight, sh = $$('.step span', st).map(function (sp) { return sp.scrollHeight; });
      var now = open ? open.scrollHeight : 0;
      st.style.minHeight = (cur - now + Math.max.apply(null, sh)) + 'px';
    });
  }
  holdSteps();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(holdSteps);
  window.addEventListener('resize', function () { clearTimeout(holdSteps.t); holdSteps.t = setTimeout(holdSteps, 150); });

  /* ====================== GSAP from here ====================== */
  gsap.registerPlugin(ScrollTrigger);
  var lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  function scrollTo(target, opts) {
    if (lenis) lenis.scrollTo(target, Object.assign({ duration: 1.4 }, opts || {}));
    else { var y = typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY; window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); }
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href'); if (id.length < 2) return;
      var t = document.getElementById(id.slice(1)); if (!t) return;
      e.preventDefault(); scrollTo(t, { offset: 0 });
      history.replaceState(null, '', id);
    });
  });
  // the name in the header always goes back to the very beginning, intro included
  var brandLink = $('.nav .brand');
  if (brandLink && $('#intro')) brandLink.addEventListener('click', function (e) {
    e.preventDefault();
    history.replaceState(null, '', location.pathname + location.search);
    scrollTo(0, { duration: Math.min(2.4, 1 + window.scrollY / (window.innerHeight * 8)) });
  });
  if (location.hash && location.hash.length > 1) {
    var t0 = document.getElementById(location.hash.slice(1));
    if (t0) setTimeout(function () { scrollTo(t0, { immediate: true }); }, 60);
  }

  // nav hide on scroll down, show on scroll up
  if (nav) {
    var lastY = 0;
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (self) {
      var y = self.scroll(), down = y > lastY;
      nav.classList.toggle('is-hidden', down && y > 240 && !nav.classList.contains('open'));
      lastY = y;
    } });
    var map = { work: '#work', systems: '#systems', photo: '#photo', about: '#about' };
    Object.keys(map).forEach(function (k) {
      var sec = $(map[k]), link = $('.nav-links a[href$="' + map[k] + '"]', nav);
      if (!sec || !link) return;
      ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: function (s) { if (s.isActive) $$('.nav-links a', nav).forEach(function (l) { l.removeAttribute('aria-current'); }); if (s.isActive) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current'); } });
    });
  }

  if (reduce) {
    window.addEventListener('load', function () { window.__rsRestore(function (y) { window.scrollTo(0, y); }); });
    $$('.proj, .systems').forEach(function (el) {
      var kind = el.classList.contains('proj') ? 'proj' : 'sys';
      $$('[data-go]', el).forEach(function (b) { b.addEventListener('click', function () { setStep(el, +b.getAttribute('data-go'), kind); }); });
    });
    return;
  }

  /* ---------- intro scroll story ---------- */
  var intro = $('#intro');
  if (intro) (function () {
    var brief = $('#brief'), keyv = $('#keyv'), scan = $('.scan', keyv);
    var fmts = $$('.fmt', intro), rings = $$('#rings i'), finalP = $('#introFinal');
    var tileNum = $('#tileNum'), tileLab = $('#tileLab'), cap = $('#introCap'), stepEl = $('#introStep'), bar = $('#introBar');
    var ringCols = ['#EB7A4B', '#D9623A', '#BC4A2B', '#963520', '#6E2416', '#4A170E', '#2E0F09'];
    rings.forEach(function (r, i) { r.style.background = ringCols[i]; r.style.width = r.style.height = '120px'; });
    var scenes = [
      { n: '01', l: 'Brief', c: '<em>One</em> brief.' },
      { n: '01', l: 'Image', c: '<em>One</em> image.' },
      { n: '250+', l: 'A month', c: '<em>Hundreds</em> of formats.' },
      { n: '1', l: 'System', c: '<em>One</em> system behind it.' }
    ];
    var curScene = -1;
    function setScene(i) {
      if (i === curScene) return; curScene = i;
      var s = scenes[i];
      tileNum.textContent = s.n; tileLab.textContent = s.l; stepEl.textContent = '0' + (i + 1) + ' / 04';
      cap.innerHTML = s.c.replace(/(<em>.*?<\/em>|[^\s<]+)/g, '<span class="w">$1</span>');
      gsap.to($$('.w', cap), { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' });
      gsap.fromTo('.tile', { scale: 0.92 }, { scale: 1, duration: 0.5, ease: 'back.out(2)' });
    }
    setScene(0);

    var small = innerWidth < 700;
    var scatter = [[-36, -20], [-20, -30], [20, -29], [37, -17], [-40, 6], [40, 8], [-30, 27], [-12, 33], [12, 33], [31, 26], [-22, -2], [23, 0]];
    if (small) scatter = scatter.map(function (p) { return [p[0] * 0.95, p[1] * 0.7 + 8]; });
    var useN = small ? 8 : fmts.length;
    fmts.forEach(function (f, i) { if (i >= useN) f.style.display = 'none'; });
    var vw = function (v) { return v * innerWidth / 100; }, vh = function (v) { return v * innerHeight / 100; };

    function gridPos(i) {
      var cols = small ? 4 : 6, rows = Math.ceil(useN / cols);
      var cell = Math.min(small ? 88 : 168, (innerWidth - 40) / cols);
      var c = i % cols, r = Math.floor(i / cols);
      return { x: (c - (cols - 1) / 2) * cell, y: (r - (rows - 1) / 2) * cell * 1.35 + vh(2), s: (cell - (small ? 10 : 22)) / 150 };
    }

    var title = $('#introTitle'), sign = $('#introSign');
    gsap.set(brief, { rotateX: 52, rotateZ: -10, y: vh(8), scale: 0.92, opacity: 0 });
    gsap.set('.intro-hud', { opacity: 0, y: 12 });
    gsap.set(keyv, { y: vh(60), rotateX: 35, opacity: 0, filter: 'brightness(.35) saturate(.2)' });
    gsap.set(fmts, { x: 0, y: 0, scale: 0.2, opacity: 0, rotate: 0 });
    gsap.set(finalP, { opacity: 0, y: 30 });
    gsap.set(rings, { scale: 0 });

    document.documentElement.classList.add('intro-on');
    // tuck the hero under exactly one viewport of the intro, whatever the mobile toolbar is doing
    var heroTuck = $('#top');
    var lvProbe = document.createElement('div');
    lvProbe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
    document.body.appendChild(lvProbe);
    // use the tallest viewport (browser bars hidden) so no strip opens up when mobile toolbars collapse
    function tuck() { if (heroTuck) heroTuck.style.marginTop = (-Math.max(window.innerHeight, lvProbe.offsetHeight)) + 'px'; }
    tuck(); ScrollTrigger.addEventListener('refreshInit', tuck);
    var tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
      trigger: intro, invalidateOnRefresh: true, start: 'top top', end: 'bottom bottom', scrub: 0.8,
      onUpdate: function (self) {
        var p = self.progress; bar.style.transform = 'scaleX(' + p + ')';
        setScene(p < 0.2 ? 0 : p < 0.38 ? 1 : p < 0.6 ? 2 : 3);
        if (p > 0.38 && p < 0.6) tileNum.textContent = Math.max(1, Math.round(250 * gsap.utils.clamp(0, 1, (p - 0.38) / 0.2))) + (p > 0.57 ? '+' : '');
      }
    } });
    // 0 → 0.9 : title card lifts away, brief settles in behind it
    tl.to(title, { opacity: 0, y: -vh(10), scale: 0.96, duration: 0.9, ease: 'power2.in' }, 0);
    tl.to('.intro-hud', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0.7);
    tl.to(brief, { opacity: 1, duration: 0.6 }, 0.45);
    tl.to(brief, { rotateX: 18, rotateZ: -4, y: 0, scale: 1, duration: 1.4, ease: 'power1.out' }, 0.45);
    // 1.8 → 3.6 : brief exits, key visual develops
    tl.to(brief, { x: -vw(46), y: vh(18), rotateZ: -24, rotateX: 40, opacity: 0, duration: 1.6, ease: 'power2.in' }, 1.8);
    tl.to(keyv, { y: 0, rotateX: 0, opacity: 1, duration: 1.4, ease: 'power2.out' }, 2.0);
    tl.fromTo(scan, { top: '-20%' }, { top: '110%', duration: 1.4 }, 2.4);
    tl.to(keyv, { filter: 'brightness(1) saturate(1)', duration: 1.2 }, 2.5);
    // 3.9 → 6.0 : formats multiply
    tl.to(keyv, { scale: small ? 0.7 : 0.78, duration: 1.4 }, 3.9);
    fmts.slice(0, useN).forEach(function (f, i) {
      var p = scatter[i % scatter.length];
      tl.to(f, { x: vw(p[0]), y: vh(p[1]), scale: small ? 0.62 : 0.9, opacity: 1, rotate: (i % 2 ? 1 : -1) * (4 + (i % 4)), duration: 1.6, ease: 'power3.out' }, 3.9 + i * 0.07);
    });
    // 6.4 → 8.2 : snap into a system
    tl.to(keyv, { scale: 0.3, opacity: 0, duration: 1.0, ease: 'power2.in' }, 6.4);
    fmts.slice(0, useN).forEach(function (f, i) {
      var g = gridPos(i);
      tl.to(f, { x: g.x, y: g.y, scale: g.s, rotate: 0, duration: 1.4, ease: 'power3.inOut' }, 6.5 + i * 0.03);
    });
    tl.to($$('.code', intro), { opacity: 1, duration: 0.6, stagger: 0.03 }, 7.6);
    // 8.6 → 10.6 : resolve into the line, then open into the hero
    tl.to(fmts.slice(0, useN), { opacity: 0, scale: '-=0.15', duration: 0.8, stagger: 0.02, ease: 'power2.in' }, 8.6);
    tl.to('.intro-hud', { opacity: 0, y: -20, duration: 0.6 }, 8.6);
    tl.to(finalP, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 9.4);
    tl.to(sign, { opacity: 1, duration: 0.8 }, 9.9);
    rings.forEach(function (r, i) { tl.to(r, { scale: (innerWidth > innerHeight ? innerWidth : innerHeight) / 120 * (3.4 - i * 0.22), duration: 1.8, ease: 'power2.in' }, 10.2 + i * 0.08); });
    tl.to(finalP, { color: '#FFF4EE', duration: 0.8 }, 10.6);
    tl.to($('em', finalP), { color: '#FFB38C', duration: 0.8 }, 10.6);
    tl.to(sign, { color: 'rgba(255,244,238,.75)', duration: 0.8 }, 10.6);
    // 11.9 → 12.9 : hand-off. The hero already sits underneath the last screen of the intro
    // (see .intro-on .hero), so the stage dissolves straight into it: no blank frames, no jump.
    var heroH1 = $('#top h1'), stage = $('.intro-stage', intro), heroEl = $('#top');
    // the intro line glides onto the hero headline, tracking it live, then the two cross-dissolve
    // mirror the hero headline's line breaks so the two lines overlay exactly at any width
    function words(el) {
      var out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { var n = w.currentNode, re = /\S+/g, m; while ((m = re.exec(n.data))) out.push([n, m.index, m.index + m[0].length]); }
      return out;
    }
    function matchWrap() {
      if (!heroH1) return;
      $$('br.hb', finalP).forEach(function (b) { b.remove(); });
      finalP.normalize();
      var hw = words(heroH1), breaks = [], lastTop = null;
      hw.forEach(function (x, i) {
        var r = document.createRange(); r.setStart(x[0], x[1]); r.setEnd(x[0], x[2]);
        var t = Math.round(r.getBoundingClientRect().top);
        if (lastTop !== null && t > lastTop + 4) breaks.push(i);
        lastTop = t;
      });
      var fw = words(finalP);
      breaks.slice().reverse().forEach(function (i) {
        var x = fw[i]; if (!x) return;
        var rest = x[0].splitText(x[1]), br = document.createElement('br'); br.className = 'hb';
        rest.parentNode.insertBefore(br, rest);
      });
    }
    matchWrap(); ScrollTrigger.addEventListener('refresh', matchWrap);
    var hand = { t: 0 };
    function applyHand() {
      if (!heroH1) return;
      var t = hand.t, cy = Number(gsap.getProperty(finalP, 'y')) || 0;
      var fr = finalP.getBoundingClientRect(), r = heroH1.getBoundingClientRect();
      var shift = (r.top + r.height / 2) - (fr.top + fr.height / 2 - cy);
      var sc = parseFloat(getComputedStyle(heroH1).fontSize) / parseFloat(getComputedStyle(finalP).fontSize);
      gsap.set(finalP, { y: shift * t, scale: 1 + (sc - 1) * t });
    }
    tl.to(sign, { opacity: 0, duration: 0.35 }, 11.9);
    // taps belong to the intro until it starts dissolving, then to the hero underneath
    var root = document.documentElement, skipBtn = $('#skipIntro');
    tl.eventCallback('onUpdate', function () {
      var handed = tl.time() >= 12.4;
      root.classList.toggle('intro-handed', handed);
      if (skipBtn) skipBtn.classList.toggle('off', tl.time() >= 11.9);
    });
    tl.to(hand, { t: 1, duration: 1.0, ease: 'power2.inOut', onUpdate: applyHand }, 11.95);
    tl.to(stage, { opacity: 0, duration: 0.5, ease: 'power1.inOut' }, 12.45);
    tl.set(stage, { visibility: 'hidden' }, 12.96);

    $('#skipIntro').addEventListener('click', function () { scrollTo($('#top')); });
  })();

  /* ---------- hero ---------- */
  var hero = $('#top');
  if (hero) {
    var lines = $$('.hero h1 .ln > span');
    if (document.documentElement.classList.contains('intro-on')) lines = [];
    if (lines.length) gsap.set(lines, { yPercent: 105 });
    gsap.set('.hero .sub, .hero .hero-ctas, .hero-pill', { opacity: 0, y: 18 });
    ScrollTrigger.create({ trigger: hero, start: 'top 75%', once: true, onEnter: function () {
      if (lines.length) gsap.to(lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.08 });
      gsap.to('.hero-pill, .hero .sub, .hero .hero-ctas', { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.12, delay: 0.25 });
    } });
    gsap.to('.hero-bg', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.fromTo('#board', { y: 120, rotateX: 14, scale: 0.94 }, { y: 0, rotateX: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: hero, start: 'top 60%', end: 'bottom bottom', scrub: 0.8 } });
    var ticks = $$('#board .tick'), items = $$('#board .board-side li');
    ScrollTrigger.create({ trigger: '#board', start: 'top 80%', once: true, onEnter: function () {
      ticks.forEach(function (t, i) { setTimeout(function () { t.classList.add('done'); items.forEach(function (li, k) { li.classList.toggle('on', k === i); }); }, 300 + i * 420); });
    } });
  }

  /* ---------- pinned projects ---------- */
  $$('.proj.pinnable').forEach(function (el) {
    var st = ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom bottom',
      onUpdate: function (s) { if (mqDesk.matches) setStep(el, Math.min(2, Math.floor(s.progress * 3)), 'proj'); } });
    $$('[data-go]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.getAttribute('data-go');
        if (!mqDesk.matches) { setStep(el, i, 'proj'); return; }
        var y = st.start + (st.end - st.start) * ((i + 0.5) / 3);
        scrollTo(y);
      });
    });
    gsap.fromTo($('.frame', el), { y: 60, rotateX: 8, opacity: 0.6 }, { y: 0, rotateX: 0, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 85%', end: 'top 20%', scrub: 0.6 } });
  });

  /* ---------- systems ---------- */
  var sys = $('#systems');
  if (sys) {
    var sst = ScrollTrigger.create({ trigger: sys, start: 'top top', end: 'bottom bottom',
      onUpdate: function (s) { if (mqDesk.matches) setStep(sys, Math.min(3, Math.floor(s.progress * 4)), 'sys'); } });
    ScrollTrigger.create({ trigger: sys, start: 'top 60%', once: true, onEnter: function () { drawPanel(sys, 0); } });
    $$('.sys-panel', sys).forEach(function (pn, i) {
      if (i === 0) return;
      if (!mqDesk.matches) gsap.set($$('.node, .ui-card tr, .lib > *', pn), { opacity: 0, y: 10 });
      ScrollTrigger.create({ trigger: pn, start: 'top 72%', once: true, onEnter: function () { if (!mqDesk.matches) drawPanel(sys, i); } });
    });
    $$('[data-go]', sys).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.getAttribute('data-go');
        if (!mqDesk.matches) { setStep(sys, i, 'sys'); return; }
        scrollTo(sst.start + (sst.end - sst.start) * ((i + 0.5) / 4));
      });
    });
  }

  /* ---------- marquee ---------- */
  $$('[data-marquee]').forEach(function (row) {
    row.innerHTML += row.innerHTML;
    var dir = row.getAttribute('data-marquee') === 'right' ? 1 : -1;
    var tw = gsap.fromTo(row, { xPercent: dir < 0 ? 0 : -50 }, { xPercent: dir < 0 ? -50 : 0, duration: 70, ease: 'none', repeat: -1 });
    row.addEventListener('mouseenter', function () { gsap.to(tw, { timeScale: 0.15, duration: 0.6 }); });
    row.addEventListener('mouseleave', function () { gsap.to(tw, { timeScale: 1, duration: 0.6 }); });
    ScrollTrigger.create({ trigger: row, start: 'top bottom', end: 'bottom top', onToggle: function (s) { s.isActive ? tw.play() : tw.pause(); } });
  });

  /* ---------- small parallax touches ---------- */
  var mm = gsap.matchMedia();
  mm.add('(min-width: 701px)', function () {
    $$('[data-drift]').forEach(function (el) {
      var d = +el.getAttribute('data-drift');
      gsap.to(el, { yPercent: d * 300, ease: 'none', scrollTrigger: { trigger: el.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  });
  mm.add('(max-width: 700px)', function () {
    var sheet = $('.contact-sheet'); if (!sheet) return;
    var figs = $$('figure', sheet), keep = figs.map(function (f) { return f.style.transform; });
    figs.forEach(function (f) { f.style.transform = ''; }); sheet.classList.add('strip');
    gsap.from($$('figure', sheet), { x: 80, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, clearProps: 'opacity',
      scrollTrigger: { trigger: sheet, start: 'top 85%', once: true } });
    return function () { sheet.classList.remove('strip'); figs.forEach(function (f, i) { f.style.transform = keep[i]; }); };
  });
  gsap.utils.toArray('.stack figure').forEach(function (f, i) {
    gsap.fromTo(f, { y: 40 + i * 30 }, { y: -20 - i * 10, ease: 'none', scrollTrigger: { trigger: '.stack', start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  function doRestore() {
    ScrollTrigger.refresh();
    window.__rsRestore(function (y) {
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
      ScrollTrigger.update();
    });
  }
  if (document.readyState === 'complete') doRestore(); else window.addEventListener('load', doRestore);
  if (wantTop) setTimeout(function () { if (window.scrollY > 0 && !userScrolled) { if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); else window.scrollTo(0, 0); } }, 350);
  mqDesk.addEventListener && mqDesk.addEventListener('change', function () { ScrollTrigger.refresh(); });
})();
