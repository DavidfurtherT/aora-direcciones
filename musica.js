/*
 * Música de ambiente compartida por la sala y las 10 direcciones.
 * - Página principal (o una dirección abierta directo): crea el reproductor de YouTube oculto, arranca en silencio
 *   (los navegadores no dejan sonar sin un toque) y activa el sonido con el primer toque, clic o tecla.
 * - Dirección abierta dentro de la sala (iframe): no crea reproductor; su botón controla el de la sala, y
 *   "Todas las direcciones" vuelve al menú sin recargar, así la música no se corta.
 * - Posición y pausa se guardan en localStorage para retomar en el mismo segundo.
 */
(function () {
  "use strict";
  var VIDEO = "mk_ioG3daYA";
  var START = 247; // 4:07
  var KEY = "aora-musica";
  var VOL = 55;
  var inFrame = window.parent !== window && !!(function () { try { return window.parent.AORA_MUSIC; } catch (e) { return null; } })();

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(patch) { try { var s = load(); for (var k in patch) s[k] = patch[k]; s.at = Date.now(); localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  /* ---------- Botón ---------- */
  var css = "" +
    ".aora-mx{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:2147483000;" +
    "display:flex;align-items:center;gap:10px;height:44px;padding:0 16px 0 14px;border:0;border-radius:999px;cursor:pointer;" +
    "background:rgba(20,35,35,.92);color:#F9F7F2;font:600 11px/1 system-ui,-apple-system,sans-serif;letter-spacing:.18em;text-transform:uppercase;" +
    "box-shadow:0 10px 30px -12px rgba(0,0,0,.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:transform .4s cubic-bezier(.22,1,.36,1)}" +
    ".aora-mx:hover{transform:scale(1.04)}.aora-mx:active{transform:scale(.97)}.aora-mx:focus-visible{outline:2px solid #FFA38B;outline-offset:3px}" +
    ".aora-mx i{display:flex;align-items:flex-end;gap:3px;height:14px}.aora-mx b{display:block;width:3px;height:100%;border-radius:2px;background:#FFA38B;transform-origin:bottom;transform:scaleY(.3)}" +
    ".aora-mx.on b{animation:aoraEq .9s cubic-bezier(.22,1,.36,1) infinite alternate}.aora-mx.on b:nth-child(2){animation-delay:.14s}.aora-mx.on b:nth-child(3){animation-delay:.28s}.aora-mx.on b:nth-child(4){animation-delay:.42s}" +
    ".aora-mx.armed{background:#FFA38B;color:#142323}.aora-mx.armed b{background:#142323}" +
    "@keyframes aoraEq{from{transform:scaleY(.25)}to{transform:scaleY(1)}}" +
    "@media (prefers-reduced-motion:reduce){.aora-mx.on b{animation:none;transform:scaleY(.7)}}" +
    "@media (max-width:520px){.aora-mx span{display:none}.aora-mx{padding:0 14px}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "aora-mx";
  btn.innerHTML = '<i aria-hidden="true"><b></b><b></b><b></b><b></b></i><span>Música</span>';
  function paint(state) {
    btn.classList.toggle("on", state === "playing");
    btn.classList.toggle("armed", state === "armed");
    var label = state === "playing" ? "Pausar música" : "Reproducir música";
    btn.setAttribute("aria-label", label); btn.title = label;
    btn.setAttribute("aria-pressed", state === "playing" ? "true" : "false");
    btn.querySelector("span").textContent = state === "playing" ? "Sonando" : state === "armed" ? "Toca para sonido" : "Música";
  }
  function mount() { if (!btn.isConnected) document.body.appendChild(btn); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  /* ---------- Dentro de la sala: control remoto ---------- */
  if (inFrame) {
    var P = window.parent.AORA_MUSIC;
    paint(P.state());
    P.subscribe(paint);
    btn.addEventListener("click", function () { P.toggle(); });
    // El primer toque dentro de la dirección también activa el sonido.
    var wake = function () { P.wake(); };
    ["pointerdown", "keydown", "touchstart"].forEach(function (t) { window.addEventListener(t, wake, { once: true, capture: true }); });
    // "Todas las direcciones" vuelve al menú de la sala sin recargar.
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      var h = a.getAttribute("href");
      if (/(^|\/)index\.html$|^\.\.\/?$/.test(h)) { e.preventDefault(); P.closeDirection(); }
    }, true);
    return;
  }

  /* ---------- Reproductor principal ---------- */
  var player = null, ready = false, state = "loading", listeners = [], userPaused = !!load().paused, unmuted = false;
  function set(s) { state = s; paint(s); listeners.forEach(function (f) { try { f(s); } catch (e) {} }); }
  function startAt() { var s = load(); return s.t && Date.now() - (s.at || 0) < 6 * 3600e3 ? Math.max(START, Math.floor(s.t)) : START; }

  var holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText = "position:fixed;left:-10000px;top:0;width:200px;height:200px;opacity:0;pointer-events:none";
  holder.innerHTML = '<div id="aora-yt"></div>';
  (document.body || document.documentElement).appendChild(holder);

  function play() {
    if (!ready) return;
    userPaused = false; save({ paused: false });
    try { player.unMute(); player.setVolume(VOL); player.playVideo(); unmuted = true; } catch (e) {}
    set("playing");
  }
  function pause(byUser) {
    if (!ready) return;
    if (byUser) { userPaused = true; save({ paused: true }); }
    try { player.pauseVideo(); } catch (e) {}
    set("paused");
  }
  function wake() { if (!unmuted && !userPaused) play(); }

  btn.addEventListener("click", function (e) { e.stopPropagation(); state === "playing" ? pause(true) : play(); });
  ["pointerdown", "keydown", "touchstart"].forEach(function (t) {
    window.addEventListener(t, function (e) { if (e.target.closest && e.target.closest(".aora-mx")) return; wake(); }, { once: true, capture: true });
  });

  // Guarda la posición cada segundo para retomar en otra página.
  setInterval(function () { if (ready && state === "playing") { try { save({ t: player.getCurrentTime() }); } catch (e) {} } }, 1000);
  window.addEventListener("pagehide", function () { if (ready) { try { save({ t: player.getCurrentTime() }); } catch (e) {} } });

  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player("aora-yt", {
      host: "https://www.youtube-nocookie.com",
      videoId: VIDEO, width: 200, height: 200,
      playerVars: { autoplay: 1, mute: 1, start: startAt(), controls: 0, playsinline: 1, rel: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1 },
      events: {
        onReady: function () {
          ready = true;
          if (userPaused) { player.pauseVideo(); set("paused"); return; }
          player.mute(); player.playVideo();
          // Si el navegador ya permite sonido (el visitante tocó la página antes), suena directo.
          setTimeout(function () { try { player.unMute(); player.setVolume(VOL); if (!player.isMuted()) { unmuted = true; set("playing"); return; } } catch (e) {} set("armed"); }, 400);
        },
        onStateChange: function (e) {
          if (e.data === 0) { player.seekTo(START, true); player.playVideo(); }
        }
      }
    });
  };
  var s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true; document.head.appendChild(s);

  // API para las direcciones abiertas dentro de la sala.
  window.AORA_MUSIC = {
    state: function () { return state; },
    subscribe: function (f) { listeners.push(f); },
    toggle: function () { state === "playing" ? pause(true) : play(); },
    wake: wake,
    // Al volver al menú: pausa breve y sigue sola (si el visitante no la había pausado).
    dip: function () {
      if (!ready || userPaused || state !== "playing") return;
      try { player.pauseVideo(); } catch (e) {}
      set("paused");
      setTimeout(function () { if (!userPaused) play(); }, 1200);
    },
    closeDirection: function () { if (window.AORA_CLOSE) window.AORA_CLOSE(); }
  };
})();
