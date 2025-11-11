// gravity.js — Phase 5 upgrade + Analytic predicted trajectory overlay
// Keeps all previous features (trajectory, vector, pred-time, impact pause, peak marker, timeScale, etc.)
// Adds: analytic predicted parabolic arc overlay drawn each frame for direct comparison

window.addEventListener('DOMContentLoaded', async () => {
  // --- element references (existing HUD IDs expected) ---
  const canvas = document.getElementById('gravityCanvas');
  const ctx = canvas.getContext('2d');

  const gSlider = document.getElementById('gravitySlider');
  const gVal = document.getElementById('gravityValue');
  const vVal = document.getElementById('velocityVal');
  const hVal = document.getElementById('heightVal');
  const tVal = document.getElementById('timeVal');
  const predVal = document.getElementById('predTimeVal');

  const resetBtn = document.getElementById('resetBtn');
  const timeScaleSlider = document.getElementById('timeScaleSlider');
  const btn025 = document.getElementById('slow25');
  const btn050 = document.getElementById('slow50');
  const btn1x  = document.getElementById('norm');

  const titleEl = document.querySelector('.hud h1');
  const hud = document.querySelector('.hud') || document.body;
  const body = document.body;

  // create energy HUD element if not present
  let energyEl = document.getElementById('energyReadout');
  if (!energyEl) {
    energyEl = document.createElement('div');
    energyEl.id = 'energyReadout';
    energyEl.style.marginTop = '8px';
    energyEl.style.fontSize = '0.88rem';
    energyEl.style.color = '#bfffe8';
    hud.appendChild(energyEl);
  }

  // cinematic overlay for smooth transitions (created if not present)
  let cineOverlay = document.getElementById('cineOverlay');
  if (!cineOverlay) {
    cineOverlay = document.createElement('div');
    cineOverlay.id = 'cineOverlay';
    Object.assign(cineOverlay.style, {
      position: 'fixed',
      inset: '0',
      background: '#000',
      opacity: '0',
      pointerEvents: 'none',
      transition: 'opacity 600ms ease',
      zIndex: 99999
    });
    document.body.appendChild(cineOverlay);
  }

  // ensure canvas sizing
  function sizeCanvas(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  // create stars DOM for depth (keeps earlier aesthetic)
  (function createStars() {
    document.querySelectorAll('.star').forEach(s => s.remove());
    const n = 100;
    for (let i=0;i<n;i++){
      const s = document.createElement('div');
      s.className = 'star';
      const size = Math.random()*2 + 0.8;
      s.style.width = s.style.height = `${size}px`;
      s.style.left = `${Math.random()*100}vw`;
      s.style.top = `${Math.random()*75}vh`;
      s.style.opacity = `${0.2 + Math.random()*0.8}`;
      s.style.animationDelay = `${Math.random()*2}s`;
      document.body.appendChild(s);
    }
  })();

  // --- load planet data and theme (planets.json) ---
  const params = new URLSearchParams(window.location.search);
  const planetName = params.get('planet') || 'Earth';
  let PLANET = {
    gravity: 9.8,
    sky: ['#0b1228','#031123'],
    ground: ['#063042','#001018'],
    accent: '#00e5b0',
    atmosphere: 'rgba(0,230,176,0.06)'
  };

  try {
    const resp = await fetch('planets.json');
    if (resp.ok) {
      const data = await resp.json();
      if (data[planetName]) {
        PLANET = Object.assign(PLANET, data[planetName]);
      } else {
        console.warn(`Planet ${planetName} not found in planets.json — using defaults.`);
      }
    } else {
      console.warn('planets.json not found, using defaults.');
    }
  } catch (err) {
    console.warn('Failed to fetch planets.json — using defaults.', err);
  }

  // apply theme to HUD & document
  titleEl && (titleEl.textContent = `${planetName} Gravity Lab`);
  gVal && (gVal.textContent = PLANET.gravity.toFixed(1));
  document.documentElement.style.setProperty('--accent', PLANET.accent || '#00e5b0');
  body.style.background = `radial-gradient(circle at 50% 20%, ${PLANET.sky[0]}, ${PLANET.sky[1]} 80%)`;

  // --- simulation constants & state ---
  let GRAVITY = PLANET.gravity || parseFloat(gSlider.value || 9.8); // m/s^2
  const PIXELS_PER_METER = 15; // visual scale
  let timeScale = parseFloat(timeScaleSlider?.value) || 1.0; // 0.2..1.0
  const sideLoss = 0.55;
  const bounceLoss = 0.6;

  // ball
  const ball = {
    x: canvas.width/2,
    y: canvas.height/2,
    r: 20,
    vx: 0,
    vy: 0,
    color1: PLANET.accent || '#5be2b5',
    color2: '#0b2233',
    mass: 1.0 // unit mass for energy calculations
  };

  // trajectory, ripple and markers
  let trajectory = [];
  let peakMarker = null;
  let lastTime = performance.now();
  let startTime = lastTime;
  let pausedFrames = 0;
  let ripples = []; // {x,y,radius,alpha,life}

  // --- helper predicted time function (same as earlier) ---
  function predictedTimeToImpact(ypx, vy, g) {
    const yMeters = (canvas.height - 50 - ypx) / PIXELS_PER_METER;
    const vy_m = vy * PIXELS_PER_METER;
    const a = 0.5 * g, b = vy_m, c = -yMeters;
    const disc = b*b - 4*a*c;
    if (disc < 0) return null;
    const t1 = (-b + Math.sqrt(disc)) / (2*a);
    const t2 = (-b - Math.sqrt(disc)) / (2*a);
    const t = Math.max(t1, t2);
    if (!isFinite(t) || t < 0) return null;
    return t;
  }

  // --- NEW: compute predicted trajectory (returns array of points in pixels)
  // We integrate analytically per small time-step using the same units as update().
  function computePredictedTrajectory(ballState, maxSteps = 600, dtStep = 1/60) {
    const pts = [];
    // a_px is acceleration in px/s^2 (note: we include timeScale to match visual speed)
    const a_px = (GRAVITY / PIXELS_PER_METER) * timeScale;
    // initial positions/velocities (px and px-per-frame-ish units used in update)
    const x0 = ballState.x;
    const y0 = ballState.y;
    const vx0 = ballState.vx * 60 * timeScale; // convert to px/s used in update (ball.x += vx * dt * 60 * timeScale)
    const vy0 = ballState.vy * 60 * timeScale;
    const groundY = canvas.height - 50;

    let t = 0;
    for (let i = 0; i < maxSteps; i++, t += dtStep) {
      const x = x0 + vx0 * t;
      const y = y0 + vy0 * t + 0.5 * a_px * t * t;
      pts.push({ x, y });
      if (y + ballState.r >= groundY) break;
    }
    return pts;
  }

  // --- impact ripple helper ---
  function spawnRipple(x, y) {
    ripples.push({ x, y, r: 6, alpha: 0.55, life: 40 });
  }

  // --- energy computation (PE & KE) ---
  function computeEnergy() {
    const h = Math.max((canvas.height - 50 - ball.y) / PIXELS_PER_METER, 0);
    const v_m = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy) * PIXELS_PER_METER;
    const m = ball.mass;
    const PE = m * GRAVITY * h;
    const KE = 0.5 * m * v_m * v_m;
    return { PE, KE, total: PE + KE, v_m, h };
  }

  // --- update physics (keeps pausedFrames behavior and rest detection) ---
  function update(dt) {
    if (pausedFrames > 0) { pausedFrames--; return; }

    // gravity & integrate (timeScale affects velocity & position update)
    ball.vy += (GRAVITY / PIXELS_PER_METER) * dt * timeScale;
    ball.x += ball.vx * dt * 60 * timeScale;
    ball.y += ball.vy * dt * 60 * timeScale;

    // side walls less bouncy (slower)
    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = -ball.vx * sideLoss;
    } else if (ball.x + ball.r > canvas.width) {
      ball.x = canvas.width - ball.r;
      ball.vx = -ball.vx * sideLoss;
    }

    // ground collision
    const groundY = canvas.height - 50;
    if (ball.y + ball.r > groundY) {
      const impactVy = ball.vy;
      ball.y = groundY - ball.r;
      ball.vy = -impactVy * bounceLoss;

      // spawn ripple for visible impacts
      spawnRipple(ball.x, groundY);

      // rest detection
      const restThreshold = 0.05;
      if (Math.abs(ball.vy) < restThreshold && Math.abs(ball.vx) < restThreshold) {
        ball.vx = 0; ball.vy = 0; pausedFrames = 0; ripples =[]; peakMarker = null;
      } else {
        pausedFrames = Math.round(0.18 / (dt || 1/60));
        const apex = (impactVy * impactVy) / (2 * (GRAVITY / PIXELS_PER_METER));
        peakMarker = { x: ball.x, y: ball.y - apex, life: 40 };
      }
    }

    // record trajectory
    trajectory.push({ x: ball.x, y: ball.y });
    if (trajectory.length > 500) trajectory.shift();

    // update ripples
    for (let i = ripples.length-1; i >= 0; i--) {
      const r = ripples[i];
      r.r += 1.6 + Math.random()*0.6;
      r.alpha *= 0.96;
      r.life--;
      if (r.life <= 0 || r.alpha < 0.02) ripples.splice(i,1);
    }

    // decay peak marker
    if (peakMarker && --peakMarker.life <= 0) peakMarker = null;
  }

  // --- draw everything (adds atmosphere, ripples, energy HUD visual) ---
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // sky overlay (subtle)
    const sky = ctx.createLinearGradient(0,0,0,canvas.height);
    sky.addColorStop(0, 'rgba(0,0,0,0.08)');
    sky.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = sky;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // ground dome
    const grd = ctx.createRadialGradient(canvas.width/2, canvas.height + 300, 100, canvas.width/2, canvas.height, 700);
    grd.addColorStop(0, PLANET.ground[0] || '#063042');
    grd.addColorStop(1, PLANET.ground[1] || '#001018');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height + 300, 500, Math.PI, 2*Math.PI);
    ctx.fill();

    // atmosphere haze
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = PLANET.atmosphere || 'rgba(0,230,176,0.06)';
    ctx.beginPath();
    ctx.ellipse(canvas.width/2, canvas.height - 38, canvas.width*0.6, 48, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ground line
    ctx.strokeStyle = `${PLANET.accent || '#00e5b0'}20`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 50);
    ctx.lineTo(canvas.width, canvas.height - 50);
    ctx.stroke();

    // ripples (impact)
    for (const r of ripples) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(200,255,235,${r.alpha*0.9})`;
      ctx.lineWidth = 2;
      ctx.arc(r.x, canvas.height - 50, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- draw analytic predicted trajectory overlay (NEW) ---
    const predicted = computePredictedTrajectory(ball, 800, 1/60);
    if (predicted && predicted.length > 1) {
      ctx.save();
      // dotted style
      ctx.setLineDash([6,6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(230,230,255,0.85)'; // bright predicted line
      ctx.beginPath();
      for (let i = 0; i < predicted.length - 1; i++) {
        const p = predicted[i], q = predicted[i+1];
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // predicted impact marker
      const last = predicted[predicted.length - 1];
      ctx.fillStyle = 'rgba(230,230,255,0.95)';
      ctx.beginPath();
      ctx.arc(last.x, Math.min(last.y, canvas.height - 50), 5, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // trajectory glow (actual recorded)
    if (trajectory.length > 1) {
      ctx.beginPath();
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = `${(PLANET.accent||'#00e5b0')}55`;
      for (let i=0;i<trajectory.length-1;i++){
        const p = trajectory[i], q = trajectory[i+1];
        ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();

      // outer glow stroke
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = `${PLANET.accent||'#00e5b0'}`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i=0;i<trajectory.length-1;i++){
        const p = trajectory[i], q = trajectory[i+1];
        ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // peak marker
    if (peakMarker) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(peakMarker.x, peakMarker.y, 4, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(190,255,230,0.95)';
      ctx.font = '12px Orbitron, sans-serif';
      ctx.fillText('bounce apex', peakMarker.x + 8, peakMarker.y - 8);
    }

    // velocity vector & head
    ctx.beginPath();
    ctx.strokeStyle = PLANET.accent || '#00e5b0';
    ctx.lineWidth = 2;
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x + ball.vx * 0.6, ball.y + ball.vy * 0.6);
    ctx.stroke();

    const ax = ball.x + ball.vx * 0.6, ay = ball.y + ball.vy * 0.6;
    ctx.beginPath();
    ctx.fillStyle = PLANET.accent || '#00e5b0';
    ctx.arc(ax, ay, 4, 0, Math.PI*2);
    ctx.fill();

    // ball (radial)
    const grad = ctx.createRadialGradient(ball.x - 6, ball.y - 6, 2, ball.x, ball.y, ball.r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, PLANET.accent || ball.color1);
    grad.addColorStop(1, '#001122');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
    ctx.fill();

    // impact flash if pausedFrames active (fades)
    if (pausedFrames > 0) {
      const fade = Math.min(pausedFrames / 10, 1);
      const alpha = 0.15 * fade;
      ctx.fillStyle = `rgba(0,230,176,${alpha})`;
      ctx.fillRect(0, canvas.height - 120, canvas.width, 120);
    }
  }

  // --- main loop & readouts ---
  function loop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    update(dt);
    draw();

    // physics readouts
    const { PE, KE, total, v_m, h } = computeEnergy();
    const vms = (ball.vy * PIXELS_PER_METER).toFixed(2);
    const hmeters = Math.max((canvas.height - 50 - ball.y) / PIXELS_PER_METER, 0).toFixed(2);
    const elapsed = ((now - startTime) / 1000).toFixed(2);

    vVal && (vVal.textContent = vms);
    hVal && (hVal.textContent = hmeters);
    tVal && (tVal.textContent = elapsed);
    predVal && (() => {
      const pred = predictedTimeToImpact(ball.y, ball.vy, GRAVITY);
      predVal.textContent = pred === null ? '—' : pred.toFixed(2);
    })();

    // energy readout string
    const peS = (PE).toFixed(2);
    const keS = (KE).toFixed(2);
    energyEl.innerHTML = `PE: <strong>${peS}</strong> J &nbsp; | &nbsp; KE: <strong>${keS}</strong> J`;

    requestAnimationFrame(loop);
  }

  lastTime = performance.now();
  startTime = lastTime;
  requestAnimationFrame(loop);

  // --- UI handlers (preserve old behavior) ---
  gSlider && gSlider.addEventListener('input', (e) => {
    GRAVITY = parseFloat(e.target.value);
    gVal && (gVal.textContent = GRAVITY.toFixed(1));
  });

  timeScaleSlider && timeScaleSlider.addEventListener('input', (e) => {
    timeScale = parseFloat(e.target.value);
  });
  btn025 && btn025.addEventListener('click', ()=> { timeScale = 0.25; timeScaleSlider.value = '0.25'; });
  btn050 && btn050.addEventListener('click', ()=> { timeScale = 0.5; timeScaleSlider.value = '0.5'; });
  btn1x  && btn1x.addEventListener('click',  ()=> { timeScale = 1.0; timeScaleSlider.value = '1'; });

  // cinematic reset (fade + reset physics)
  resetBtn && resetBtn.addEventListener('click', () => {
    cineOverlay.style.transition = 'opacity 220ms ease';
    cineOverlay.style.opacity = '0.9';
    setTimeout(() => {
      ball.x = canvas.width / 2;
      ball.y = canvas.height / 2;
      ball.vx = 0; ball.vy = 0;
      trajectory = []; peakMarker = null; ripples = [];
      startTime = performance.now();
      lastTime = startTime;
      cineOverlay.style.transition = 'opacity 600ms ease';
      cineOverlay.style.opacity = '0';
    }, 220);
  });

  // keyboard shortcuts (keep previous)
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') { resetBtn && resetBtn.click(); e.preventDefault(); }
    else if (e.key === '1') { timeScale = 1; timeScaleSlider && (timeScaleSlider.value='1'); }
    else if (e.key === '2') { timeScale = 0.5; timeScaleSlider && (timeScaleSlider.value='0.5'); }
    else if (e.key === '3') { timeScale = 0.25; timeScaleSlider && (timeScaleSlider.value='0.25'); }
  });

  // ensure canvas is sized and ball centered at startup
  setTimeout(()=> {
    sizeCanvas();
    ball.x = canvas.width/2;
    ball.y = canvas.height/2;
  }, 50);

  // allow external change of planet object at runtime (non-blocking)
  window.setGravityPlanet = (planetObj, name='Planet') => {
    PLANET = Object.assign(PLANET, planetObj || {});
    titleEl && (titleEl.textContent = `${name} Gravity Lab`);
    body.style.background = `radial-gradient(circle at 50% 20%, ${PLANET.sky[0]}, ${PLANET.sky[1]} 80%)`;
    GRAVITY = PLANET.gravity || GRAVITY;
    gVal && (gVal.textContent = GRAVITY.toFixed(1));
    document.documentElement.style.setProperty('--accent', PLANET.accent || '#00e5b0');
    ball.color1 = PLANET.accent || ball.color1;
  };

  console.log('✅ gravity.js upgraded: analytic overlay + planet theme + atmosphere + energy HUD + ripple + transitions loaded.');
});
