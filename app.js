const map = L.map('map', {
  minZoom: 3,
  maxZoom: 10,
  worldCopyJump: false,
  maxBounds: [[-90, -180], [90, 180]],
  maxBoundsViscosity: 1.0
}).setView([20, 0], 3);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
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
    issMarker = L.marker([latitude, longitude]).addTo(map);
  }

  if (orbitLine) {
    orbitLine.setLatLngs(issTrail);
  } else {
    orbitLine = L.polyline(issTrail, { color: 'cyan', weight: 1 }).addTo(map);
  }
}

updateISS();
setInterval(updateISS, 5000);

setTimeout(() => {
  issMarker.on('click', () => {
    const pos = issMarker.getLatLng();
    document.getElementById('sat-name').textContent = 'ISS (International Space Station)';
    document.getElementById('sat-alt').textContent = lastAlt;
    document.getElementById('sat-vel').textContent = lastVel;
    document.getElementById('sat-lat').textContent = pos.lat.toFixed(4);
    document.getElementById('sat-lng').textContent = pos.lng.toFixed(4);
  });
}, 6000);

const orbitColors = {
  LEO: '#00d4ff',
  MEO: '#39ff14',
  GEO: '#ff6b35'
};

function getOrbitType(altitude) {
  if (altitude < 2000) return 'LEO';
  if (altitude < 35786) return 'MEO';
  return 'GEO';
}

const satelliteMarkers = {
  LEO: [],
  MEO: [],
  GEO: []
};

async function loadSatellites() {
  const response = await fetch('http://127.0.0.1:8000/satellites');
  const satellites = await response.json();

  satellites.forEach(sat => {
    const orbitType = getOrbitType(sat.altitude_km);
    const color = orbitColors[orbitType];

    const marker = L.circleMarker([sat.latitude, sat.longitude], {
      radius: 3,
      color: color,
      fillColor: color,
      fillOpacity: 0.8
    }).addTo(map);

    marker.bindPopup(sat.name);

    marker.on('click', () => {
      document.getElementById('sat-name').textContent = sat.name;
      document.getElementById('sat-alt').textContent = sat.altitude_km.toFixed(1);
      document.getElementById('sat-vel').textContent = '—';
      document.getElementById('sat-lat').textContent = sat.latitude.toFixed(4);
      document.getElementById('sat-lng').textContent = sat.longitude.toFixed(4);
    });

    satelliteMarkers[orbitType].push(marker);
  });
}

loadSatellites();

function filterByOrbit(type) {
  Object.keys(satelliteMarkers).forEach(key => {
    satelliteMarkers[key].forEach(m => m.remove());
  });
  satelliteMarkers[type].forEach(m => m.addTo(map));
}

function showAll() {
  Object.keys(satelliteMarkers).forEach(key => {
    satelliteMarkers[key].forEach(m => m.addTo(map));
  });
}

function searchSatellites(query) {
  const q = query.toLowerCase();
  Object.values(satelliteMarkers).forEach(markers => {
    markers.forEach(m => {
      const name = m.getPopup() ? m.getPopup().getContent().toLowerCase() : '';
      if (name.includes(q)) {
        m.addTo(map);
      } else {
        m.remove();
      }
    });
  });
}

async function loadDashboard() {
  const response = await fetch('http://127.0.0.1:8000/analytics');
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
        backgroundColor: ['#00d4ff', '#39ff14', '#ff6b35']
      }]
    },
    options: {
      plugins: {
        legend: { display: false }
      },
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
        backgroundColor: ['#00d4ff', '#39ff14', '#ff6b35']
      }]
    },
    options: {
      plugins: {
        legend: { labels: { color: '#a8c4d8' } }
      }
    }
  });
}

loadDashboard();