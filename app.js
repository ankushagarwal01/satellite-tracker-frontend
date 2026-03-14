const map = L.map('map', {
  minZoom: 3,
  maxZoom: 10,
  worldCopyJump: false,
  maxBounds: [[-90, -180], [90, 180]],
  maxBoundsViscosity: 1.0
}).setView([20, 0], 3);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap contributors © CARTO'
}).addTo(map);

let issMarker = null;
let orbitLine = null;
const issTrail = [];
let lastAlt = '—';
let lastVel = '—';

async function updateISS() {
  const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
  const data = await response.json();
  const { latitude, longitude } = data;

  lastAlt = data.altitude.toFixed(1);
  lastVel = data.velocity.toFixed(1);

  issTrail.push([latitude, longitude]);
  if (issTrail.length > 100) issTrail.shift();

  if (issMarker) {
    issMarker.setLatLng([latitude, longitude]);
  } else {
    issMarker = L.circleMarker([latitude, longitude], {
      radius: 6,
      color: '#ffffff',
      fillColor: '#ffffff',
      fillOpacity: 1
    }).addTo(map);
    issMarker.bindPopup('ISS (International Space Station)');
    issMarker.on('click', () => {
      document.getElementById('sat-name').textContent = 'ISS (International Space Station)';
      document.getElementById('sat-alt').textContent = lastAlt;
      document.getElementById('sat-vel').textContent = lastVel;
      document.getElementById('sat-lat').textContent = data.latitude.toFixed(4);
      document.getElementById('sat-lng').textContent = data.longitude.toFixed(4);
    });
  }

  if (orbitLine) {
    orbitLine.setLatLngs(issTrail);
  } else {
    orbitLine = L.polyline(issTrail, { color: '#ffffff', weight: 1, opacity: 0.4 }).addTo(map);
  }
}

updateISS();
setInterval(updateISS, 5000);

const satelliteMarkers = [];

async function loadSatellites() {
  satelliteMarkers.forEach(m => m.remove());
  satelliteMarkers.length = 0;

  const response = await fetch('https://real-time-satellite-tracker.onrender.com/satellites');
  const satellites = await response.json();

  satellites.forEach(sat => {
    const isStarlink = sat.name.toUpperCase().includes('STARLINK');
    const color = isStarlink ? '#ffd700' : '#a0c4ff';

    const marker = L.circleMarker([sat.latitude, sat.longitude], {
      radius: isStarlink ? 4 : 3,
      color: color,
      fillColor: color,
      fillOpacity: isStarlink ? 1 : 0.5
    }).addTo(map);

    marker.bindPopup(sat.name);
    marker.satData = sat;

    marker.on('click', () => {
      document.getElementById('sat-name').textContent = sat.name;
      document.getElementById('sat-alt').textContent = sat.altitude_km.toFixed(1);
      document.getElementById('sat-vel').textContent = '—';
      document.getElementById('sat-lat').textContent = sat.latitude.toFixed(4);
      document.getElementById('sat-lng').textContent = sat.longitude.toFixed(4);
    });

    satelliteMarkers.push(marker);
  });
}

loadSatellites();
setInterval(loadSatellites, 30000);

function getOrbitType(altitude) {
  if (altitude < 2000) return 'LEO';
  if (altitude < 35786) return 'MEO';
  return 'GEO';
}

function showAll() {
  satelliteMarkers.forEach(m => m.addTo(map));
}

function filterByOrbit(type) {
  satelliteMarkers.forEach(m => {
    const orbitType = getOrbitType(m.satData.altitude_km);
    if (orbitType === type) {
      m.addTo(map);
    } else {
      m.remove();
    }
  });
}

function showStarlink() {
  satelliteMarkers.forEach(m => {
    const name = m.getPopup() ? m.getPopup().getContent().toUpperCase() : '';
    if (name.includes('STARLINK')) {
      m.addTo(map);
    } else {
      m.remove();
    }
  });
}

function searchSatellites(query) {
  const q = query.toLowerCase();
  satelliteMarkers.forEach(m => {
    const name = m.getPopup() ? m.getPopup().getContent().toLowerCase() : '';
    if (name.includes(q)) {
      m.addTo(map);
    } else {
      m.remove();
    }
  });
}

async function loadDashboard() {
  const response = await fetch('https://real-time-satellite-tracker.onrender.com/analytics');
  const data = await response.json();

  document.getElementById('total-count').textContent = data.satellite_count;

  const orbitCtx = document.getElementById('orbitChart').getContext('2d');
  new Chart(orbitCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(data.orbit_distribution),
      datasets: [{
        label: 'Satellites',
        data: Object.values(data.orbit_distribution),
        backgroundColor: ['#3a86ff', '#8338ec', '#ff006e']
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#a8c4d8' }, grid: { color: '#0d2035' } },
        y: { ticks: { color: '#a8c4d8' }, grid: { color: '#0d2035' } }
      }
    }
  });

  const operatorCtx = document.getElementById('operatorChart').getContext('2d');
  new Chart(operatorCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(data.operator_distribution),
      datasets: [{
        data: Object.values(data.operator_distribution),
        backgroundColor: ['#06d6a0', '#ffd166', '#ef476f']
      }]
    },
    options: {
      plugins: { legend: { labels: { color: '#a8c4d8' } } }
    }
  });

  const altResponse = await fetch('https://real-time-satellite-tracker.onrender.com/statistics/altitudes');
  const altData = await altResponse.json();

  const altCtx = document.getElementById('altitudeChart').getContext('2d');
  new Chart(altCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(altData),
      datasets: [{
        label: 'Satellites',
        data: Object.values(altData),
        backgroundColor: ['#118ab2', '#06d6a0', '#ffd166', '#ef476f']
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#a8c4d8' }, grid: { color: '#0d2035' } },
        y: { ticks: { color: '#a8c4d8' }, grid: { color: '#0d2035' } }
      }
    }
  });
}

loadDashboard();