(function () {
  "use strict";

  var wallpapers = Array.isArray(window.WALLPAPERS) ? window.WALLPAPERS : [];
  var prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var favorites = loadFavorites();
  var activeCategory = "All";
  var searchTerm = "";
  var selectedWallpaper = null;
  var previewRenderer = null;
  var heroRenderer = null;
  var cardRenderers = [];
  var deferredInstallPrompt = null;
  var toastTimer = null;

  var els = {
    grid: document.getElementById("wallpaperGrid"),
    favoritesGrid: document.getElementById("favoritesGrid"),
    favoriteEmpty: document.getElementById("favoritesEmpty"),
    empty: document.getElementById("emptyState"),
    chips: document.getElementById("categoryChips"),
    search: document.getElementById("searchInput"),
    results: document.getElementById("resultsLabel"),
    count: document.getElementById("wallpaperCount"),
    modal: document.getElementById("previewModal"),
    previewCanvas: document.getElementById("previewCanvas"),
    previewTitle: document.getElementById("previewTitle"),
    previewCategory: document.getElementById("previewCategory"),
    previewDescription: document.getElementById("previewDescription"),
    previewFavorite: document.getElementById("previewFavoriteBtn"),
    saveFrame: document.getElementById("saveFrameBtn"),
    record: document.getElementById("recordBtn"),
    share: document.getElementById("shareBtn"),
    toast: document.getElementById("toast"),
    install: document.getElementById("installBtn"),
    heroCanvas: document.getElementById("heroCanvas"),
    explore: document.getElementById("exploreBtn")
  };

  function loadFavorites() {
    try {
      var saved = JSON.parse(localStorage.getItem("suhail-live-wallpapers:favorites") || "[]");
      return new Set(Array.isArray(saved) ? saved : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem("suhail-live-wallpapers:favorites", JSON.stringify(Array.from(favorites)));
    } catch (error) {
      // Local storage can be unavailable in private browsing modes.
    }
  }

  function hashString(value) {
    var h = 2166136261;
    for (var i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededRandom(seed) {
    var value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      var t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexToRgb(hex) {
    var clean = String(hex).replace("#", "");
    if (clean.length === 3) {
      clean = clean.split("").map(function (x) { return x + x; }).join("");
    }
    var num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function rgba(hex, alpha) {
    var c = hexToRgb(hex);
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + alpha + ")";
  }

  function CanvasWallpaper(canvas, wallpaper, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.wallpaper = wallpaper;
    this.options = options || {};
    this.dpr = Math.min(window.devicePixelRatio || 1, this.options.maxDpr || 1.7);
    this.seed = hashString(wallpaper.id);
    this.random = seededRandom(this.seed);
    this.items = [];
    this.running = false;
    this.visible = true;
    this.raf = 0;
    this.lastFrame = 0;
    this.frameInterval = 1000 / (this.options.fps || 30);
    this.width = 0;
    this.height = 0;
    this.resizeObserver = null;
    this.init();
  }

  CanvasWallpaper.prototype.init = function () {
    this.resize();
    this.makeItems();
    var self = this;
    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(function () {
        self.resize();
        self.makeItems();
        self.draw(performance.now());
      });
      this.resizeObserver.observe(this.canvas);
    } else {
      this.onWindowResize = function () {
        self.resize();
        self.makeItems();
      };
      window.addEventListener("resize", this.onWindowResize);
    }
    this.start();
  };

  CanvasWallpaper.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width || 300));
    var h = Math.max(1, Math.round(rect.height || 500));
    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  CanvasWallpaper.prototype.makeItems = function () {
    this.random = seededRandom(this.seed);
    this.items = [];
    var effect = this.wallpaper.effect;
    var count = this.options.preview ? 90 : 44;
    if (effect === "rain") count = this.options.preview ? 70 : 34;
    if (effect === "stars") count = this.options.preview ? 150 : 65;
    if (effect === "bubbles") count = this.options.preview ? 45 : 25;
    if (effect === "particles") count = this.options.preview ? 80 : 38;

    for (var i = 0; i < count; i += 1) {
      this.items.push({
        x: this.random() * this.width,
        y: this.random() * this.height,
        z: .2 + this.random() * .8,
        r: 1 + this.random() * 5,
        speed: .3 + this.random() * 1.4,
        phase: this.random() * Math.PI * 2,
        length: 12 + this.random() * 55
      });
    }
  };

  CanvasWallpaper.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    if (prefersReducedMotion) {
      this.draw(0);
      return;
    }
    var self = this;
    function loop(now) {
      if (!self.running) return;
      if (self.visible && now - self.lastFrame >= self.frameInterval) {
        self.lastFrame = now;
        self.draw(now);
      }
      self.raf = requestAnimationFrame(loop);
    }
    this.raf = requestAnimationFrame(loop);
  };

  CanvasWallpaper.prototype.setVisible = function (visible) {
    this.visible = visible;
  };

  CanvasWallpaper.prototype.destroy = function () {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.onWindowResize) window.removeEventListener("resize", this.onWindowResize);
  };

  CanvasWallpaper.prototype.drawBackground = function (time) {
    var ctx = this.ctx;
    var w = this.width;
    var h = this.height;
    var colors = this.wallpaper.colors;
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, w, h);

    var t = time * .00025;
    var x = w * (.5 + Math.sin(t + this.seed) * .14);
    var y = h * (.46 + Math.cos(t * .7 + this.seed) * .1);
    var radius = Math.max(w, h) * .75;
    var glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, rgba(colors[1], .24));
    glow.addColorStop(.42, rgba(colors[2], .11));
    glow.addColorStop(1, rgba(colors[0], 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  };

  CanvasWallpaper.prototype.draw = function (time) {
    this.drawBackground(time);
    switch (this.wallpaper.effect) {
      case "orbits": this.drawOrbits(time); break;
      case "pulse": this.drawPulse(time); break;
      case "waves": this.drawWaves(time); break;
      case "rain": this.drawRain(time); break;
      case "grid": this.drawGrid(time); break;
      case "particles": this.drawParticles(time); break;
      case "bubbles": this.drawBubbles(time); break;
      case "ribbons": this.drawRibbons(time); break;
      case "stars": this.drawStars(time); break;
      case "lightning": this.drawLightning(time); break;
      case "nebula": this.drawNebula(time); break;
      case "mask": this.drawMask(time); break;
      default: this.drawParticles(time);
    }
  };

  CanvasWallpaper.prototype.drawOrbits = function (time) {
    var ctx = this.ctx, w = this.width, h = this.height, colors = this.wallpaper.colors;
    var cx = w * .5, cy = h * .5, t = time * .0004;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * .25);
    for (var i = 0; i < 6; i += 1) {
      var radius = Math.min(w, h) * (.12 + i * .095);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * (1.55 + i * .04), t + i * .42, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(i % 2 ? colors[2] : colors[1], .16 + i * .025);
      ctx.lineWidth = 1 + i * .2;
      ctx.stroke();

      var a = t * (1 + i * .13) + i;
      var px = Math.cos(a) * radius;
      var py = Math.sin(a) * radius * 1.55;
      var g = ctx.createRadialGradient(px, py, 0, px, py, 22);
      g.addColorStop(0, rgba(colors[1], .95));
      g.addColorStop(1, rgba(colors[1], 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, 22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawPulse = function (time) {
    var ctx = this.ctx, w = this.width, h = this.height, c = this.wallpaper.colors;
    var cx = w * .5, cy = h * .52, base = Math.min(w, h), t = time * .00055;
    for (var i = 0; i < 6; i += 1) {
      var progress = (t + i / 6) % 1;
      var r = base * (.08 + progress * .58);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(i % 2 ? c[2] : c[1], (1 - progress) * .5);
      ctx.lineWidth = 1.5 + (1 - progress) * 2.5; ctx.stroke();
    }
    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * .28);
    glow.addColorStop(0, rgba(c[1], .86));
    glow.addColorStop(.18, rgba(c[1], .28));
    glow.addColorStop(1, rgba(c[2], 0));
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  };

  CanvasWallpaper.prototype.drawWaves = function (time) {
    var ctx = this.ctx, w = this.width, h = this.height, c = this.wallpaper.colors;
    var t = time * .00055;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (var band = 0; band < 7; band += 1) {
      ctx.beginPath();
      for (var x = -20; x <= w + 20; x += 10) {
        var y = h * (.18 + band * .105) + Math.sin(x * .016 + t * (1 + band * .08) + band) * (24 + band * 5);
        if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(band % 2 ? c[1] : c[2], .11 + band * .025);
      ctx.lineWidth = 5 + band * 3;
      ctx.shadowColor = c[1]; ctx.shadowBlur = 13;
      ctx.stroke();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawRain = function (time) {
    var ctx = this.ctx, h = this.height, c = this.wallpaper.colors, t = time * .06;
    ctx.save();
    ctx.lineCap = "round";
    for (var i = 0; i < this.items.length; i += 1) {
      var p = this.items[i];
      var y = (p.y + t * p.speed) % (h + p.length) - p.length;
      ctx.beginPath(); ctx.moveTo(p.x, y); ctx.lineTo(p.x, y + p.length);
      ctx.strokeStyle = rgba(i % 3 ? c[1] : c[2], .14 + p.z * .55);
      ctx.lineWidth = .7 + p.z * 1.4; ctx.stroke();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawGrid = function (time) {
    var ctx = this.ctx, w = this.width, h = this.height, c = this.wallpaper.colors, t = (time * .00018) % 1;
    var horizon = h * .43;
    ctx.save();
    ctx.strokeStyle = rgba(c[1], .34); ctx.lineWidth = 1;
    for (var i = -8; i <= 8; i += 1) {
      ctx.beginPath(); ctx.moveTo(w * .5 + i * 7, horizon); ctx.lineTo(w * .5 + i * w * .16, h); ctx.stroke();
    }
    for (var j = 0; j < 16; j += 1) {
      var p = (j / 16 + t) % 1;
      var eased = p * p;
      var y = horizon + (h - horizon) * eased;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y);
      ctx.strokeStyle = rgba(j % 2 ? c[1] : c[2], .1 + p * .35); ctx.stroke();
    }
    var haze = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 100);
    haze.addColorStop(0, rgba(c[1], 0)); haze.addColorStop(.5, rgba(c[1], .24)); haze.addColorStop(1, rgba(c[1], 0));
    ctx.fillStyle = haze; ctx.fillRect(0, horizon - 40, w, 140);
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawParticles = function (time) {
    var ctx = this.ctx, w = this.width, h = this.height, c = this.wallpaper.colors, t = time * .025;
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (var i = 0; i < this.items.length; i += 1) {
      var p = this.items[i];
      var y = h - ((p.y + t * p.speed) % (h + 40));
      var x = p.x + Math.sin(time * .0007 + p.phase) * 13;
      var r = p.r * (.45 + p.z);
      var g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      g.addColorStop(0, rgba(i % 3 ? c[1] : c[2], .8));
      g.addColorStop(1, rgba(c[1], 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawBubbles = function (time) {
    var ctx = this.ctx, w = this.width, h = this.height, c = this.wallpaper.colors, t = time * .018;
    for (var i = 0; i < this.items.length; i += 1) {
      var p = this.items[i];
      var y = h - ((p.y + t * p.speed) % (h + 60));
      var x = p.x + Math.sin(time * .0005 + p.phase) * 18;
      var r = 3 + p.r * 2.1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(c[1], .035 + p.z * .09); ctx.fill();
      ctx.strokeStyle = rgba(i % 2 ? c[1] : c[2], .18 + p.z * .28); ctx.lineWidth = 1; ctx.stroke();
    }
  };

  CanvasWallpaper.prototype.drawRibbons = function (time) {
    var ctx = this.ctx, w = this.width, h = this.height, c = this.wallpaper.colors, t = time * .0005;
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (var band = 0; band < 5; band += 1) {
      ctx.beginPath();
      for (var x = -30; x <= w + 30; x += 8) {
        var y = h * (.24 + band * .14) + Math.sin(x * .014 + t * (1.4 - band * .09) + band * 1.7) * (35 + band * 5);
        y += Math.cos(x * .006 - t + band) * 22;
        if (x === -30) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(band % 2 ? c[2] : c[1], .16 + band * .035);
      ctx.lineWidth = 10 + band * 7; ctx.shadowBlur = 24; ctx.shadowColor = c[1]; ctx.stroke();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawStars = function (time) {
    var ctx = this.ctx, w = this.width, h = this.height, c = this.wallpaper.colors;
    var cx = w * .5, cy = h * .46, rot = time * .00005;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    for (var i = 0; i < this.items.length; i += 1) {
      var p = this.items[i];
      var x = p.x - cx, y = p.y - cy;
      var size = .5 + p.z * 1.8;
      ctx.fillStyle = rgba(i % 8 ? c[1] : c[2], .25 + p.z * .75);
      ctx.fillRect(x, y, size, size);
      if (i % 9 === 0) {
        ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
        ctx.strokeStyle = rgba(c[1], .24); ctx.stroke();
      }
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawLightning = function (time) {
    var ctx = this.ctx, w = this.width, h = this.height, c = this.wallpaper.colors;
    var phase = time * .00018;
    ctx.save();
    for (var bolt = 0; bolt < 3; bolt += 1) {
      ctx.beginPath();
      var x = w * (.25 + bolt * .25) + Math.sin(phase + bolt) * 20;
      ctx.moveTo(x, h * .13);
      for (var s = 1; s <= 9; s += 1) {
        var yy = h * (.13 + s * .075);
        var xx = x + Math.sin(phase * 2 + s * 1.8 + bolt) * (14 + s * 2);
        ctx.lineTo(xx, yy);
      }
      ctx.strokeStyle = rgba(bolt % 2 ? c[2] : c[1], .13 + .06 * Math.sin(phase + bolt));
      ctx.lineWidth = 1.2 + bolt * .4; ctx.shadowBlur = 14; ctx.shadowColor = c[1]; ctx.stroke();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawNebula = function (time) {
    var ctx = this.ctx, w = this.width, h = this.height, c = this.wallpaper.colors, t = time * .00018;
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (var i = 0; i < 7; i += 1) {
      var x = w * (.15 + i * .12) + Math.sin(t + i * 1.7) * w * .12;
      var y = h * (.22 + (i % 4) * .17) + Math.cos(t * .8 + i) * h * .08;
      var r = Math.max(w, h) * (.16 + (i % 3) * .05);
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(i % 2 ? c[1] : c[2], .12));
      g.addColorStop(1, rgba(c[1], 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  };



  CanvasWallpaper.prototype.drawMask = function (time) {
    var ctx = this.ctx, w = this.width, h = this.height, c = this.wallpaper.colors;
    var t = time * .001;
    var cx = w * .5, cy = h * .43;
    var eyeY = cy - h * .055;
    var eyeGap = w * .18;
    var eyeW = w * .18;
    var eyeH = h * .032;
    var glowAlpha = .62 + Math.sin(t * .8) * .08;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.shadowColor = c[1];
    ctx.shadowBlur = Math.max(18, w * .08);
    ctx.fillStyle = rgba(c[1], glowAlpha);

    function eye(x, flip) {
      ctx.beginPath();
      ctx.moveTo(x - eyeW * .5, eyeY);
      ctx.quadraticCurveTo(x, eyeY + eyeH * (flip ? .55 : .3), x + eyeW * .5, eyeY - eyeH * .18);
      ctx.quadraticCurveTo(x, eyeY + eyeH * 1.5, x - eyeW * .5, eyeY);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.beginPath();
      ctx.arc(x + (flip ? -1 : 1) * eyeW * .08, eyeY + eyeH * .48, Math.max(1.5, w * .009), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(c[1], glowAlpha);
    }

    eye(cx - eyeGap, false);
    eye(cx + eyeGap, true);

    ctx.shadowBlur = Math.max(15, w * .055);
    ctx.strokeStyle = rgba(c[1], .72);
    ctx.lineWidth = Math.max(1.5, w * .008);
    ctx.beginPath();
    ctx.moveTo(cx - w * .21, cy + h * .12);
    ctx.quadraticCurveTo(cx, cy + h * (.22 + Math.sin(t * .45) * .006), cx + w * .21, cy + h * .12);
    ctx.stroke();

    ctx.strokeStyle = rgba(c[2], .28);
    ctx.lineWidth = Math.max(1, w * .003);
    for (var i = 0; i < 9; i += 1) {
      var px = cx - w * .16 + i * w * .04;
      var yy = cy + h * .15 + Math.sin((i / 8) * Math.PI) * h * .035;
      ctx.beginPath();
      ctx.moveTo(px, yy - h * .012);
      ctx.lineTo(px + w * .008, yy + h * .015);
      ctx.stroke();
    }

    var halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * .42);
    halo.addColorStop(0, rgba(c[1], .08));
    halo.addColorStop(.58, rgba(c[2], .025));
    halo.addColorStop(1, rgba(c[0], 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  function destroyCardRenderers() {
    cardRenderers.forEach(function (item) {
      if (item.observer) item.observer.disconnect();
      item.renderer.destroy();
    });
    cardRenderers = [];
  }

  function createCard(wallpaper) {
    var card = document.createElement("article");
    card.className = "wall-card";
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "Open " + wallpaper.title);

    var visual = document.createElement("div");
    visual.className = "wall-visual";
    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    var overlay = document.createElement("div");
    overlay.className = "wall-overlay";
    var live = document.createElement("span");
    live.className = "live-badge";
    live.textContent = "LIVE";
    var fav = document.createElement("button");
    fav.className = "favorite-btn" + (favorites.has(wallpaper.id) ? " is-favorite" : "");
    fav.type = "button";
    fav.setAttribute("aria-label", favorites.has(wallpaper.id) ? "Remove from favorites" : "Add to favorites");
    fav.textContent = favorites.has(wallpaper.id) ? "♥" : "♡";

    var meta = document.createElement("div");
    meta.className = "wall-meta";
    var title = document.createElement("h3");
    title.textContent = wallpaper.title;
    var category = document.createElement("p");
    category.textContent = wallpaper.category;
    meta.appendChild(title); meta.appendChild(category);
    visual.appendChild(canvas); visual.appendChild(overlay); visual.appendChild(live); visual.appendChild(fav);
    card.appendChild(visual); card.appendChild(meta);

    function open() { openPreview(wallpaper); }
    card.addEventListener("click", open);
    card.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault(); open();
      }
    });
    fav.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleFavorite(wallpaper.id);
    });

    requestAnimationFrame(function () {
      var renderer = new CanvasWallpaper(canvas, wallpaper, { fps: 24, maxDpr: 1.25 });
      var observer = null;
      if ("IntersectionObserver" in window) {
        observer = new IntersectionObserver(function (entries) {
          renderer.setVisible(entries[0] ? entries[0].isIntersecting : true);
        }, { rootMargin: "120px" });
        observer.observe(card);
      }
      cardRenderers.push({ renderer: renderer, observer: observer });
    });

    return card;
  }

  function renderCatalog() {
    destroyCardRenderers();
    var filtered = wallpapers.filter(function (w) {
      var categoryMatches = activeCategory === "All" || w.category === activeCategory;
      var haystack = (w.title + " " + w.category + " " + w.description).toLowerCase();
      return categoryMatches && haystack.indexOf(searchTerm.toLowerCase()) !== -1;
    });
    els.grid.innerHTML = "";
    filtered.forEach(function (w) { els.grid.appendChild(createCard(w)); });
    els.empty.hidden = filtered.length !== 0;
    els.results.textContent = filtered.length + (filtered.length === 1 ? " wallpaper" : " wallpapers");
  }

  function renderFavorites() {
    destroyCardRenderers();
    var items = wallpapers.filter(function (w) { return favorites.has(w.id); });
    els.favoritesGrid.innerHTML = "";
    items.forEach(function (w) { els.favoritesGrid.appendChild(createCard(w)); });
    els.favoriteEmpty.hidden = items.length !== 0;
  }

  function renderCategories() {
    var categories = ["All"].concat(Array.from(new Set(wallpapers.map(function (w) { return w.category; }))).sort());
    els.chips.innerHTML = "";
    categories.forEach(function (category) {
      var button = document.createElement("button");
      button.className = "chip" + (category === activeCategory ? " is-active" : "");
      button.type = "button";
      button.textContent = category;
      button.addEventListener("click", function () {
        activeCategory = category;
        renderCategories();
        renderCatalog();
      });
      els.chips.appendChild(button);
    });
  }

  function toggleFavorite(id) {
    if (favorites.has(id)) {
      favorites.delete(id);
      showToast("Removed from favorites");
    } else {
      favorites.add(id);
      showToast("Added to favorites");
    }
    saveFavorites();
    if (selectedWallpaper && selectedWallpaper.id === id) updatePreviewFavorite();
    var route = currentRoute();
    if (route === "favorites") renderFavorites(); else renderCatalog();
  }

  function updatePreviewFavorite() {
    if (!selectedWallpaper) return;
    var isFav = favorites.has(selectedWallpaper.id);
    els.previewFavorite.classList.toggle("is-favorite", isFav);
    els.previewFavorite.textContent = isFav ? "♥" : "♡";
    els.previewFavorite.setAttribute("aria-label", isFav ? "Remove from favorites" : "Add to favorites");
  }

  function openPreview(wallpaper) {
    selectedWallpaper = wallpaper;
    els.previewTitle.textContent = wallpaper.title;
    els.previewCategory.textContent = wallpaper.category + " • PROCEDURAL LIVE WALLPAPER";
    els.previewDescription.textContent = wallpaper.description;
    updatePreviewFavorite();
    els.modal.hidden = false;
    document.body.style.overflow = "hidden";
    history.replaceState(null, "", "#wallpaper=" + encodeURIComponent(wallpaper.id));
    requestAnimationFrame(function () {
      if (previewRenderer) previewRenderer.destroy();
      previewRenderer = new CanvasWallpaper(els.previewCanvas, wallpaper, { fps: 30, maxDpr: 2, preview: true });
    });
  }

  function closePreview() {
    if (els.modal.hidden) return;
    els.modal.hidden = true;
    document.body.style.overflow = "";
    if (previewRenderer) {
      previewRenderer.destroy();
      previewRenderer = null;
    }
    selectedWallpaper = null;
    history.replaceState(null, "", "#" + currentVisibleRoute());
  }

  function currentVisibleRoute() {
    var active = document.querySelector(".view.is-active");
    if (!active) return "home";
    return active.id.replace("View", "");
  }

  function currentRoute() {
    var hash = location.hash.replace("#", "");
    if (hash.indexOf("wallpaper=") === 0) return currentVisibleRoute();
    return ["home", "favorites", "how", "about"].indexOf(hash) >= 0 ? hash : "home";
  }

  function routeTo(route, updateHash) {
    var valid = ["home", "favorites", "how", "about"];
    if (valid.indexOf(route) === -1) route = "home";
    document.querySelectorAll(".view").forEach(function (view) { view.classList.remove("is-active"); });
    var target = document.getElementById(route + "View");
    if (target) target.classList.add("is-active");
    document.querySelectorAll("[data-route]").forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-route") === route);
    });
    if (route === "favorites") renderFavorites();
    if (route === "home") renderCatalog();
    if (updateHash !== false) history.replaceState(null, "", "#" + route);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    toastTimer = setTimeout(function () { els.toast.classList.remove("is-visible"); }, 2300);
  }

  function saveFrame() {
    if (!selectedWallpaper) return;

    var exportCanvas = document.createElement("canvas");
    exportCanvas.width = 1290;
    exportCanvas.height = 2796;
    var exportRenderer = Object.create(CanvasWallpaper.prototype);
    exportRenderer.canvas = exportCanvas;
    exportRenderer.ctx = exportCanvas.getContext("2d", { alpha: false });
    exportRenderer.wallpaper = selectedWallpaper;
    exportRenderer.options = { preview: true };
    exportRenderer.dpr = 1;
    exportRenderer.seed = hashString(selectedWallpaper.id);
    exportRenderer.random = seededRandom(exportRenderer.seed);
    exportRenderer.items = [];
    exportRenderer.width = exportCanvas.width;
    exportRenderer.height = exportCanvas.height;
    exportRenderer.makeItems();
    exportRenderer.draw(performance.now());

    exportCanvas.toBlob(function (blob) {
      if (!blob) {
        showToast("Could not create the image.");
        return;
      }
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "suhail-" + selectedWallpaper.id + "-1290x2796.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showToast("High-resolution wallpaper saved");
    }, "image/png", 1);
  }

  function bestRecordingMime() {
    if (!window.MediaRecorder) return "";
    var choices = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (var i = 0; i < choices.length; i += 1) {
      if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(choices[i])) return choices[i];
    }
    return "";
  }

  function recordLive() {
    if (!selectedWallpaper || !els.previewCanvas.captureStream || !window.MediaRecorder) {
      showToast("Live recording is not supported here. Use your device screen recorder.");
      return;
    }
    var mime = bestRecordingMime();
    try {
      var stream = els.previewCanvas.captureStream(30);
      var recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      var chunks = [];
      var original = els.record.textContent;
      els.record.disabled = true;
      recorder.ondataavailable = function (event) {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      recorder.onstop = function () {
        var type = recorder.mimeType || mime || "video/webm";
        var blob = new Blob(chunks, { type: type });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "suhail-" + selectedWallpaper.id + (type.indexOf("mp4") !== -1 ? ".mp4" : ".webm");
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
        els.record.disabled = false; els.record.textContent = original;
        showToast("Live clip ready");
      };
      recorder.start(250);
      var seconds = 6;
      els.record.textContent = "Recording " + seconds + "s";
      var countdown = setInterval(function () {
        seconds -= 1;
        if (seconds > 0) els.record.textContent = "Recording " + seconds + "s";
      }, 1000);
      setTimeout(function () {
        clearInterval(countdown);
        if (recorder.state !== "inactive") recorder.stop();
        stream.getTracks().forEach(function (track) { track.stop(); });
      }, 6000);
    } catch (error) {
      els.record.disabled = false;
      els.record.textContent = "Record live";
      showToast("Use your device screen recorder for this browser.");
    }
  }

  function shareCurrent() {
    if (!selectedWallpaper) return;
    var shareUrl = location.origin + location.pathname + "#wallpaper=" + encodeURIComponent(selectedWallpaper.id);
    var data = {
      title: selectedWallpaper.title + " — Suhail Live Wallpapers",
      text: "Check out " + selectedWallpaper.title + " on Suhail Live Wallpapers.",
      url: shareUrl
    };
    if (navigator.share) {
      navigator.share(data).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(function () { showToast("Link copied"); });
    } else {
      showToast("Sharing is not available in this browser.");
    }
  }

  function handleInitialHash() {
    var raw = location.hash.replace("#", "");
    if (raw.indexOf("wallpaper=") === 0) {
      routeTo("home", false);
      var id = decodeURIComponent(raw.split("=")[1] || "");
      var found = wallpapers.find(function (w) { return w.id === id; });
      if (found) setTimeout(function () { openPreview(found); }, 80);
      return;
    }
    routeTo(currentRoute(), false);
  }

  function setupInstall() {
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      els.install.hidden = false;
      els.install.textContent = "Install";
    });

    els.install.addEventListener("click", function () {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(function () {
          deferredInstallPrompt = null;
          els.install.hidden = true;
        });
        return;
      }
      routeTo("how");
    });

    var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (isIos && !isStandalone) {
      els.install.hidden = false;
      els.install.textContent = "Add to Home";
    }

    window.addEventListener("appinstalled", function () {
      els.install.hidden = true;
      showToast("Suhail Live Wallpapers installed");
    });
  }

  function setupServiceWorker() {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("./service-worker.js").catch(function () {});
      });
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-route]").forEach(function (button) {
      button.addEventListener("click", function () { routeTo(button.getAttribute("data-route")); });
    });

    els.search.addEventListener("input", function () {
      searchTerm = els.search.value.trim();
      renderCatalog();
    });

    els.explore.addEventListener("click", function () {
      document.getElementById("catalog").scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
    });

    document.querySelectorAll("[data-close-preview]").forEach(function (el) {
      el.addEventListener("click", closePreview);
    });

    els.previewFavorite.addEventListener("click", function () {
      if (selectedWallpaper) toggleFavorite(selectedWallpaper.id);
    });
    els.saveFrame.addEventListener("click", saveFrame);
    els.record.addEventListener("click", recordLive);
    els.share.addEventListener("click", shareCurrent);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !els.modal.hidden) closePreview();
    });

    window.addEventListener("hashchange", function () {
      if (location.hash.indexOf("#wallpaper=") === 0) {
        var id = decodeURIComponent(location.hash.split("=")[1] || "");
        var found = wallpapers.find(function (w) { return w.id === id; });
        if (found && (!selectedWallpaper || selectedWallpaper.id !== id)) openPreview(found);
      } else {
        if (!els.modal.hidden) closePreview();
        routeTo(currentRoute(), false);
      }
    });
  }

  function initHero() {
    var heroWallpaper = wallpapers.find(function (w) { return w.id === "aurora-drift"; }) || wallpapers[0];
    if (heroWallpaper && els.heroCanvas) {
      heroRenderer = new CanvasWallpaper(els.heroCanvas, heroWallpaper, { fps: 30, maxDpr: 1.5, preview: true });
    }
  }

  function init() {
    els.count.textContent = wallpapers.length;
    renderCategories();
    bindEvents();
    setupInstall();
    setupServiceWorker();
    initHero();
    handleInitialHash();
  }

  init();
})();