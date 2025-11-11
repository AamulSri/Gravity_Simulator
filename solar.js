// solar.js — corrected, non-destructive fixes
window.addEventListener('DOMContentLoaded', () => {
  console.log("Solar System initialized (fixed)");

  const space = document.getElementById('space');
  const solarSystem = document.getElementById('solarSystem');
  const planets = Array.from(document.querySelectorAll('.planet'));
  const orbits = Array.from(document.querySelectorAll('.orbit'));
  const speedRange = document.getElementById('speedRange');
  const trailsToggle = document.getElementById('trailsToggle');
  const resetViewBtn = document.getElementById('resetView');
  const infoPanel = document.getElementById('infoPanel');
  const infoTitle = document.getElementById('infoTitle');
  const infoFact = document.getElementById('infoFact');
  const infoGravity = document.getElementById('infoGravity');
  const infoRadius = document.getElementById('infoRadius');
  const infoMoons = document.getElementById('infoMoons');
  const closeInfo = document.getElementById('closeInfo');
  const jumpToSim = document.getElementById('jumpToSim');

  // planet metadata
  const planetData = {
    Sun:     { gravity: 274,   radius: 696340, moons: '—', color: '#ffb347' },
    Mercury: { gravity: 3.7,   radius: 2439.7, moons: 0,   color: '#bdbdbd' },
    Venus:   { gravity: 8.87,  radius: 6051.8, moons: 0,   color: '#e5c97b' },
    Earth:   { gravity: 9.81,  radius: 6371,   moons: 1,   color: '#2e86de' },
    Mars:    { gravity: 3.71,  radius: 3389.5, moons: 2,   color: '#ff7043' },
    Jupiter: { gravity: 24.8,  radius: 69911,  moons: 79,  color: '#f7e3b2' },
    Saturn:  { gravity: 10.44, radius: 58232,  moons: 82,  color: '#f9e7a5' },
    Uranus:  { gravity: 8.69,  radius: 25362,  moons: 27,  color: '#a8ffff' },
    Neptune: { gravity: 11.15, radius: 24622,  moons: 14,  color: '#5a8bff' }
  };

  // create stars (only if not already present)
  if (!space.querySelector('.star')) {
    for (let i = 0; i < 220; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      s.style.width = s.style.height = `${Math.random() * 2 + 1}px`;
      s.style.left = `${Math.random() * 100}vw`;
      s.style.top = `${Math.random() * 100}vh`;
      s.style.animationDelay = `${Math.random() * 3}s`;
      space.appendChild(s);
    }
  }

  // Ensure orbits don't block pointer events (defensive)
  orbits.forEach(o => o.style.pointerEvents = 'none');

  // Info panel management
  let currentPlanet = null;
  function showInfo(el) {
    const name = el.dataset.name;
    const p = planetData[name] || {};
    infoTitle.textContent = name;
    infoFact.textContent = el.dataset.fact || p.fact || '';
    infoGravity.textContent = p.gravity ?? '—';
    infoRadius.textContent = p.radius ?? '—';
    infoMoons.textContent = p.moons ?? '—';
    infoPanel.classList.remove('hidden');

    // visual pulse
    planets.forEach(pl => pl.classList.remove('pulse'));
    el.classList.add('pulse');
    currentPlanet = el;

    // center the clicked planet (smooth)
    const rect = el.getBoundingClientRect();
    const cx = window.innerWidth / 2 - (rect.left + rect.width / 2);
    const cy = window.innerHeight / 2 - (rect.top + rect.height / 2);
    solarSystem.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px)) scale(1.8)`;
  }

  function hideInfo() {
    infoPanel.classList.add('hidden');
    planets.forEach(p => p.classList.remove('pulse'));
    currentPlanet = null;
    // restore transform
    solarSystem.style.transform = 'translate(-50%, -50%) scale(1)';
  }

  // Make sure every planet is clickable & keyboard accessible
  planets.forEach(p => {
    // accessible focus outline
    p.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') showInfo(p);
    });
    // click
    p.addEventListener('click', e => {
      e.stopPropagation();
      showInfo(p);
    });
  });

  // global close handlers
  closeInfo.addEventListener('click', hideInfo);
  document.addEventListener('click', e => {
    // if click occurs outside solarSystem and info panel, hide
    const insideSolar = solarSystem.contains(e.target);
    const insideInfo = infoPanel.contains(e.target);
    if (!insideSolar && !insideInfo) hideInfo();
  });

  // Reset view button (restores original centered transform)
  resetViewBtn.addEventListener('click', () => {
    hideInfo();
    // remove any inline transform and return to base centered transform
    solarSystem.style.transform = 'translate(-50%, -50%) scale(1)';
  });

  // Orbit speed control: uses orbit elements durations (non-destructive)
  const baseDur = orbits.map(o => {
    const d = getComputedStyle(o).animationDuration;
    return parseFloat(d) || 20;
  });
  speedRange.addEventListener('input', e => {
    const mult = parseFloat(e.target.value) || 1;
    orbits.forEach((o, i) => {
      o.style.animationDuration = `${baseDur[i] / mult}s`;
    });
  });

  // trails toggle (uses ::before on planet) — avoids colliding with Saturn ::after ring
  trailsToggle.addEventListener('change', e => {
    document.body.classList.toggle('show-trails', e.target.checked);
  });

  // Open gravity simulator link (passes planet name in query)
  const jumpHandler = () => {
    if (!currentPlanet) return alert('Select a planet first!');
    const name = currentPlanet.dataset.name || 'Earth';
    window.location.href = `./gravity/gravity.html?planet=${encodeURIComponent(name)}`;
  };
  const jumpBtn = document.getElementById('jumpToSim');
  if (jumpBtn) jumpBtn.addEventListener('click', jumpHandler);

  // Remove/disable any audio toggle if present (explicitly no sound)
  const audioToggle = document.getElementById('audioToggle');
  if (audioToggle) {
    audioToggle.checked = false;
    audioToggle.disabled = true;
  }

  // small accessibility: focus first planet (optional)
  // planets[2]?.focus(); // uncomment if you want Earth focused by default
  console.log("Solar system ready — planets clickable, trails fixed, reset works.");
});
