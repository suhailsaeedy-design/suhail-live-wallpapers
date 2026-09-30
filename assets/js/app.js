(function () {
  "use strict";

  var wallpapers = [];
  var catalogReady = false;
  var isOnline = navigator.onLine;
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
    favoritesEmpty: document.getElementById("favoritesEmpty"),
    favoritesOffline: document.getElementById("favoritesOffline"),
    empty: document.getElementById("emptyState"),
    chips: document.getElementById("categoryChips"),
    search: document.getElementById("searchInput"),
    results: document.getElementById("resultsLabel"),
    count: document.getElementById("wallpaperCount"),
    catalogOffline: document.getElementById("catalogOffline"),
    retryNetwork: document.getElementById("retryNetworkBtn"),
    offlineBar: document.getElementById("offlineBar"),
    networkPill: document.getElementById("networkPill"),
    themeToggle: document.getElementById("themeToggle"),
    modal: document.getElementById("previewModal"),
    previewCanvas: document.getElementById("previewCanvas"),
    previewTitle: document.getElementById("previewTitle"),
    previewCategory: document.getElementById("previewCategory"),
    previewDescription: document.getElementById("previewDescription"),
    previewFavorite: document.getElementById("previewFavoriteBtn"),
    download: document.getElementById("downloadBtn"),
    downloadSheet: document.getElementById("downloadSheet"),
    downloadLive: document.getElementById("downloadLiveBtn"),
    downloadPhoto: document.getElementById("downloadPhotoBtn"),
    legacySaveFrame: document.getElementById("saveFrameBtn"),
    legacyRecord: document.getElementById("recordBtn"),
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
    } catch (error) {}
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
    var clean = String(hex || "#000000").replace("#", "");
    if (clean.length === 3) clean = clean.split("").map(function (x) { return x + x; }).join("");
    var num = parseInt(clean, 16);
    return { r:(num >> 16) & 255, g:(num >> 8) & 255, b:num & 255 };
  }

  function rgba(hex, alpha) {
    var c = hexToRgb(hex);
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + alpha + ")";
  }

  function CanvasWallpaper(canvas, wallpaper, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha:false });
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
    this.image = null;
    this.imageReady = false;
    if (wallpaper.effect === "photo" && wallpaper.asset) {
      this.image = new Image();
      this.image.decoding = "async";
      var self = this;
      this.image.onload = function(){ self.imageReady = true; self.draw(performance.now()); };
      this.image.onerror = function(){ self.imageReady = false; };
      this.image.src = wallpaper.asset;
    }
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
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
  };

  CanvasWallpaper.prototype.makeItems = function () {
    this.random = seededRandom(this.seed);
    this.items = [];
    var effect = this.wallpaper.effect;
    var count = this.options.preview ? 100 : 44;
    if (effect === "stars") count = this.options.preview ? 160 : 70;
    if (effect === "comets") count = this.options.preview ? 110 : 55;
    if (effect === "fireflies") count = this.options.preview ? 105 : 52;
    if (effect === "snow") count = this.options.preview ? 135 : 68;
    if (effect === "scene") count = this.options.preview ? 95 : 45;
    for (var i=0;i<count;i+=1) {
      this.items.push({
        x:this.random()*this.width,
        y:this.random()*this.height,
        z:.2+this.random()*.8,
        r:1+this.random()*5,
        speed:.3+this.random()*1.4,
        phase:this.random()*Math.PI*2,
        length:12+this.random()*55
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
      if (self.visible && now-self.lastFrame >= self.frameInterval) {
        self.lastFrame = now;
        self.draw(now);
      }
      self.raf = requestAnimationFrame(loop);
    }
    this.raf = requestAnimationFrame(loop);
  };

  CanvasWallpaper.prototype.setVisible = function (visible) { this.visible = visible; };
  CanvasWallpaper.prototype.destroy = function () {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.resizeObserver) this.resizeObserver.disconnect();
  };

  CanvasWallpaper.prototype.drawBackground = function (time) {
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,t=time*.00025;
    ctx.fillStyle=c[0];ctx.fillRect(0,0,w,h);
    var x=w*(.5+Math.sin(t+this.seed)*.14),y=h*(.46+Math.cos(t*.7+this.seed)*.1);
    var r=Math.max(w,h)*.75;
    var g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,rgba(c[1],.24));g.addColorStop(.42,rgba(c[2],.11));g.addColorStop(1,rgba(c[0],0));
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  };

  CanvasWallpaper.prototype.draw = function (time) {
    if (this.wallpaper.effect === "photo") {
      this.drawPhoto(time);
      return;
    }
    if (this.wallpaper.effect === "scene") {
      this.drawScene(time);
      return;
    }
    this.drawBackground(time);
    switch(this.wallpaper.effect) {
      case "orbits":this.drawOrbits(time);break;
      case "pulse":this.drawPulse(time);break;
      case "waves":this.drawWaves(time);break;
      case "rain":this.drawRain(time);break;
      case "grid":this.drawGrid(time);break;
      case "particles":this.drawParticles(time);break;
      case "bubbles":this.drawBubbles(time);break;
      case "ribbons":this.drawRibbons(time);break;
      case "stars":this.drawStars(time);break;
      case "comets":this.drawComets(time);break;
      case "fireflies":this.drawFireflies(time);break;
      case "liquid":this.drawLiquid(time);break;
      case "rings":this.drawRings(time);break;
      case "snow":this.drawSnow(time);break;
      case "lasers":this.drawLasers(time);break;
      case "lightning":this.drawLightning(time);break;
      case "nebula":this.drawNebula(time);break;
      case "mask":this.drawMask(time);break;
      default:this.drawParticles(time);
    }
  };

  CanvasWallpaper.prototype.drawOrbits = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,cx=w*.5,cy=h*.5,t=time*.0004;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(t*.25);
    for(var i=0;i<6;i+=1){
      var r=Math.min(w,h)*(.12+i*.095);
      ctx.beginPath();ctx.ellipse(0,0,r,r*(1.55+i*.04),t+i*.42,0,Math.PI*2);
      ctx.strokeStyle=rgba(i%2?c[2]:c[1],.16+i*.025);ctx.lineWidth=1+i*.2;ctx.stroke();
      var a=t*(1+i*.13)+i,px=Math.cos(a)*r,py=Math.sin(a)*r*1.55;
      var g=ctx.createRadialGradient(px,py,0,px,py,22);g.addColorStop(0,rgba(c[1],.95));g.addColorStop(1,rgba(c[1],0));
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,22,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawPulse = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,cx=w*.5,cy=h*.52,base=Math.min(w,h),t=time*.00055;
    for(var i=0;i<6;i+=1){
      var p=(t+i/6)%1,r=base*(.08+p*.58);
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle=rgba(i%2?c[2]:c[1],(1-p)*.5);ctx.lineWidth=1.5+(1-p)*2.5;ctx.stroke();
    }
    var g=ctx.createRadialGradient(cx,cy,0,cx,cy,base*.28);g.addColorStop(0,rgba(c[1],.86));g.addColorStop(.18,rgba(c[1],.28));g.addColorStop(1,rgba(c[2],0));
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  };

  CanvasWallpaper.prototype.drawWaves = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,t=time*.00055;
    ctx.save();ctx.globalCompositeOperation="screen";
    for(var b=0;b<7;b+=1){
      ctx.beginPath();
      for(var x=-20;x<=w+20;x+=10){
        var y=h*(.18+b*.105)+Math.sin(x*.016+t*(1+b*.08)+b)*(24+b*5);
        if(x===-20)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=rgba(b%2?c[1]:c[2],.11+b*.025);ctx.lineWidth=5+b*3;ctx.shadowColor=c[1];ctx.shadowBlur=13;ctx.stroke();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawRain = function(time){
    var ctx=this.ctx,h=this.height,c=this.wallpaper.colors,t=time*.06;ctx.save();ctx.lineCap="round";
    for(var i=0;i<this.items.length;i+=1){
      var p=this.items[i],y=(p.y+t*p.speed)%(h+p.length)-p.length;
      ctx.beginPath();ctx.moveTo(p.x,y);ctx.lineTo(p.x,y+p.length);
      ctx.strokeStyle=rgba(i%3?c[1]:c[2],.14+p.z*.55);ctx.lineWidth=.7+p.z*1.4;ctx.stroke();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawGrid = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,t=(time*.00018)%1,horizon=h*.43;
    ctx.save();ctx.lineWidth=1;
    for(var i=-8;i<=8;i+=1){ctx.beginPath();ctx.moveTo(w*.5+i*7,horizon);ctx.lineTo(w*.5+i*w*.16,h);ctx.strokeStyle=rgba(c[1],.28);ctx.stroke();}
    for(var j=0;j<16;j+=1){var p=(j/16+t)%1,y=horizon+(h-horizon)*p*p;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.strokeStyle=rgba(j%2?c[1]:c[2],.1+p*.35);ctx.stroke();}
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawParticles = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,t=time*.025;ctx.save();ctx.globalCompositeOperation="screen";
    for(var i=0;i<this.items.length;i+=1){
      var p=this.items[i],y=h-((p.y+t*p.speed)%(h+40)),x=p.x+Math.sin(time*.0007+p.phase)*13,r=p.r*(.45+p.z);
      var g=ctx.createRadialGradient(x,y,0,x,y,r*3);g.addColorStop(0,rgba(i%3?c[1]:c[2],.8));g.addColorStop(1,rgba(c[1],0));
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*3,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawBubbles = function(time){
    var ctx=this.ctx,h=this.height,c=this.wallpaper.colors,t=time*.018;
    for(var i=0;i<this.items.length;i+=1){
      var p=this.items[i],y=h-((p.y+t*p.speed)%(h+60)),x=p.x+Math.sin(time*.0005+p.phase)*18,r=3+p.r*2.1;
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=rgba(c[1],.04+p.z*.08);ctx.fill();ctx.strokeStyle=rgba(i%2?c[1]:c[2],.18+p.z*.28);ctx.stroke();
    }
  };

  CanvasWallpaper.prototype.drawRibbons = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,t=time*.0005;ctx.save();ctx.globalCompositeOperation="screen";
    for(var b=0;b<5;b+=1){
      ctx.beginPath();
      for(var x=-30;x<=w+30;x+=8){
        var y=h*(.24+b*.14)+Math.sin(x*.014+t*(1.4-b*.09)+b*1.7)*(35+b*5)+Math.cos(x*.006-t+b)*22;
        if(x===-30)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=rgba(b%2?c[2]:c[1],.16+b*.035);ctx.lineWidth=10+b*7;ctx.shadowBlur=24;ctx.shadowColor=c[1];ctx.stroke();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawStars = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,cx=w*.5,cy=h*.46,rot=time*.00005;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);
    for(var i=0;i<this.items.length;i+=1){
      var p=this.items[i],x=p.x-cx,y=p.y-cy,s=.5+p.z*1.8;
      ctx.fillStyle=rgba(i%8?c[1]:c[2],.25+p.z*.75);ctx.fillRect(x,y,s,s);
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawComets = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,t=time*.09;
    ctx.save();ctx.globalCompositeOperation="screen";ctx.lineCap="round";
    for(var i=0;i<this.items.length;i+=1){
      var p=this.items[i],cycle=(p.x+t*p.speed*1.55+p.phase*120)%(w+h*.55+180);
      var x=cycle-h*.18,y=(p.y*.72+cycle*.42)%(h+100)-50;
      var len=22+p.length*(.55+p.z*.8);
      var color=i%4===0?c[2]:c[1],a=.08+p.z*.48;
      var g=ctx.createLinearGradient(x-len,y-len*.42,x,y);
      g.addColorStop(0,rgba(color,0));g.addColorStop(1,rgba(color,a));
      ctx.strokeStyle=g;ctx.lineWidth=.7+p.z*1.8;ctx.beginPath();ctx.moveTo(x-len,y-len*.42);ctx.lineTo(x,y);ctx.stroke();
      if(p.z>.62){
        var glow=ctx.createRadialGradient(x,y,0,x,y,5+p.z*8);glow.addColorStop(0,rgba("#ffffff",.65));glow.addColorStop(.25,rgba(color,.55));glow.addColorStop(1,rgba(color,0));
        ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,5+p.z*8,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawFireflies = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,t=time*.0008;
    ctx.save();ctx.globalCompositeOperation="screen";
    var ground=ctx.createLinearGradient(0,h*.64,0,h);ground.addColorStop(0,rgba(c[2],0));ground.addColorStop(1,rgba(c[2],.10));ctx.fillStyle=ground;ctx.fillRect(0,h*.58,w,h*.42);
    for(var i=0;i<this.items.length;i+=1){
      var p=this.items[i],x=(p.x+Math.sin(t*(.7+p.speed*.14)+p.phase)*22+w)%w;
      var y=h*(.18+.72*(p.y/h))+Math.cos(t*(.9+p.z)+p.phase)*18;
      var pulse=.28+.5*(.5+.5*Math.sin(t*4+p.phase));
      var r=2+p.z*5.5,color=i%5===0?c[2]:c[1];
      var g=ctx.createRadialGradient(x,y,0,x,y,r*4.2);g.addColorStop(0,rgba("#ffffff",pulse*.88));g.addColorStop(.16,rgba(color,pulse));g.addColorStop(1,rgba(color,0));
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*4.2,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawLiquid = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,t=time*.00028;
    ctx.save();ctx.globalCompositeOperation="screen";
    for(var i=0;i<9;i+=1){
      var phase=i*1.71+this.seed*.00001;
      var x=w*(.5+.38*Math.sin(t*(.72+i*.025)+phase));
      var y=h*(.5+.39*Math.cos(t*(.55+i*.033)+phase*.83));
      var r=Math.max(w,h)*(.13+(i%4)*.025);
      var color=i%3===0?c[2]:c[1];
      var g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,rgba(color,.20+(i%3)*.025));g.addColorStop(.45,rgba(color,.095));g.addColorStop(1,rgba(color,0));
      ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    ctx.globalCompositeOperation="source-over";
    for(var b=0;b<4;b+=1){
      ctx.beginPath();
      for(var xx=-20;xx<=w+20;xx+=8){
        var yy=h*(.28+b*.16)+Math.sin(xx*.012+t*(1.1+b*.17)+b)*28+Math.sin(xx*.004-t*.7+b)*20;
        if(xx===-20)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
      }
      ctx.strokeStyle=rgba(b%2?c[2]:c[1],.08);ctx.lineWidth=1.2;ctx.stroke();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawRings = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,cx=w*.5,cy=h*.5,t=time*.00038,base=Math.min(w,h);
    ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.sin(t*.45)*.16);
    for(var i=0;i<10;i+=1){
      var p=(t+i/10)%1,rx=base*(.05+p*.56),ry=rx*(1.15+.3*Math.sin(t+i*.6));
      ctx.beginPath();ctx.ellipse(0,0,rx,ry,t*.17+i*.23,0,Math.PI*2);
      ctx.strokeStyle=rgba(i%2?c[2]:c[1],(1-p)*.42);ctx.lineWidth=1.1+(1-p)*2.6;ctx.stroke();
    }
    ctx.restore();
    var g=ctx.createRadialGradient(cx,cy,0,cx,cy,base*.36);g.addColorStop(0,rgba(c[1],.22));g.addColorStop(.45,rgba(c[2],.08));g.addColorStop(1,rgba(c[1],0));ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  };

  CanvasWallpaper.prototype.drawSnow = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,t=time*.025;
    ctx.save();
    for(var i=0;i<this.items.length;i+=1){
      var p=this.items[i],y=(p.y+t*p.speed*(.45+p.z))%(h+24)-12;
      var x=(p.x+Math.sin(time*.00055+p.phase)*18*(.35+p.z)+w)%w;
      var r=.8+p.z*2.8,a=.22+p.z*.7;
      ctx.fillStyle=rgba(i%7===0?c[2]:"#ffffff",a);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
      if(p.z>.72){ctx.strokeStyle=rgba(c[1],a*.28);ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x-r*2,y);ctx.lineTo(x+r*2,y);ctx.moveTo(x,y-r*2);ctx.lineTo(x,y+r*2);ctx.stroke();}
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawLasers = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,t=time*.00065,horizon=h*.46;
    ctx.save();ctx.globalCompositeOperation="screen";
    for(var i=0;i<8;i+=1){
      var phase=t*(.75+i*.055)+i*.82;
      var sx=w*(.5+Math.sin(phase)*.55),ex=w*(.5+Math.sin(phase+.9)*.95);
      var color=i%2?c[2]:c[1],a=.08+(i%3)*.035;
      ctx.beginPath();ctx.moveTo(sx,horizon);ctx.lineTo(ex,h*1.08);ctx.strokeStyle=rgba(color,a);ctx.lineWidth=1+(i%3);ctx.shadowBlur=13;ctx.shadowColor=color;ctx.stroke();
    }
    var scanY=h*(.18+.66*((t*.12)%1));ctx.beginPath();ctx.moveTo(0,scanY);ctx.lineTo(w,scanY+Math.sin(t)*8);ctx.strokeStyle=rgba(c[1],.18);ctx.lineWidth=2;ctx.shadowBlur=16;ctx.shadowColor=c[1];ctx.stroke();
    for(var d=0;d<5;d+=1){var yy=horizon+d*h*.085;ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(w,yy);ctx.strokeStyle=rgba(c[2],.035+d*.012);ctx.lineWidth=1;ctx.stroke();}
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawLightning = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,phase=time*.00018;ctx.save();
    for(var b=0;b<3;b+=1){
      ctx.beginPath();var x=w*(.25+b*.25)+Math.sin(phase+b)*20;ctx.moveTo(x,h*.13);
      for(var s=1;s<=9;s+=1){var yy=h*(.13+s*.075),xx=x+Math.sin(phase*2+s*1.8+b)*(14+s*2);ctx.lineTo(xx,yy);}
      ctx.strokeStyle=rgba(b%2?c[2]:c[1],.13+.06*Math.sin(phase+b));ctx.lineWidth=1.2+b*.4;ctx.shadowBlur=14;ctx.shadowColor=c[1];ctx.stroke();
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawNebula = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,t=time*.00018;ctx.save();ctx.globalCompositeOperation="screen";
    for(var i=0;i<7;i+=1){
      var x=w*(.15+i*.12)+Math.sin(t+i*1.7)*w*.12,y=h*(.22+(i%4)*.17)+Math.cos(t*.8+i)*h*.08,r=Math.max(w,h)*(.16+(i%3)*.05);
      var g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(i%2?c[1]:c[2],.12));g.addColorStop(1,rgba(c[1],0));
      ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawMask = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,t=time*.001,cx=w*.5,cy=h*.43;
    var eyeY=cy-h*.055,eyeGap=w*.18,eyeW=w*.18,eyeH=h*.032,alpha=.62+Math.sin(t*.8)*.08;
    ctx.save();ctx.globalCompositeOperation="screen";ctx.shadowColor=c[1];ctx.shadowBlur=Math.max(18,w*.08);ctx.fillStyle=rgba(c[1],alpha);
    function eye(x,flip){
      ctx.beginPath();ctx.moveTo(x-eyeW*.5,eyeY);ctx.quadraticCurveTo(x,eyeY+eyeH*(flip?.55:.3),x+eyeW*.5,eyeY-eyeH*.18);ctx.quadraticCurveTo(x,eyeY+eyeH*1.5,x-eyeW*.5,eyeY);ctx.fill();
      ctx.fillStyle="rgba(255,255,255,.9)";ctx.beginPath();ctx.arc(x+(flip?-1:1)*eyeW*.08,eyeY+eyeH*.48,Math.max(1.5,w*.009),0,Math.PI*2);ctx.fill();ctx.fillStyle=rgba(c[1],alpha);
    }
    eye(cx-eyeGap,false);eye(cx+eyeGap,true);
    ctx.strokeStyle=rgba(c[1],.72);ctx.lineWidth=Math.max(1.5,w*.008);ctx.beginPath();ctx.moveTo(cx-w*.21,cy+h*.12);ctx.quadraticCurveTo(cx,cy+h*(.22+Math.sin(t*.45)*.006),cx+w*.21,cy+h*.12);ctx.stroke();
    ctx.restore();
  };

  CanvasWallpaper.prototype.drawPhoto = function(time){
    var ctx=this.ctx,w=this.width,h=this.height;
    ctx.fillStyle="#050507";ctx.fillRect(0,0,w,h);
    if(!this.imageReady||!this.image)return;

    var img=this.image,iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
    var scale=Math.max(w/iw,h/ih);
    var dw=iw*scale,dh=ih*scale;
    var dx=(w-dw)/2,dy=(h-dh)/2;

    // Keep the photograph itself completely still.
    ctx.drawImage(img,dx,dy,dw,dh);
    if(prefersReducedMotion)return;

    var preset=this.wallpaper.livePreset||"cinematic";
    var self=this;

    function waterShimmer(startRatio,endRatio,warm){
      var y0=h*startRatio,y1=h*endRatio;
      ctx.save();
      ctx.beginPath();ctx.rect(0,y0,w,y1-y0);ctx.clip();
      ctx.globalCompositeOperation="screen";

      var lineColor=warm?"255,205,132":"188,232,255";
      for(var i=0;i<9;i+=1){
        var base=y0+(y1-y0)*(.08+i*.105);
        ctx.beginPath();
        for(var x=-20;x<=w+20;x+=12){
          var y=base+Math.sin(x*.038+time*.0015+i*.75)*1.25+Math.sin(x*.011-time*.0008+i)*.75;
          if(x===-20)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.strokeStyle="rgba("+lineColor+","+(.018+i*.0025)+")";
        ctx.lineWidth=.55+(i%3)*.12;
        ctx.stroke();
      }

      for(var s=0;s<Math.min(24,self.items.length);s+=1){
        var p=self.items[s];
        var x=(p.x+Math.sin(time*.0009+p.phase)*5+w)%w;
        var y=y0+(p.y%(Math.max(1,y1-y0)));
        var pulse=.5+.5*Math.sin(time*.0022+p.phase);
        var a=.018+p.z*.035+pulse*.012;
        ctx.fillStyle=warm?"rgba(255,214,148,"+a+")":"rgba(205,239,255,"+a+")";
        ctx.fillRect(x,y,1.2+p.z*2.6,.5+p.z*.7);
      }
      ctx.restore();
    }


    function fallingPetals(startRatio,endRatio,count,colorA,colorB){
      ctx.save();
      for(var i=0;i<Math.min(count,self.items.length);i+=1){
        var p=self.items[i],span=h*(endRatio-startRatio)+40;
        var y=h*startRatio+((p.y+time*.020*(.35+p.speed))%span)-20;
        var x=(p.x+Math.sin(time*.0008+p.phase)*24+w)%w;
        var a=.07+p.z*.16;
        ctx.fillStyle=i%3===0?colorA:colorB;
        ctx.globalAlpha=a;
        ctx.beginPath();
        ctx.ellipse(x,y,1.2+p.z*2.0,.7+p.z*1.1,p.phase+time*.00055,0,Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }

    function snow(count){
      ctx.save();
      for(var i=0;i<Math.min(count,self.items.length);i+=1){
        var p=self.items[i],y=(p.y+time*.016*(.5+p.speed))%(h+24)-12;
        var x=(p.x+Math.sin(time*.00065+p.phase)*10+w)%w;
        ctx.fillStyle="rgba(255,255,255,"+(.07+p.z*.22)+")";
        ctx.beginPath();ctx.arc(x,y,.6+p.z*1.6,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }

    function rain(count){
      ctx.save();ctx.lineCap="round";
      for(var i=0;i<Math.min(count,self.items.length);i+=1){
        var p=self.items[i],y=(p.y+time*.052*p.speed)%(h+48)-20;
        ctx.beginPath();ctx.moveTo(p.x,y);ctx.lineTo(p.x-3,y+13+p.z*18);
        ctx.strokeStyle="rgba(205,225,255,"+(.045+p.z*.13)+")";
        ctx.lineWidth=.5+p.z;ctx.stroke();
      }
      ctx.restore();
    }

    function aurora(){
      ctx.save();ctx.globalCompositeOperation="screen";
      for(var i=0;i<4;i+=1){
        ctx.beginPath();
        for(var x=-30;x<=w+30;x+=10){
          var y=h*(.10+i*.07)+Math.sin(x*.018+time*.0010+i*1.35)*17+Math.sin(x*.006-time*.00055+i)*7;
          if(x===-30)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.strokeStyle="rgba(70,255,182,"+(.028+i*.010)+")";
        ctx.lineWidth=7+i*4;ctx.shadowBlur=16;ctx.shadowColor="#42ffc2";ctx.stroke();
      }
      ctx.restore();
    }

    function cloudMist(startRatio,endRatio){
      ctx.save();
      for(var i=0;i<8;i+=1){
        var p=self.items[i],x=((p.x+time*.006*(.3+p.speed))%(w+180))-90;
        var y=h*(startRatio+(endRatio-startRatio)*((i%5)/5))+Math.sin(time*.0003+p.phase)*7;
        var r=35+p.z*55;
        var g=ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,"rgba(255,255,255,"+(.010+p.z*.010)+")");
        g.addColorStop(1,"rgba(255,255,255,0)");
        ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
      }
      ctx.restore();
    }

    function warmFlicker(cx,cy,radius){
      var flicker=.5+.5*Math.sin(time*.0042+self.seed);
      var g=ctx.createRadialGradient(w*cx,h*cy,0,w*cx,h*cy,Math.max(w,h)*radius);
      g.addColorStop(0,"rgba(255,174,78,"+(.012+flicker*.014)+")");
      g.addColorStop(1,"rgba(255,174,78,0)");
      ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    }

    function embers(count){
      ctx.save();ctx.globalCompositeOperation="screen";
      for(var i=0;i<Math.min(count,self.items.length);i+=1){
        var p=self.items[i],y=h*.78-((p.y+time*.018*(.4+p.speed))%(h*.28));
        var x=w*.48+Math.sin(time*.001+p.phase)*(24+p.z*34);
        ctx.fillStyle=i%3===0?"rgba(255,225,140,.45)":"rgba(255,120,45,.38)";
        ctx.beginPath();ctx.arc(x,y,.6+p.z*1.5,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }

    function twinkleLights(count,startRatio,endRatio){
      ctx.save();ctx.globalCompositeOperation="screen";
      for(var i=0;i<Math.min(count,self.items.length);i+=1){
        var p=self.items[i];
        if(p.y<h*startRatio||p.y>h*endRatio)continue;
        var pulse=.15+.35*(.5+.5*Math.sin(time*.003+p.phase));
        var color=i%3===0?"#ffd38b":"#d8edff";
        ctx.fillStyle=rgba(color,pulse);
        ctx.beginPath();ctx.arc(p.x,p.y,.45+p.z*1.15,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }

    function birds(count){
      ctx.save();ctx.lineWidth=.8;ctx.strokeStyle="rgba(20,20,25,.34)";
      for(var i=0;i<count;i+=1){
        var p=self.items[i],x=(p.x+time*.010*(.2+p.speed))%(w+30)-15,y=h*.12+(p.y%(h*.24));
        var s=1.5+p.z*2;
        ctx.beginPath();ctx.moveTo(x-s,y);ctx.quadraticCurveTo(x,y-s,x+s,y);
        ctx.moveTo(x+s,y);ctx.quadraticCurveTo(x+s*2,y-s*.7,x+s*3,y);ctx.stroke();
      }
      ctx.restore();
    }

    function balloons(count){
      ctx.save();
      for(var i=0;i<count;i+=1){
        var p=self.items[i],x=(p.x+Math.sin(time*.00025+p.phase)*8+w)%w;
        var y=h*.12+((p.y+time*.0025*(.25+p.speed))%(h*.36));
        var s=2+p.z*3.5,alpha=.10+p.z*.12;
        ctx.fillStyle=i%2?"rgba(226,105,58,"+alpha+")":"rgba(245,191,88,"+alpha+")";
        ctx.beginPath();ctx.ellipse(x,y,s,s*1.25,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle="rgba(60,35,22,"+(alpha*.8)+")";ctx.fillRect(x-.6,y+s*1.25,1.2,1.4);
      }
      ctx.restore();
    }

    function tawafOrbit(){
      var cx=w*.5,cy=h*.69,rx=w*.24,ry=h*.105;
      ctx.save();
      for(var i=0;i<34;i+=1){
        var p=self.items[i],a=p.phase+time*.00045*(.45+p.speed);
        var x=cx+Math.cos(a)*rx*(.35+p.z*.65);
        var y=cy+Math.sin(a)*ry*(.35+p.z*.65);
        ctx.fillStyle=i%5===0?"rgba(18,18,20,.20)":"rgba(255,255,255,.20)";
        ctx.beginPath();ctx.arc(x,y,.45+p.z*.9,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }

    switch(preset){
      case "venice":
        waterShimmer(.52,1,true);
        break;
      case "lagoon":
        waterShimmer(.46,1,false);
        break;
      case "coast":
        waterShimmer(.46,1,false);
        break;
      case "iceland":
        waterShimmer(.62,1,false);
        aurora();
        break;
      case "aurora":
        aurora();
        snow(34);
        break;
      case "garden":
        waterShimmer(.66,1,false);
        fallingPetals(.02,1,42,"rgba(255,182,215,.48)","rgba(255,231,239,.34)");
        break;
      case "lavender":
        fallingPetals(.05,1,30,"rgba(160,112,220,.30)","rgba(235,205,255,.24)");
        cloudMist(.04,.24);
        break;
      case "santorini":
        fallingPetals(.02,1,24,"rgba(255,96,123,.34)","rgba(255,190,205,.24)");
        waterShimmer(.47,.72,false);
        break;
      case "alpine":
        waterShimmer(.58,1,false);
        cloudMist(.16,.38);
        snow(18);
        break;
      case "raincity":
        rain(72);
        waterShimmer(.74,1,true);
        twinkleLights(24,.20,.70);
        break;
      case "camp":
        warmFlicker(.50,.73,.24);
        embers(30);
        break;
      case "office":
        warmFlicker(.42,.58,.24);
        break;
      case "mosque":
        warmFlicker(.55,.70,.38);
        birds(8);
        break;
      case "tawaf":
        warmFlicker(.50,.70,.42);
        tawafOrbit();
        break;
      case "balloons":
        balloons(12);
        cloudMist(.05,.34);
        break;
      case "canyon":
        cloudMist(.05,.30);
        warmFlicker(.54,.46,.36);
        break;
      case "road":
        cloudMist(.03,.18);
        break;
      default:
        twinkleLights(16,.10,.72);
    }

    var shade=ctx.createLinearGradient(0,0,0,h);
    shade.addColorStop(0,"rgba(0,0,0,.015)");
    shade.addColorStop(.75,"rgba(0,0,0,.01)");
    shade.addColorStop(1,"rgba(0,0,0,.12)");
    ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
  };

  CanvasWallpaper.prototype.drawScene = function(time){
    var ctx=this.ctx,w=this.width,h=this.height,c=this.wallpaper.colors,scene=this.wallpaper.scene||"mountains",t=time*.0002;
    function sky(top,bottom){var g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,top);g.addColorStop(1,bottom);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
    function sun(x,y,r,color,a){var g=ctx.createRadialGradient(x,y,0,x,y,r*3);g.addColorStop(0,rgba(color,a));g.addColorStop(.25,rgba(color,a*.35));g.addColorStop(1,rgba(color,0));ctx.fillStyle=g;ctx.fillRect(x-r*3,y-r*3,r*6,r*6);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    function mountain(base,peakX,peakY,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-w*.1,base);ctx.lineTo(peakX,peakY);ctx.lineTo(w*1.1,base);ctx.closePath();ctx.fill();}
    function building(x,y,bw,bh,color,windows){ctx.fillStyle=color;ctx.fillRect(x,y,bw,bh);if(windows){for(var yy=y+10;yy<y+bh-8;yy+=14){for(var xx=x+8;xx<x+bw-6;xx+=12){if(((xx+yy+this.seed)|0)%3!==0){ctx.fillStyle=rgba(c[2],.35+.2*Math.sin(t*6+xx));ctx.fillRect(xx,yy,4,6);}}}}}
    function person(x,base,scale){ctx.save();ctx.translate(x,base);ctx.fillStyle="rgba(3,4,8,.9)";ctx.beginPath();ctx.arc(0,-72*scale,13*scale,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(-18*scale,-58*scale);ctx.lineTo(18*scale,-58*scale);ctx.lineTo(25*scale,-10*scale);ctx.lineTo(10*scale,0);ctx.lineTo(0,-28*scale);ctx.lineTo(-10*scale,0);ctx.lineTo(-25*scale,-10*scale);ctx.closePath();ctx.fill();ctx.restore();}
    function rain(count,speed){ctx.save();ctx.lineCap="round";for(var i=0;i<count;i+=1){var p=this.items[i%this.items.length],yy=(p.y+time*.06*p.speed*speed)%(h+50)-30;ctx.beginPath();ctx.moveTo(p.x,yy);ctx.lineTo(p.x-4,yy+18+p.z*20);ctx.strokeStyle="rgba(190,220,255,"+(.08+p.z*.22)+")";ctx.lineWidth=.6+p.z;ctx.stroke();}ctx.restore();}
    function road(){ctx.fillStyle="#111319";ctx.beginPath();ctx.moveTo(w*.34,h*.55);ctx.lineTo(w*.66,h*.55);ctx.lineTo(w*.93,h);ctx.lineTo(w*.07,h);ctx.closePath();ctx.fill();ctx.strokeStyle="rgba(255,225,160,.6)";ctx.lineWidth=Math.max(1,w*.008);ctx.setLineDash([h*.04,h*.05]);ctx.beginPath();ctx.moveTo(w*.5,h*.59);ctx.lineTo(w*.5,h);ctx.stroke();ctx.setLineDash([]);}

    switch(scene){
      case "mountains":
        sky("#18233d","#e68f6c");sun(w*.72+Math.sin(t)*8,h*.26,Math.max(16,w*.06),"#ffd69a",.9);
        mountain(h*.66,w*.24,h*.30,"#2c3854");mountain(h*.72,w*.60,h*.36,"#202a43");mountain(h*.78,w*.84,h*.46,"#151d30");
        ctx.fillStyle="rgba(255,255,255,.38)";ctx.beginPath();ctx.moveTo(w*.24,h*.30);ctx.lineTo(w*.19,h*.39);ctx.lineTo(w*.26,h*.36);ctx.lineTo(w*.31,h*.42);ctx.closePath();ctx.fill();
        break;
      case "forest":
        sky("#091b19","#193c2d");ctx.fillStyle="rgba(210,255,229,.08)";ctx.fillRect(0,h*.35,w,h*.2);
        for(var f=0;f<18;f+=1){var fx=(f/17)*w+(Math.sin(t*3+f)*4),fh=h*(.23+.25*((f%5)/5));ctx.fillStyle=f%2?"#0b251b":"#123426";ctx.beginPath();ctx.moveTo(fx,h*.72-fh);ctx.lineTo(fx-w*.06,h*.72);ctx.lineTo(fx+w*.06,h*.72);ctx.closePath();ctx.fill();ctx.fillRect(fx-w*.006,h*.68,w*.012,h*.2);}
        for(var fi=0;fi<Math.min(35,this.items.length);fi+=1){var fp=this.items[fi],fy=(fp.y+Math.sin(t*8+fp.phase)*12)%h;ctx.fillStyle=rgba("#c8ffd7",.15+fp.z*.55);ctx.beginPath();ctx.arc(fp.x,fy,1+fp.z*2,0,Math.PI*2);ctx.fill();}
        break;
      case "coast":
        sky("#0a3752","#efb879");sun(w*.72,h*.24,Math.max(14,w*.05),"#ffe4ae",.75);
        ctx.fillStyle="#083753";ctx.fillRect(0,h*.52,w,h*.48);
        for(var wa=0;wa<6;wa+=1){ctx.beginPath();for(var wx=0;wx<=w;wx+=8){var wy=h*(.58+wa*.06)+Math.sin(wx*.035+t*9+wa)*6;if(wx===0)ctx.moveTo(wx,wy);else ctx.lineTo(wx,wy);}ctx.strokeStyle="rgba(170,238,255,"+(.08+wa*.025)+")";ctx.lineWidth=2;ctx.stroke();}
        ctx.fillStyle="#141b1b";ctx.beginPath();ctx.moveTo(0,h*.48);ctx.lineTo(w*.25,h*.37);ctx.lineTo(w*.32,h*.64);ctx.lineTo(0,h*.7);ctx.closePath();ctx.fill();
        break;
      case "road":
        sky("#4a2b27","#f0a45f");sun(w*.74,h*.22,Math.max(15,w*.055),"#ffe1a1",.85);
        mountain(h*.6,w*.2,h*.38,"#4a3130");mountain(h*.62,w*.72,h*.39,"#56372f");road();
        break;
      case "city-rain":
        sky("#07111f","#15243d");ctx.fillStyle="#0b0f18";ctx.fillRect(0,h*.48,w,h*.52);
        for(var b=0;b<9;b+=1){var bx=b*w*.13-w*.05,bh=h*(.2+.2*((b*3)%7)/7),by=h*.58-bh;ctx.fillStyle=b%2?"#101827":"#0c1321";ctx.fillRect(bx,by,w*.12,bh);for(var wy=by+12;wy<by+bh-8;wy+=15){for(var wx=bx+8;wx<bx+w*.1;wx+=13){ctx.fillStyle=((wx+wy+b)%4===0)?rgba(c[1],.7):rgba(c[2],.28);ctx.fillRect(wx,wy,4,6);}}}
        var rg=ctx.createLinearGradient(0,h*.58,0,h);rg.addColorStop(0,"#0f1520");rg.addColorStop(1,"#05070a");ctx.fillStyle=rg;ctx.fillRect(0,h*.58,w,h*.42);
        ctx.strokeStyle=rgba(c[1],.22);ctx.lineWidth=w*.05;ctx.beginPath();ctx.moveTo(w*.18,h*.65);ctx.lineTo(w*.02,h);ctx.stroke();ctx.strokeStyle=rgba(c[2],.18);ctx.beginPath();ctx.moveTo(w*.76,h*.63);ctx.lineTo(w*.98,h);ctx.stroke();rain.call(this,Math.min(70,this.items.length),1.2);
        break;
      case "alley":
        sky("#080613","#151126");ctx.fillStyle="#0a0b10";ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w*.33,h*.18);ctx.lineTo(w*.4,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(w,0);ctx.lineTo(w*.67,h*.18);ctx.lineTo(w*.6,h);ctx.lineTo(w,h);ctx.closePath();ctx.fill();
        ctx.shadowBlur=18;ctx.shadowColor=c[1];ctx.fillStyle=c[1];ctx.fillRect(w*.09,h*.28,w*.18,h*.035);ctx.shadowColor=c[2];ctx.fillStyle=c[2];ctx.fillRect(w*.72,h*.42,w*.17,h*.035);ctx.shadowBlur=0;ctx.fillStyle="#11141a";ctx.beginPath();ctx.moveTo(w*.39,h*.55);ctx.lineTo(w*.61,h*.55);ctx.lineTo(w*.79,h);ctx.lineTo(w*.21,h);ctx.closePath();ctx.fill();rain.call(this,Math.min(45,this.items.length),.8);
        break;
      case "skyline":
        sky("#050915","#18203d");for(var s=0;s<Math.min(50,this.items.length);s+=1){var sp=this.items[s];ctx.fillStyle="rgba(255,255,255,"+(.25+sp.z*.55)+")";ctx.fillRect(sp.x,sp.y*.45,1+sp.z,1+sp.z);}
        for(var sb=0;sb<12;sb+=1){var sbx=sb*w*.09-w*.03,sbh=h*(.16+.25*((sb*5)%9)/9),sby=h*.72-sbh;ctx.fillStyle=sb%2?"#101523":"#0c111d";ctx.fillRect(sbx,sby,w*.085,sbh);for(var sy=sby+10;sy<sby+sbh-8;sy+=13){ctx.fillStyle=rgba(c[2],.35+.25*Math.sin(t*5+sy));ctx.fillRect(sbx+w*.025,sy,w*.012,5);}}
        ctx.fillStyle="#07090e";ctx.fillRect(0,h*.72,w,h*.28);break;
      case "rooftop":
        sky("#321b35","#f07568");sun(w*.72,h*.22,Math.max(15,w*.055),"#ffcc91",.85);
        ctx.fillStyle="#17141c";for(var rb=0;rb<10;rb+=1){var rh=h*(.1+.15*((rb*2)%5)/5);ctx.fillRect(rb*w*.11,h*.68-rh,w*.1,rh);}ctx.fillStyle="#09090d";ctx.fillRect(0,h*.68,w,h*.32);person(w*.53,h*.74,.78);
        break;
      case "office":
      case "boardroom":
      case "studio":
        sky(scene==="studio"?"#201020":"#15202b",scene==="studio"?"#4b2546":"#8aa4b8");
        ctx.fillStyle="rgba(190,220,240,.16)";for(var p=0;p<6;p+=1)ctx.fillRect(p*w/6,0,1,h*.62);
        ctx.fillStyle="#171a20";ctx.fillRect(0,h*.62,w,h*.38);ctx.fillStyle="#262b33";ctx.fillRect(w*.12,h*.57,w*.76,h*.06);
        if(scene==="boardroom"){ctx.fillStyle="#222832";ctx.beginPath();ctx.ellipse(w*.5,h*.72,w*.36,h*.08,0,0,Math.PI*2);ctx.fill();}
        else{ctx.fillStyle="#0e1117";ctx.fillRect(w*.22,h*.43,w*.24,h*.16);ctx.fillRect(w*.54,h*.42,w*.22,h*.17);ctx.fillStyle=rgba(scene==="studio"?c[1]:c[2],.3+.1*Math.sin(t*8));ctx.fillRect(w*.235,h*.445,w*.21,h*.12);ctx.fillRect(w*.555,h*.445,w*.19,h*.115);}
        break;
      case "desk":
        sky("#090b13","#17172a");ctx.fillStyle="#11141a";ctx.fillRect(0,h*.68,w,h*.32);ctx.fillStyle="#24202a";ctx.fillRect(w*.08,h*.62,w*.84,h*.055);
        ctx.fillStyle="#07080b";ctx.fillRect(w*.18,h*.34,w*.64,h*.27);var mg=ctx.createLinearGradient(w*.2,h*.36,w*.78,h*.58);mg.addColorStop(0,rgba(c[1],.34));mg.addColorStop(1,rgba(c[2],.2));ctx.fillStyle=mg;ctx.fillRect(w*.205,h*.365,w*.59,h*.215);
        ctx.fillStyle=rgba(c[1],.18);ctx.beginPath();ctx.arc(w*.5,h*.55,w*.3,0,Math.PI*2);ctx.fill();break;
      case "street-youth":
      case "portrait-silhouette":
        sky("#08080d","#1b1019");ctx.fillStyle="#101116";for(var ub=0;ub<9;ub+=1){ctx.fillRect(ub*w*.13,h*.64-h*(.1+.18*((ub*3)%7)/7),w*.11,h*.3);}
        var glow=ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,w*.45);glow.addColorStop(0,rgba(c[1],.28));glow.addColorStop(1,rgba(c[1],0));ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);person(w*.5,h*.76,scene==="portrait-silhouette"?1.2:.92);
        break;
      case "rider":
        sky("#09101c","#2b1c22");ctx.fillStyle="#08090d";ctx.fillRect(0,h*.62,w,h*.38);ctx.strokeStyle=rgba(c[1],.45);ctx.lineWidth=3;for(var rl=0;rl<8;rl+=1){var yy=h*(.67+rl*.035);ctx.beginPath();ctx.moveTo((time*.12+rl*80)%w,yy);ctx.lineTo(((time*.12+rl*80)%w)+w*.18,yy);ctx.stroke();}
        ctx.fillStyle="#050608";ctx.beginPath();ctx.arc(w*.42,h*.72,w*.08,0,Math.PI*2);ctx.arc(w*.68,h*.72,w*.08,0,Math.PI*2);ctx.fill();ctx.fillRect(w*.39,h*.62,w*.3,h*.06);person(w*.58,h*.64,.55);break;
      case "runner":
        sky("#07101a","#12223a");ctx.fillStyle="#090b10";ctx.fillRect(0,h*.58,w,h*.42);ctx.strokeStyle=rgba(c[1],.35);ctx.lineWidth=2;for(var tr=0;tr<12;tr+=1){var xx=((tr*w*.12+time*.11)% (w*1.3))-w*.2;ctx.beginPath();ctx.moveTo(xx,h*.7+tr%3*18);ctx.lineTo(xx+w*.22,h*.7+tr%3*18);ctx.stroke();}person(w*.56,h*.71,.75);break;
      case "coastal-drive":
        sky("#12334a","#efaa62");ctx.fillStyle="#0b4b68";ctx.fillRect(0,h*.48,w,h*.52);ctx.fillStyle="#222228";ctx.beginPath();ctx.moveTo(0,h*.62);ctx.lineTo(w*.62,h*.52);ctx.lineTo(w,h*.66);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();ctx.strokeStyle="rgba(255,235,180,.7)";ctx.setLineDash([18,22]);ctx.beginPath();ctx.moveTo(w*.12,h*.76);ctx.lineTo(w*.82,h*.61);ctx.stroke();ctx.setLineDash([]);break;
      case "old-town":
        sky("#17121a","#56402f");ctx.fillStyle="#191515";for(var ot=0;ot<8;ot+=1){var ox=ot*w*.14-w*.04,oh=h*(.24+.15*(ot%3)/3);ctx.fillRect(ox,h*.68-oh,w*.13,oh);ctx.fillStyle=rgba(c[1],.55+.15*Math.sin(t*8+ot));ctx.fillRect(ox+w*.04,h*.55-oh*.35,w*.025,h*.04);ctx.fillStyle="#191515";}ctx.fillStyle="#0d0c0c";ctx.fillRect(0,h*.68,w,h*.32);break;
      default:
        sky(c[0],c[2]);sun(w*.65,h*.28,Math.max(14,w*.05),c[1],.8);
    }

    var vignette=ctx.createRadialGradient(w*.5,h*.46,Math.min(w,h)*.12,w*.5,h*.48,Math.max(w,h)*.72);
    vignette.addColorStop(.45,"rgba(0,0,0,0)");vignette.addColorStop(1,"rgba(0,0,0,.38)");
    ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  };

  function destroyCardRenderers() {
    cardRenderers.forEach(function(item){
      if(item.observer)item.observer.disconnect();
      item.renderer.destroy();
    });
    cardRenderers=[];
  }

  function createCard(wallpaper) {
    var card=document.createElement("article");
    card.className="wall-card";card.tabIndex=0;card.setAttribute("role","button");card.setAttribute("aria-label","Open "+wallpaper.title);

    var visual=document.createElement("div");visual.className="wall-visual";
    var canvas=document.createElement("canvas");canvas.setAttribute("aria-hidden","true");
    var overlay=document.createElement("div");overlay.className="wall-overlay";
    var live=document.createElement("span");live.className="live-badge";live.textContent=wallpaper.realistic?"REALISTIC • LIVE":"LIVE";
    var fav=document.createElement("button");fav.className="favorite-btn"+(favorites.has(wallpaper.id)?" is-favorite":"");fav.type="button";fav.textContent=favorites.has(wallpaper.id)?"♥":"♡";fav.setAttribute("aria-label","Toggle favorite");

    var meta=document.createElement("div");meta.className="wall-meta";
    var title=document.createElement("h3");title.textContent=wallpaper.title;
    var category=document.createElement("p");category.textContent=wallpaper.category;
    meta.appendChild(title);meta.appendChild(category);
    visual.appendChild(canvas);visual.appendChild(overlay);visual.appendChild(live);visual.appendChild(fav);
    card.appendChild(visual);card.appendChild(meta);

    function open(){openPreview(wallpaper);}
    card.addEventListener("click",open);
    card.addEventListener("keydown",function(event){if(event.key==="Enter"||event.key===" "){event.preventDefault();open();}});
    fav.addEventListener("click",function(event){event.stopPropagation();toggleFavorite(wallpaper.id);});

    requestAnimationFrame(function(){
      var renderer=new CanvasWallpaper(canvas,wallpaper,{fps:24,maxDpr:1.2});
      var observer=null;
      if("IntersectionObserver" in window){
        observer=new IntersectionObserver(function(entries){renderer.setVisible(entries[0]?entries[0].isIntersecting:true);},{rootMargin:"120px"});
        observer.observe(card);
      }
      cardRenderers.push({renderer:renderer,observer:observer});
    });
    return card;
  }

  function renderCategories(){
    els.chips.innerHTML="";
    if(!isOnline||!catalogReady)return;
    var categories=["All"].concat(Array.from(new Set(wallpapers.map(function(w){return w.category;}))).sort());
    categories.forEach(function(category){
      var b=document.createElement("button");b.className="chip"+(category===activeCategory?" is-active":"");b.type="button";b.textContent=category;
      b.addEventListener("click",function(){activeCategory=category;renderCategories();renderCatalog();});
      els.chips.appendChild(b);
    });
  }

  function renderCatalog(){
    destroyCardRenderers();
    els.grid.innerHTML="";
    var available=isOnline&&catalogReady;
    els.catalogOffline.hidden=available;
    els.search.disabled=!available;
    if(!available){
      els.results.textContent="";
      els.empty.hidden=true;
      return;
    }
    var filtered=wallpapers.filter(function(w){
      var cat=activeCategory==="All"||w.category===activeCategory;
      var q=(w.title+" "+w.category+" "+w.description).toLowerCase();
      return cat&&q.indexOf(searchTerm.toLowerCase())!==-1;
    });
    filtered.forEach(function(w){els.grid.appendChild(createCard(w));});
    els.empty.hidden=filtered.length!==0;
    els.results.textContent=filtered.length+(filtered.length===1?" wallpaper":" wallpapers");
  }

  function renderFavorites(){
    destroyCardRenderers();
    els.favoritesGrid.innerHTML="";
    var available=isOnline&&catalogReady;
    els.favoritesOffline.hidden=available;
    els.favoritesEmpty.hidden=true;
    if(!available)return;
    var items=wallpapers.filter(function(w){return favorites.has(w.id);});
    items.forEach(function(w){els.favoritesGrid.appendChild(createCard(w));});
    els.favoritesEmpty.hidden=items.length!==0;
  }

  function toggleFavorite(id){
    if(favorites.has(id)){favorites.delete(id);showToast("Removed from favorites");}
    else{favorites.add(id);showToast("Added to favorites");}
    saveFavorites();
    updatePreviewFavorite();
    if(currentVisibleRoute()==="favorites")renderFavorites();else renderCatalog();
  }

  function updatePreviewFavorite(){
    if(!selectedWallpaper)return;
    var active=favorites.has(selectedWallpaper.id);
    els.previewFavorite.classList.toggle("is-favorite",active);
    els.previewFavorite.textContent=active?"♥":"♡";
  }

  function openPreview(wallpaper){
    if(!isOnline||!catalogReady){showToast("Connect to the internet to open wallpapers.");return;}
    selectedWallpaper=wallpaper;
    els.previewTitle.textContent=wallpaper.title;
    els.previewCategory.textContent=wallpaper.category+(wallpaper.realistic?" • REALISTIC LIVE WALLPAPER":" • LIVE WALLPAPER");
    els.previewDescription.textContent=wallpaper.description;
    updatePreviewFavorite();
    els.modal.hidden=false;document.body.style.overflow="hidden";
    history.replaceState(null,"","#wallpaper="+encodeURIComponent(wallpaper.id));
    requestAnimationFrame(function(){
      if(previewRenderer)previewRenderer.destroy();
      previewRenderer=new CanvasWallpaper(els.previewCanvas,wallpaper,{fps:30,maxDpr:2,preview:true});
    });
  }

  function closePreview(updateHash){
    if(els.downloadSheet&&!els.downloadSheet.hidden)closeDownloadSheet();
    if(els.modal.hidden)return;
    els.modal.hidden=true;document.body.style.overflow="";
    if(previewRenderer){previewRenderer.destroy();previewRenderer=null;}
    selectedWallpaper=null;
    if(updateHash!==false)history.replaceState(null,"","#"+currentVisibleRoute());
  }

  function currentVisibleRoute(){
    var active=document.querySelector(".view.is-active");
    return active?active.id.replace("View",""):"home";
  }

  function routeFromHash(){
    var raw=location.hash.replace("#","");
    if(raw.indexOf("wallpaper=")===0)return "home";
    return ["home","favorites","how","about"].indexOf(raw)>=0?raw:"home";
  }

  function routeTo(route,updateHash){
    var valid=["home","favorites","how","about"];
    if(valid.indexOf(route)===-1)route="home";
    document.querySelectorAll(".view").forEach(function(v){v.classList.remove("is-active");});
    var target=document.getElementById(route+"View");if(target)target.classList.add("is-active");
    document.querySelectorAll("[data-route]").forEach(function(b){b.classList.toggle("is-active",b.getAttribute("data-route")===route);});
    if(route==="home")renderCatalog();
    if(route==="favorites")renderFavorites();
    if(updateHash!==false)history.replaceState(null,"","#"+route);
    window.scrollTo({top:0,behavior:prefersReducedMotion?"auto":"smooth"});
  }

  function openDownloadSheet(){
    if(!selectedWallpaper)return;
    if(!els.downloadSheet){saveFrame();return;}
    els.downloadSheet.hidden=false;
    document.body.classList.add("download-open");
  }

  function closeDownloadSheet(){
    if(els.downloadSheet)els.downloadSheet.hidden=true;
    document.body.classList.remove("download-open");
  }

  function showToast(message){
    clearTimeout(toastTimer);els.toast.textContent=message;els.toast.classList.add("is-visible");
    toastTimer=setTimeout(function(){els.toast.classList.remove("is-visible");},2600);
  }

  function setNetworkState(online,label){
    isOnline=!!online;
    document.body.classList.toggle("is-offline",!isOnline);
    els.offlineBar.hidden=isOnline;
    var labelEl=els.networkPill.querySelector("span");
    if(labelEl)labelEl.textContent=label||(isOnline?"Online":"Offline");
    if(!isOnline){
      catalogReady=false;
      if(!els.modal.hidden)closePreview(false);
    }
    renderCategories();
    if(currentVisibleRoute()==="favorites")renderFavorites();else if(currentVisibleRoute()==="home")renderCatalog();
  }

  async function loadWallpapers(showFeedback){
    if(!navigator.onLine){
      setNetworkState(false,"Offline");
      if(showFeedback)showToast("No network connection.");
      return false;
    }
    try{
      var response=await fetch("./data/wallpapers.json?v=15",{cache:"no-store",headers:{"Accept":"application/json"}});
      if(!response.ok)throw new Error("HTTP "+response.status);
      var data=await response.json();
      if(!Array.isArray(data))throw new Error("Invalid wallpaper catalog");
      wallpapers=data.slice().sort(function(a,b){
        return Number(!!b.realistic)-Number(!!a.realistic);
      });catalogReady=true;isOnline=true;
      document.body.classList.remove("is-offline");els.offlineBar.hidden=true;
      var labelEl=els.networkPill.querySelector("span");if(labelEl)labelEl.textContent="Online";
      els.count.textContent=wallpapers.length;
      renderCategories();
      if(currentVisibleRoute()==="favorites")renderFavorites();else renderCatalog();
      if(showFeedback)showToast("Wallpapers are back online.");
      return true;
    }catch(error){
      catalogReady=false;
      setNetworkState(false,navigator.onLine?"Network issue":"Offline");
      if(showFeedback)showToast("Wallpaper service is unavailable. Try again.");
      return false;
    }
  }

  function buildExportCanvas(){
    if(!selectedWallpaper)return null;
    var canvas=document.createElement("canvas");canvas.width=1290;canvas.height=2796;
    var renderer=Object.create(CanvasWallpaper.prototype);
    renderer.canvas=canvas;renderer.ctx=canvas.getContext("2d",{alpha:false});renderer.wallpaper=selectedWallpaper;renderer.options={preview:true};renderer.dpr=1;
    renderer.seed=hashString(selectedWallpaper.id);renderer.random=seededRandom(renderer.seed);renderer.items=[];renderer.width=canvas.width;renderer.height=canvas.height;
    renderer.makeItems();renderer.draw(performance.now());
    return canvas;
  }

  function downloadBlob(blob,name){
    var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1500);
  }

  async function shareFileIfPossible(blob,name,mime,title){
    try{
      var file=new File([blob],name,{type:mime});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:title});
        return true;
      }
    }catch(error){}
    return false;
  }

  async function saveFrame(){
    if(!selectedWallpaper||!isOnline){showToast("Connect to save a wallpaper.");return;}
    if(selectedWallpaper.effect==="photo"&&selectedWallpaper.asset){
      try{
        var response=await fetch(selectedWallpaper.asset,{cache:"no-store"});
        if(!response.ok)throw new Error("HTTP "+response.status);
        var blob=await response.blob();
        var ext=(blob.type&&blob.type.indexOf("png")!==-1)?".png":".jpeg";
        var name="suhail-"+selectedWallpaper.id+ext;
        var shared=await shareFileIfPossible(blob,name,blob.type||"image/jpeg",selectedWallpaper.title);
        if(shared)showToast("Use the share sheet to save the wallpaper to Photos / Gallery.");
        else{downloadBlob(blob,name);showToast("Original realistic wallpaper saved.");}
      }catch(error){showToast("Could not save this wallpaper. Check your connection.");}
      return;
    }
    var canvas=buildExportCanvas();if(!canvas)return;
    canvas.toBlob(async function(blob){
      if(!blob){showToast("Could not create the image.");return;}
      var name="suhail-"+selectedWallpaper.id+"-1290x2796.png";
      var shared=await shareFileIfPossible(blob,name,"image/png",selectedWallpaper.title);
      if(shared)showToast("Use the share sheet to save the image to Photos / Gallery.");
      else{downloadBlob(blob,name);showToast("High-resolution wallpaper saved.");}
    },"image/png",1);
  }

  function bestRecordingMime(){
    if(!window.MediaRecorder)return "";
    var choices=["video/mp4","video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"];
    for(var i=0;i<choices.length;i+=1){if(!MediaRecorder.isTypeSupported||MediaRecorder.isTypeSupported(choices[i]))return choices[i];}
    return "";
  }

  function recordLive(){
    if(!selectedWallpaper||!isOnline){showToast("Connect to save a live clip.");return;}
    if(!els.previewCanvas.captureStream||!window.MediaRecorder){showToast("This browser cannot export live video. The still-image option is available.");return;}
    showToast("Recording an 8-second live wallpaper…");
    var mime=bestRecordingMime();
    try{
      var stream=els.previewCanvas.captureStream(30);
      var recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      var chunks=[],button=els.downloadLive,original=button.textContent;
      button.disabled=true;var seconds=8;button.textContent="Recording "+seconds+"s";
      recorder.ondataavailable=function(event){if(event.data&&event.data.size)chunks.push(event.data);};
      recorder.onstop=async function(){
        var type=recorder.mimeType||mime||"video/webm",ext=type.indexOf("mp4")!==-1?".mp4":".webm";
        var blob=new Blob(chunks,{type:type}),name="suhail-"+selectedWallpaper.id+"-live"+ext;
        var shared=await shareFileIfPossible(blob,name,type,selectedWallpaper.title+" live wallpaper");
        if(shared)showToast("Use the share sheet to save the live clip.");
        else{downloadBlob(blob,name);showToast("Live clip saved.");}
        button.disabled=false;button.textContent=original;
      };
      recorder.start(250);
      var timer=setInterval(function(){seconds-=1;if(seconds>0)button.textContent="Recording "+seconds+"s";},1000);
      setTimeout(function(){clearInterval(timer);if(recorder.state!=="inactive")recorder.stop();stream.getTracks().forEach(function(track){track.stop();});},8000);
    }catch(error){
      if(els.downloadLive){els.downloadLive.disabled=false;els.downloadLive.textContent="Live wallpaper";}showToast("Use your phone screen recorder for this browser.");
    }
  }

  function shareCurrent(){
    if(!selectedWallpaper)return;
    var shareUrl=location.origin+location.pathname+"#wallpaper="+encodeURIComponent(selectedWallpaper.id);
    var data={title:selectedWallpaper.title+" — Suhail Live Wallpapers",text:"Check out "+selectedWallpaper.title+" on Suhail Live Wallpapers.",url:shareUrl};
    if(navigator.share)navigator.share(data).catch(function(){});
    else if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(shareUrl).then(function(){showToast("Link copied.");});
    else showToast("Sharing is not available in this browser.");
  }

  function loadTheme(){
    var saved="";
    try{saved=localStorage.getItem("suhail-live-wallpapers:theme")||"";}catch(error){}
    if(saved==="light"||saved==="dark")return saved;
    return window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";
  }

  function applyTheme(theme,persist){
    document.documentElement.setAttribute("data-theme",theme);
    var icon=els.themeToggle.querySelector(".theme-icon"),label=els.themeToggle.querySelector(".theme-label");
    if(icon)icon.textContent=theme==="dark"?"☀":"☾";
    if(label)label.textContent=theme==="dark"?"Light":"Dark";
    els.themeToggle.setAttribute("aria-label","Switch to "+(theme==="dark"?"light":"dark")+" mode");
    var meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute("content",theme==="dark"?"#07070b":"#f4f5f8");
    if(persist){try{localStorage.setItem("suhail-live-wallpapers:theme",theme);}catch(error){}}
  }

  function setupTheme(){
    applyTheme(loadTheme(),false);
    els.themeToggle.addEventListener("click",function(){
      var next=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";
      applyTheme(next,true);
    });
  }

  function setupInstall(){
    window.addEventListener("beforeinstallprompt",function(event){event.preventDefault();deferredInstallPrompt=event;els.install.hidden=false;els.install.textContent="Install";});
    els.install.addEventListener("click",function(){
      if(deferredInstallPrompt){
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(function(){deferredInstallPrompt=null;els.install.hidden=true;});
      }else routeTo("how");
    });
    var isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);
    var standalone=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone;
    document.documentElement.classList.toggle("is-standalone",!!standalone);
    if(isIos&&!standalone){els.install.hidden=false;els.install.textContent="Add to Home";}
    window.addEventListener("appinstalled",function(){els.install.hidden=true;showToast("Suhail Live Wallpapers installed.");});
  }

  function setupServiceWorker(){
    if(!("serviceWorker" in navigator)||!(location.protocol==="https:"||location.hostname==="localhost"))return;
    var reloaded=false;
    navigator.serviceWorker.addEventListener("controllerchange",function(){
      if(reloaded)return;
      reloaded=true;
      location.reload();
    });
    window.addEventListener("load",async function(){
      try{
        var registration=await navigator.serviceWorker.register("./service-worker.js",{updateViaCache:"none"});
        await registration.update();
        setInterval(function(){registration.update().catch(function(){});},15*60*1000);
        document.addEventListener("visibilitychange",function(){
          if(document.visibilityState==="visible"){
            registration.update().catch(function(){});
            if(navigator.onLine)loadWallpapers(false);
          }
        });
      }catch(error){}
    });
  }

  function handleInitialHash(){
    var raw=location.hash.replace("#","");
    if(raw.indexOf("wallpaper=")===0){
      routeTo("home",false);
      if(isOnline&&catalogReady){
        var id=decodeURIComponent(raw.split("=")[1]||"");
        var found=wallpapers.find(function(w){return w.id===id;});
        if(found)setTimeout(function(){openPreview(found);},60);
      }
      return;
    }
    routeTo(routeFromHash(),false);
  }

  function bindEvents(){
    document.querySelectorAll("[data-route]").forEach(function(button){
      button.addEventListener("click",function(event){
        if(button.tagName==="A")event.preventDefault();
        routeTo(button.getAttribute("data-route"));
      });
    });
    els.search.addEventListener("input",function(){searchTerm=els.search.value.trim();renderCatalog();});
    els.explore.addEventListener("click",function(){document.getElementById("catalog").scrollIntoView({behavior:prefersReducedMotion?"auto":"smooth"});});
    els.retryNetwork.addEventListener("click",function(){loadWallpapers(true);});
    document.querySelectorAll("[data-close-preview]").forEach(function(el){el.addEventListener("click",function(){closePreview(true);});});
    els.previewFavorite.addEventListener("click",function(){if(selectedWallpaper)toggleFavorite(selectedWallpaper.id);});
    if(els.download)els.download.addEventListener("click",openDownloadSheet);
    if(els.downloadPhoto)els.downloadPhoto.addEventListener("click",function(){closeDownloadSheet();saveFrame();});
    if(els.downloadLive)els.downloadLive.addEventListener("click",function(){closeDownloadSheet();recordLive();});
    if(els.legacySaveFrame)els.legacySaveFrame.addEventListener("click",saveFrame);
    if(els.legacyRecord)els.legacyRecord.addEventListener("click",recordLive);
    document.querySelectorAll("[data-close-download]").forEach(function(el){el.addEventListener("click",closeDownloadSheet);});
    if(els.share)els.share.addEventListener("click",shareCurrent);
    document.addEventListener("keydown",function(event){
      if(event.key!=="Escape")return;
      if(els.downloadSheet&&!els.downloadSheet.hidden){closeDownloadSheet();return;}
      if(!els.modal.hidden)closePreview(true);
    });

    window.addEventListener("online",function(){loadWallpapers(true);});
    window.addEventListener("focus",function(){if(navigator.onLine)loadWallpapers(false);});
    window.addEventListener("offline",function(){setNetworkState(false,"Offline");showToast("Network lost. Wallpaper browsing is paused.");});
    window.addEventListener("hashchange",function(){
      var raw=location.hash.replace("#","");
      if(raw.indexOf("wallpaper=")===0){
        var id=decodeURIComponent(raw.split("=")[1]||"");
        var found=wallpapers.find(function(w){return w.id===id;});
        if(found&&(!selectedWallpaper||selectedWallpaper.id!==id))openPreview(found);
      }else{
        if(!els.modal.hidden)closePreview(false);
        routeTo(routeFromHash(),false);
      }
    });
  }

  function initHero(){
    var hero={
      id:"offline-aurora",
      effect:"waves",
      colors:["#04131a","#18d4ae","#5879ff"]
    };
    heroRenderer=new CanvasWallpaper(els.heroCanvas,hero,{fps:28,maxDpr:1.4,preview:true});
  }

  async function init(){
    setupTheme();
    bindEvents();
    setupInstall();
    setupServiceWorker();
    initHero();
    routeTo(routeFromHash(),false);
    if(navigator.onLine){
      await loadWallpapers(false);
      handleInitialHash();
    }else{
      setNetworkState(false,"Offline");
      handleInitialHash();
    }
  }

  init();
})();