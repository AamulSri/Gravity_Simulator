// =======================================
// 🌞 Solar System — Seamless Integration FIXED
// =======================================
window.addEventListener('DOMContentLoaded', () => {
  console.log("✅ Solar System initialized");

  const space = document.getElementById('space');
  const solarSystem = document.getElementById('solarSystem');
  const planets = Array.from(document.querySelectorAll('.planet'));
  const speedRange = document.getElementById('speedRange');
  const trailsToggle = document.getElementById('trailsToggle');
  const audioToggle = document.getElementById('audioToggle');
  const resetViewBtn = document.getElementById('resetView');
  const infoPanel = document.getElementById('infoPanel');
  const infoTitle = document.getElementById('infoTitle');
  const infoFact = document.getElementById('infoFact');
  const infoGravity = document.getElementById('infoGravity');
  const infoRadius = document.getElementById('infoRadius');
  const infoMoons = document.getElementById('infoMoons');
  const closeInfo = document.getElementById('closeInfo');
  const jumpToSim = document.getElementById('jumpToSim');

  const planetData = {
    Sun:     { gravity: 274,   radius: 696340, moons: '—', fact: 'A giant ball of plasma powered by fusion' },
    Mercury: { gravity: 3.7,   radius: 2439.7, moons: 0,   fact: 'Closest planet to the Sun' },
    Venus:   { gravity: 8.87,  radius: 6051.8, moons: 0,   fact: 'Hottest planet with toxic atmosphere' },
    Earth:   { gravity: 9.81,  radius: 6371,   moons: 1,   fact: 'Home sweet home 🌍' },
    Mars:    { gravity: 3.71,  radius: 3389.5, moons: 2,   fact: 'The red planet with frozen poles' },
    Jupiter: { gravity: 24.8,  radius: 69911,  moons: 79,  fact: 'Massive gas giant with Great Red Spot' },
    Saturn:  { gravity: 10.44, radius: 58232,  moons: 82,  fact: 'Adorned with stunning icy rings' },
    Uranus:  { gravity: 8.69,  radius: 25362,  moons: 27,  fact: 'Rotates on its side like a rolling ball' },
    Neptune: { gravity: 11.15, radius: 24622,  moons: 14,  fact: 'Dark blue, with the fastest winds' }
  };

  // --- Stars ---
  (function createStars() {
    for (let i = 0; i < 300; i++) {
      const s = document.createElement('div');
      s.classList.add('star');
      s.style.width = s.style.height = `${Math.random() * 2 + 1}px`;
      s.style.left = `${Math.random() * 100}vw`;
      s.style.top = `${Math.random() * 100}vh`;
      s.style.animationDelay = `${Math.random() * 2}s`;
      space.appendChild(s);
    }
  })();

  // --- Info Panel ---
  let currentPlanet = null;
  function showInfoFor(el) {
    const name = el.dataset.name || 'Unknown';
    const p = planetData[name] || {};
    infoTitle.textContent = name;
    infoFact.textContent = p.fact || '';
    infoGravity.textContent = p.gravity ?? '—';
    infoRadius.textContent = p.radius ?? '—';
    infoMoons.textContent = p.moons ?? '—';
    infoPanel.classList.remove('hidden');
    currentPlanet = el;
  }

  function hideInfo() {
    infoPanel.classList.add('hidden');
    currentPlanet = null;
  }

  planets.forEach(p => {
    p.addEventListener('click', e => {
      e.stopPropagation();
      showInfoFor(p);
    });
  });

  space.addEventListener('click', hideInfo);
  resetViewBtn.addEventListener('click', hideInfo);
  closeInfo.addEventListener('click', hideInfo);

  // --- Speed Control ---
  const orbits = Array.from(document.querySelectorAll('.orbit'));
  const baseDur = orbits.map(o => parseFloat(getComputedStyle(o).animationDuration) || 20);
  function setOrbitSpeed(mult) {
    orbits.forEach((o, i) => {
      const d = baseDur[i];
      o.style.animationDuration = `${d / mult}s`;
    });
  }
  speedRange.addEventListener('input', e => setOrbitSpeed(parseFloat(e.target.value)));
  setOrbitSpeed(1);

  // --- Trails Toggle ---
  trailsToggle.addEventListener('change', e => {
    document.body.classList.toggle('show-trails', e.target.checked);
  });

  // --- Ambient Sound ---
  let audioCtx, osc, gain;
  audioToggle.addEventListener('change', async e => {
    if (e.target.checked) {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        osc = audioCtx.createOscillator();
        gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 35;
        gain.gain.value = 0.015;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
      }
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      gain.gain.linearRampToValueAtTime(0.015, audioCtx.currentTime + 0.2);
    } else if (gain) {
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    }
  });

  // --- Gravity Lab Overlay ---
  const overlay = document.createElement('div');
  overlay.id = 'gravityOverlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0)',
    opacity: '0',
    pointerEvents: 'none',
    transition: 'opacity 1s ease, background 1s ease',
    zIndex: '9998'
  });
  document.body.appendChild(overlay);

  // Create the lab container (actual gravity simulator target)
  const labContainer = document.createElement('div');
  labContainer.id = 'labContainer';
  Object.assign(labContainer.style, {
    position: 'fixed',
    inset: 0,
    display: 'none',
    zIndex: '9999',
    background: 'black'
  });
  document.body.appendChild(labContainer);

  // Return Button
  const backBtn = document.createElement('button');
  backBtn.textContent = '⏪ Return to Solar System';
  Object.assign(backBtn.style, {
    position: 'absolute',
    top: '20px',
    left: '20px',
    padding: '10px 18px',
    border: 'none',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    cursor: 'pointer',
    display: 'none',
    zIndex: '10000'
  });
  document.body.appendChild(backBtn);

  // --- Load Gravity Simulator ---
  async function loadGravityLab(planetName) {
    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';
    overlay.style.background = 'rgba(0,0,0,0.8)';
    solarSystem.style.opacity = '0.1';
    await new Promise(r => setTimeout(r, 1000));

    // Show lab
    labContainer.style.display = 'block';
    backBtn.style.display = 'block';
    solarSystem.style.pointerEvents = 'none';

    // Inject gravity simulator HTML (if not already)
    // Inject gravity simulator HTML (if not already)
  if (!labContainer.hasChildNodes()) {
        const res = await fetch('./gravity/gravity.html');
        const html = await res.text();
        labContainer.innerHTML = html;

        // 👉 add these
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = './gravity/gravity.css';
        document.head.appendChild(css);

        const script = document.createElement('script');
        script.src = './gravity/gravity.js';
        script.defer = true;
        document.body.appendChild(script);
        await new Promise(r => script.onload = r);
        console.log("🌍 Gravity simulator assets loaded.");
  }
 
    // Pass planet data to simulator
    try {
      const data = await (await fetch('./planets.json')).json();
      const planet = data[planetName] || data['Earth'];
      window.setGravityPlanet?.(planet, planetName);
    } catch (err) {
      console.error("❌ Couldn't set planet:", err);
    }

    overlay.style.opacity = '0';
    setTimeout(() => (overlay.style.pointerEvents = 'none'), 1000);
  }

  // --- Return Button Logic ---
  backBtn.addEventListener('click', () => {
    labContainer.innerHTML = '';
    labContainer.style.display = 'none';
    solarSystem.style.opacity = '1';
    solarSystem.style.pointerEvents = 'auto';
    backBtn.style.display = 'none';
  });

  // --- Click → Open Simulator ---
  jumpToSim.addEventListener('click', () => {
    if (!currentPlanet) return alert('Select a planet first!');
    const name = currentPlanet.dataset.name || 'Earth';
    loadGravityLab(name);
  });
});
