/* ==========================================================================
   CurbSpace IQ - Core Simulation Engine, State Manager & Event Handling
   ========================================================================= */

// Global Application State Machine
const state = {
  currentZoneIndex: 1, // 1: T. Nagar, 2: Thiruvanmiyur, 3: Parrys Corner
  currentTimeOfDay: 'morning', // 'morning' | 'afternoon' | 'evening'
  showViolationsOnly: false,
  currentTheme: 'dark', // 'dark' | 'light'
  searchQuery: '',
  vendorTypeFilter: 'All',
  sortBy: 'pitchID',
  sortOrder: 'asc', // 'asc' | 'desc'
  escalatedPitches: [], // List of pitchIDs escalated to Greater Chennai Corporation (GCC)
  
  // Municipal Centers Seed Data (Chennai target maps - GCC & NITI Aayog Standards)
  zones: [
    {
      id: 1,
      name: "T. Nagar",
      coords: [13.0416, 80.2337],
      trafficProfile: { morning: 95, afternoon: 68, evening: 90 }, // Commuter morning rush = 95
      trafficStatus: { morning: "Heavy Commute - Index 95", afternoon: "Moderate Transit Flow", evening: "Peak Commercial Outing" }
    },
    {
      id: 2,
      name: "Thiruvanmiyur",
      coords: [12.9830, 80.2594],
      trafficProfile: { morning: 52, afternoon: 94, evening: 72 }, // Afternoon peak = 94 (Beach crowd/Midday)
      trafficStatus: { morning: "Quiet Beach Entry", afternoon: "Peak Midday Shore Rush", evening: "Post-Work Beach Gathering" }
    },
    {
      id: 3,
      name: "Parrys Corner",
      coords: [13.0898, 80.2902],
      trafficProfile: { morning: 72, afternoon: 88, evening: 92 }, // Steady wholesale bazaar flow
      trafficStatus: { morning: "Bazaar Setup Flow", afternoon: "Intense Wholesale Trade", evening: "Peak Transit Exchange Rush" }
    }
  ],
  
  pitches: [] // Populated procedurally during initialization
};

// Global Map and Chart variables
let map;
let markerGroup;
let tileLayer;

// Dynamic time-sharing double-leasing pitch adapter (Test Case 4)
function getActivePitchProperties(pitch) {
  // Test Case 4: The Dynamic Time-Sharing Pitch (Double-Leasing Validation)
  // At Afternoon Lull (2:00 PM - afternoon) or Morning, CV-ST-105 is an "Apparel Vendor".
  // At Evening Peak (8:00 PM - evening), CV-ST-105 becomes a night-shift "Street Food Vendor".
  if (pitch.pitchID === 'CV-ST-105') {
    const isEvening = (state.currentTimeOfDay === 'evening');
    return {
      ...pitch,
      vendorName: isEvening ? "Night-Shift Street Food" : "Day-Shift Apparel Store",
      vendorType: isEvening ? "Food Joint" : "Apparel",
      status: "Permitted",
      revenueHistory: isEvening 
        ? { morning: 0, afternoon: 0, evening: 390 }
        : { morning: 110, afternoon: 240, evening: 0 }
    };
  }
  return pitch;
}

// Commuter rush hour peak demand shift (Test Case 1) revenue calculator
function getPitchRevenue(pitch, timeframe) {
  const activePitch = getActivePitchProperties(pitch);
  if (activePitch.status === 'Open/Available') return 0;

  let baseRev = activePitch.revenueHistory[timeframe];
  
  // Test Case 1: Commuter Morning Rush at T. Nagar (Zone 1)
  if (state.currentZoneIndex === 1 && timeframe === 'morning') {
    if (activePitch.vendorType === 'Coffee/Newspaper Stand') {
      return baseRev * 1.5; // Spike stand by 1.5x (Traditional Filter Coffee stall)
    } else if (activePitch.vendorType === 'Food Joint') {
      return baseRev * 1.5; // Spike breakfast food joint by 1.5x (Idli/Dosa hub)
    } else if (activePitch.vendorType === 'Artisan Craft') {
      return 0.00; // Artisan craft drops to near-zero utility ($0.00)
    }
  }
  return baseRev;
}

// Procedural Generator for Bounding Area Pitches
function initializePitches() {
  state.pitches = [];
  const vendorTypes = ['Food Joint', 'Apparel', 'Artisan Craft', 'Coffee/Newspaper Stand'];

  state.zones.forEach((zone, zoneIdx) => {
    const centerLat = zone.coords[0];
    const centerLon = zone.coords[1];
    const zoneNum = zone.id; // 1, 2, 3

    // Generate exactly 6 pitches within 200m radius of center
    for (let i = 1; i <= 6; i++) {
      let pitchID = `PITCH-CHN-${zoneNum}0${i}`;
      
      // Test Case 4: Force physical spot CV-ST-105 in Parrys Corner (Zone 3)
      if (zoneNum === 3 && i === 5) {
        pitchID = 'CV-ST-105';
      }

      const vendorName = `Vendor ${zoneNum}0${i}`;
      const vendorType = vendorTypes[(i - 1) % vendorTypes.length];
      
      // Bounding Distribution: Spread angles and deterministic offset radii
      const angle = (i * 2 * Math.PI) / 6; // Perfect circular spread
      const distance = 40 + (i * 22); // Spreads pitches between 40m and 150m from center
      
      // Precision coordinate offsets (1m in Chennai latitude ~ 0.000009, lon ~ 0.0000092)
      const latOffset = Math.sin(angle) * distance * 0.000009;
      const lonOffset = Math.cos(angle) * distance * 0.0000092;
      const coords = [centerLat + latOffset, centerLon + lonOffset];

      // Procedural compliance statuses distribution (each zone has at least 1 warning violation)
      let status = 'Permitted';
      let aiVisionLog = '';
      
      if (i === 1) {
        status = 'Zoning Violation';
        aiVisionLog = zoneNum === 1
          ? "Vendor cart blocking pedestrian flow line detected via camera feed index #48."
          : zoneNum === 2
            ? "Hydrant clearance warning: stand positioned within 8 feet of active fire hydrant plug."
            : "Crosswalk overlap: artisan layout encroaching on standard wheelchair-accessible ramp pathway.";
      } else if (i === 5 && zoneNum === 2) {
        status = 'Zoning Violation';
        aiVisionLog = "Pedestrian pathway warning: active patron queue overflow blocking adjacent storefront safety doors.";
      } else if (i === 3 || i === 6) {
        status = 'Open/Available';
      }

      // Climate Engine variables (ensuring at least 2 available spots are solar spots in Thiruvanmiyur)
      // For Thiruvanmiyur (Zone 2), available pitches are pitch 3 and pitch 6. Both get solar active!
      const solarYieldSpot = (zoneNum === 2 && (i === 3 || i === 6)) || (i % 2 === 0);
      const airQualityAlert = (i % 3 === 0);

      // Base Revenue Profiles matching Zone and vendor categories
      let morning = 140 + (i * 20);
      let afternoon = 95 + (i * 15);
      let evening = 180 + (i * 25);
      
      if (zoneNum === 1) {
        evening = 380 + (i * 40); // high evening transit profile
      } else if (zoneNum === 2) {
        afternoon = 420 + (i * 50); // high beach hour peak
      } else {
        evening = 280 + (i * 22); // steady market profile
      }

      state.pitches.push({
        pitchID,
        vendorName,
        vendorType,
        status,
        coords,
        environmentalFlags: { solarYieldSpot, airQualityAlert },
        revenueHistory: { morning, afternoon, evening },
        aiVisionLog,
        zoneId: zoneNum
      });
    }
  });
}

// --------------------------------------------------------------------------
// UI Terminal Logger Component
// --------------------------------------------------------------------------
function logToTerminal(message, type = 'info') {
  const terminal = document.getElementById('operations-terminal');
  if (!terminal) return;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `[${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;
  
  const line = document.createElement('div');
  line.className = 'terminal-line log-entry';
  
  const tsSpan = document.createElement('span');
  tsSpan.className = 'terminal-timestamp';
  tsSpan.textContent = timestamp;
  
  const msgSpan = document.createElement('span');
  msgSpan.className = `terminal-message terminal-${type}`;
  msgSpan.textContent = message;
  
  line.appendChild(tsSpan);
  line.appendChild(msgSpan);
  
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

// --------------------------------------------------------------------------
// Leaflet Map Wrapper Setup
// --------------------------------------------------------------------------
function initializeMap() {
  const defaultZone = state.zones[state.currentZoneIndex - 1];
  
  // Set up Leaflet Map centered on current zone coordinates
  map = L.map('map', {
    zoomControl: true,
    scrollWheelZoom: true,
    maxZoom: 19,
    minZoom: 12
  }).setView(defaultZone.coords, 16.5);

  markerGroup = L.layerGroup().addTo(map);
  updateMapTiles();

  // Asynchronous callback triggered on popup open to load dynamic charts
  map.on('popupopen', function(e) {
    const popupNode = e.popup.getElement();
    const canvas = popupNode.querySelector('canvas');
    if (!canvas) return;

    const pitchID = canvas.id.replace('popup-chart-', '');
    const rawPitch = state.pitches.find(p => p.pitchID === pitchID);
    if (!rawPitch) return;
    
    // Load dynamic time-shared properties for popups
    const pitch = getActivePitchProperties(rawPitch);
    const ctx = canvas.getContext('2d');
    const isDark = !document.body.classList.contains('light-mode') && !document.body.classList.contains('light-theme');
    
    const gridColor = isDark ? '#334155' : '#E2E8F0';
    const labelColor = isDark ? '#94A3B8' : '#475569';
    
    // Status semantic color configurations
    let lineColor = '#6366F1';
    let fillColor = 'rgba(99, 102, 241, 0.1)';
    if (pitch.status === 'Permitted') {
      lineColor = '#10B981';
      fillColor = 'rgba(16, 185, 129, 0.15)';
    } else if (pitch.status === 'Open/Available') {
      lineColor = '#0EA5E9';
      fillColor = 'rgba(14, 165, 233, 0.15)';
    } else if (pitch.status === 'Zoning Violation') {
      lineColor = '#EF4444';
      fillColor = 'rgba(239, 68, 68, 0.15)';
    }

    // Dynamic spiked calculations for Test Case 1 inside popup chart
    const morningRev = getPitchRevenue(pitch, 'morning');
    const afternoonRev = getPitchRevenue(pitch, 'afternoon');
    const eveningRev = getPitchRevenue(pitch, 'evening');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Morning', 'Afternoon', 'Evening'],
        datasets: [{
          data: [morningRev, afternoonRev, eveningRev],
          borderColor: lineColor,
          backgroundColor: fillColor,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: lineColor,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Revenue: $${context.raw.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor, drawTicks: false },
            ticks: { color: labelColor, font: { size: 9, weight: '600' } }
          },
          y: {
            grid: { color: gridColor, drawTicks: false },
            ticks: { 
              color: labelColor, 
              font: { size: 9, weight: '600' },
              callback: function(value) { return '$' + value; }
            }
          }
        }
      }
    });
  });
}

function updateMapTiles() {
  if (tileLayer) {
    map.removeLayer(tileLayer);
  }

  // Dynamic selector for high-contrast geospatial backdrop matching active mode
  const tileUrl = state.currentTheme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  const attribution = state.currentTheme === 'dark'
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; OpenStreetMap contributors &copy; CARTO';

  tileLayer = L.tileLayer(tileUrl, { attribution }).addTo(map);
}

function updateSpatialMarkers() {
  markerGroup.clearLayers();

  // Get pitches for active zone
  let activePitches = state.pitches.filter(p => p.zoneId === state.currentZoneIndex);

  // Apply compliance violations toggle filter
  if (state.showViolationsOnly) {
    activePitches = activePitches.filter(p => p.status === 'Zoning Violation');
  }

  activePitches.forEach(rawPitch => {
    const pitch = getActivePitchProperties(rawPitch);

    let markerColorClass = 'marker-permitted';
    if (pitch.status === 'Open/Available') {
      markerColorClass = 'marker-available';
    } else if (pitch.status === 'Zoning Violation') {
      markerColorClass = 'marker-violation';
    }

    // Build responsive Leaflet DOM Icon matching design tokens
    const markerIcon = L.divIcon({
      className: `custom-leaflet-marker ${markerColorClass}`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    // Test Case 3: Available solar yield spot tooltip badge inside Thiruvanmiyur during Afternoon
    const isSolarSpot = pitch.environmentalFlags.solarYieldSpot && pitch.status === 'Open/Available' && state.currentZoneIndex === 2 && state.currentTimeOfDay === 'afternoon';
    const solarAlert = isSolarSpot 
      ? `<div class="mt-2.5 p-2 rounded text-[10px] leading-normal font-extrabold border bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse">
           ☀️ High Solar Yield Spot - Ideal for Electric Carts
         </div>` 
      : '';

    // Custom HTML layout embedded directly inside popup wrapper
    const popupContent = `
      <div class="popup-chart-wrapper">
        <div class="popup-chart-title">${pitch.vendorName}</div>
        <div class="popup-chart-meta">Pitch ID: ${pitch.pitchID} • ${pitch.vendorType}</div>
        <div style="position: relative; height: 110px; width: 100%;">
          <canvas id="popup-chart-${pitch.pitchID}"></canvas>
        </div>
        ${solarAlert}
        ${pitch.status === 'Zoning Violation' 
          ? `<div class="mt-2.5 p-2 rounded text-[10px] leading-normal font-semibold border bg-rose-500/10 border-rose-500/20 text-rose-400">
               <span class="font-extrabold uppercase text-rose-500">AI Vision Violations:</span><br>${pitch.aiVisionLog}
             </div>` 
          : ''
        }
      </div>
    `;

    L.marker(pitch.coords, { icon: markerIcon })
      .bindPopup(popupContent, { 
        minWidth: 260, 
        maxWidth: 280, 
        closeButton: true 
      })
      .addTo(markerGroup);
  });
}

// --------------------------------------------------------------------------
// Core Calculations & KPI Ribbon Synchronization
// --------------------------------------------------------------------------
function updateKpiMetrics() {
  const activeZone = state.zones[state.currentZoneIndex - 1];
  const pitchesInZone = state.pitches.filter(p => p.zoneId === state.currentZoneIndex);
  
  // 1. Traffic index calculation matching junction & timeframe
  const trafficIdx = activeZone.trafficProfile[state.currentTimeOfDay];
  const trafficTxt = activeZone.trafficStatus[state.currentTimeOfDay];
  
  const metricTraffic = document.getElementById('metric-traffic-index');
  const metricTrafficStatus = document.getElementById('metric-traffic-status');
  if (metricTraffic) metricTraffic.textContent = trafficIdx;
  if (metricTrafficStatus) {
    metricTrafficStatus.textContent = trafficTxt;
    if (trafficIdx > 80) {
      metricTrafficStatus.className = "text-xs font-semibold text-rose-500";
    } else if (trafficIdx > 60) {
      metricTrafficStatus.className = "text-xs font-semibold text-indigo-400";
    } else {
      metricTrafficStatus.className = "text-xs font-semibold text-emerald-400";
    }
  }

  // 2. Capacity ratio progress indicator
  // Permitted + Available spots represent standard system limits, warning is exception.
  const activeVendors = pitchesInZone.filter(p => {
    const ap = getActivePitchProperties(p);
    return ap.status === 'Permitted';
  }).length;
  const totalPitches = pitchesInZone.length;
  const capacityPct = Math.round((activeVendors / totalPitches) * 100);

  const capacityText = document.getElementById('metric-capacity-text');
  const capacityPctEl = document.getElementById('metric-capacity-pct');
  const capacityProgress = document.getElementById('metric-capacity-progress');
  if (capacityText) capacityText.textContent = `${activeVendors} / ${totalPitches} Spots`;
  if (capacityPctEl) capacityPctEl.textContent = `${capacityPct}%`;
  if (capacityProgress) capacityProgress.style.width = `${capacityPct}%`;

  // 3. Live Micro-GDP (revenue aggregate matching timeframe slider & COMMUTER RUSH simulations)
  let totalRevenue = 0;
  pitchesInZone.forEach(pitch => {
    const activePitch = getActivePitchProperties(pitch);
    totalRevenue += getPitchRevenue(activePitch, state.currentTimeOfDay);
  });

  const metricGdp = document.getElementById('metric-microgdp');
  if (metricGdp) {
    metricGdp.textContent = `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // 4. Active AI Zoning Alerts
  const activeAlerts = pitchesInZone.filter(p => {
    const ap = getActivePitchProperties(p);
    return ap.status === 'Zoning Violation';
  }).length;
  
  const metricAlerts = document.getElementById('metric-zoning-alerts');
  const metricAlertStatus = document.getElementById('metric-zoning-status');
  const alertCard = document.getElementById('alert-card-container');
  
  if (metricAlerts) metricAlerts.textContent = `${activeAlerts} Active Alert${activeAlerts !== 1 ? 's' : ''}`;
  if (metricAlertStatus) {
    if (activeAlerts > 0) {
      metricAlertStatus.textContent = "AI Zoning Override Alert";
      metricAlertStatus.className = "text-xs font-semibold text-rose-500 animate-pulse";
      if (alertCard) {
        alertCard.classList.add('pulse-warning-alert');
        alertCard.classList.add('pulse-violation-alert');
      }
    } else {
      metricAlertStatus.textContent = "Compliance Maintained";
      metricAlertStatus.className = "text-xs font-semibold text-emerald-400";
      if (alertCard) {
        alertCard.classList.remove('pulse-warning-alert');
        alertCard.classList.remove('pulse-violation-alert');
      }
    }
  }
}

// --------------------------------------------------------------------------
// Bottom Analytics Table Engine & Filtering
// --------------------------------------------------------------------------
function renderAnalyticsTable() {
  const tableBody = document.getElementById('table-body');
  const recordsSummary = document.getElementById('table-records-summary');
  if (!tableBody) return;

  // Clear previous body elements
  tableBody.innerHTML = '';

  // Get pitches for active zone
  let filteredPitches = state.pitches.filter(p => p.zoneId === state.currentZoneIndex);

  // Apply Zoning Violations Toggle Filter
  if (state.showViolationsOnly) {
    filteredPitches = filteredPitches.filter(p => {
      const ap = getActivePitchProperties(p);
      return ap.status === 'Zoning Violation';
    });
  }

  // Apply Dropdown Category Filter
  if (state.vendorTypeFilter !== 'All') {
    filteredPitches = filteredPitches.filter(p => {
      const ap = getActivePitchProperties(p);
      return ap.vendorType === state.vendorTypeFilter;
    });
  }

  // Apply Search query (Case-insensitive across ID, Vendor Name, Type, and AI log)
  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toLowerCase();
    filteredPitches = filteredPitches.filter(p => {
      const ap = getActivePitchProperties(p);
      return ap.pitchID.toLowerCase().includes(q) ||
        ap.vendorName.toLowerCase().includes(q) ||
        ap.vendorType.toLowerCase().includes(q) ||
        ap.aiVisionLog.toLowerCase().includes(q);
    });
  }

  // Sort pitches based on sorting column headers
  filteredPitches.sort((a, b) => {
    const apA = getActivePitchProperties(a);
    const apB = getActivePitchProperties(b);
    let valA, valB;
    if (state.sortBy === 'pitchID') {
      valA = apA.pitchID;
      valB = apB.pitchID;
    } else if (state.sortBy === 'revenue') {
      valA = apA.status === 'Open/Available' ? 0 : getPitchRevenue(apA, state.currentTimeOfDay);
      valB = apB.status === 'Open/Available' ? 0 : getPitchRevenue(apB, state.currentTimeOfDay);
    }

    if (valA < valB) return state.sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return state.sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Render rows
  if (filteredPitches.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-[var(--text-secondary)] font-semibold">
          No matching micro-pitch records detected in the active workspace.
        </td>
      </tr>
    `;
    if (recordsSummary) recordsSummary.textContent = "Showing 0 pitches";
    return;
  }

  filteredPitches.forEach(rawPitch => {
    const pitch = getActivePitchProperties(rawPitch);
    const row = document.createElement('tr');
    
    // Status Badge generator
    let badgeHTML = '';
    if (pitch.status === 'Permitted') {
      badgeHTML = `<span class="badge badge-permitted">Permitted</span>`;
    } else if (pitch.status === 'Open/Available') {
      badgeHTML = `<span class="badge badge-available">Available</span>`;
    } else if (pitch.status === 'Zoning Violation') {
      badgeHTML = `<span class="badge badge-violation pulse-violation-alert pulse-warning-alert">Violation</span>`;
    }

    // Test Case 3: Available solar yield spot badge overlay inside Thiruvanmiyur during Afternoon
    const isSolarSpot = pitch.environmentalFlags.solarYieldSpot && pitch.status === 'Open/Available' && state.currentZoneIndex === 2 && state.currentTimeOfDay === 'afternoon';
    
    const solarHTML = isSolarSpot
      ? `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-extrabold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20" title="High Solar Yield Spot - Ideal for Electric Carts">☀️ High Solar Yield - Ideal for Electric Carts</span>`
      : (pitch.environmentalFlags.solarYieldSpot 
        ? `<span class="inline-flex items-center justify-center h-5 w-5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px]" title="Solar Yield Active Spot">☀️</span>` 
        : '');
        
    const airHTML = pitch.environmentalFlags.airQualityAlert 
      ? `<span class="inline-flex items-center justify-center h-5 w-5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px]" title="Air Quality Warning">💨</span>` 
      : '';

    // Active revenue calculation
    const currentRev = getPitchRevenue(pitch, state.currentTimeOfDay);
    const revenueDisplay = pitch.status === 'Open/Available' 
      ? `<span class="text-[var(--text-secondary)]">—</span>` 
      : `<span class="font-bold text-[var(--text-primary)]">$${currentRev.toFixed(2)}</span>`;

    // Compliance Action column generation
    let actionHTML = '';
    if (pitch.status === 'Zoning Violation') {
      if (state.escalatedPitches && state.escalatedPitches.includes(pitch.pitchID)) {
        actionHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-extrabold rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wider">Escalated</span>`;
      } else {
        actionHTML = `<button class="px-2.5 py-1 text-[9px] font-bold rounded bg-rose-500 hover:bg-rose-600 text-white transition-colors uppercase tracking-wider cursor-pointer" onclick="escalatePitch('${pitch.pitchID}')">Escalate</button>`;
      }
    } else {
      actionHTML = `<span class="text-[9px] font-semibold text-[var(--text-secondary)] opacity-40 uppercase tracking-wider">Compliant</span>`;
    }

    row.innerHTML = `
      <td class="font-mono text-xs font-bold text-indigo-400 select-all">${pitch.pitchID}</td>
      <td>
        <div class="font-bold text-[var(--text-primary)]">${pitch.vendorName}</div>
        ${pitch.status === 'Zoning Violation' 
          ? `<div class="text-[10px] text-rose-400 mt-1 font-semibold">${pitch.aiVisionLog}</div>` 
          : `<div class="text-[10px] text-[var(--text-secondary)] mt-0.5">Compliant Spatial Position</div>`
        }
      </td>
      <td class="font-medium text-xs text-[var(--text-secondary)]">${pitch.vendorType}</td>
      <td>${badgeHTML}</td>
      <td class="text-center">
        <div class="flex justify-center items-center gap-1">
          ${solarHTML || '<span class="text-xs text-[var(--text-secondary)] opacity-30">—</span>'}
          ${airHTML}
        </div>
      </td>
      <td class="text-right">${revenueDisplay}</td>
      <td class="text-right">${actionHTML}</td>
    `;
    
    tableBody.appendChild(row);
  });

  if (recordsSummary) {
    recordsSummary.textContent = `Showing ${filteredPitches.length} of ${state.pitches.filter(p => p.zoneId === state.currentZoneIndex).length} pitches`;
  }
}

function handleSort(column) {
  if (state.sortBy === column) {
    state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortBy = column;
    state.sortOrder = 'asc';
  }

  // Update sort UI icons
  const sortIcons = {
    pitchID: document.getElementById('sort-icon-pitchID'),
    revenue: document.getElementById('sort-icon-revenue')
  };

  Object.keys(sortIcons).forEach(col => {
    if (sortIcons[col]) {
      if (state.sortBy === col) {
        sortIcons[col].textContent = state.sortOrder === 'asc' ? '▲' : '▼';
        sortIcons[col].classList.add('text-indigo-400');
      } else {
        sortIcons[col].textContent = '⇅';
        sortIcons[col].classList.remove('text-indigo-400');
      }
    }
  });

  renderAnalyticsTable();
}

// --------------------------------------------------------------------------
// Core Event Handlers & State Sync
// --------------------------------------------------------------------------
function setupEventListeners() {
  
  // 1. Junction Select changes
  const junctionSelector = document.getElementById('junction-selector');
  if (junctionSelector) {
    junctionSelector.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value, 10);
      state.currentZoneIndex = idx;
      
      const zone = state.zones[idx - 1];
      
      // Update active title
      document.getElementById('active-zone-header').textContent = zone.name;
      
      // Smooth map transition and update spatial layers
      map.flyTo(zone.coords, 16.5, { animate: true, duration: 1.2 });
      
      updateSpatialMarkers();
      updateKpiMetrics();
      renderAnalyticsTable();
      
      logToTerminal(`Junction relocated to center "${zone.name}". Seeded markers re-arranged.`, 'success');
    });
  }

  // 2. Time slider events
  const timeSlider = document.getElementById('time-slider');
  const timeframeBadge = document.getElementById('timeframe-badge');
  if (timeSlider) {
    timeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      const timeframes = ['morning', 'afternoon', 'evening'];
      const labels = ['Morning Rush', 'Afternoon Lull', 'Evening Peak'];
      
      state.currentTimeOfDay = timeframes[val];
      if (timeframeBadge) timeframeBadge.textContent = labels[val];
      
      updateSpatialMarkers(); // Markers must be re-rendered for double-leasing properties updates!
      updateKpiMetrics();
      renderAnalyticsTable();
      
      logToTerminal(`Time profile shifted to "${labels[val]}". Hourly Micro-GDP updated.`, 'info');
    });
  }

  // 3. Zoning compliance check events
  const violationToggle = document.getElementById('violation-toggle');
  if (violationToggle) {
    violationToggle.addEventListener('change', (e) => {
      state.showViolationsOnly = e.target.checked;
      
      updateSpatialMarkers();
      renderAnalyticsTable();
      
      logToTerminal(`Zoning violation compliance override is now ${state.showViolationsOnly ? 'ACTIVE' : 'DEACTIVATED'}.`, state.showViolationsOnly ? 'warning' : 'info');
    });
  }

  // 4. Color theme switcher
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('change', (e) => {
      state.currentTheme = e.target.checked ? 'light' : 'dark';
      document.body.classList.toggle('light-mode', state.currentTheme === 'light');
      document.body.classList.toggle('light-theme', state.currentTheme === 'light');
      
      updateMapTiles();
      updateSpatialMarkers();
      
      logToTerminal(`System color scheme adapted to ${state.currentTheme.toUpperCase()} mode.`, 'info');
    });
  }

  // 5. Text search filters
  const pitchSearch = document.getElementById('pitch-search');
  if (pitchSearch) {
    pitchSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderAnalyticsTable();
    });
  }

  // 6. Category dropdown filters
  const typeFilter = document.getElementById('vendor-type-filter');
  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      state.vendorTypeFilter = e.target.value;
      renderAnalyticsTable();
    });
  }

  // 7. Click-to-sort columns
  const tableHeaders = document.querySelectorAll('.custom-table th.sortable');
  tableHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      handleSort(col);
    });
  });

  // 8. Clear Operations log button
  const clearBtn = document.getElementById('clear-terminal');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const terminal = document.getElementById('operations-terminal');
      if (terminal) {
        terminal.innerHTML = '';
        logToTerminal("Operations terminal logs flushed.", "info");
      }
    });
  }
}

// --------------------------------------------------------------------------
// Initialization Entry Point
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Populate Target Junction Dropdown Selector
  const junctionSelector = document.getElementById('junction-selector');
  if (junctionSelector) {
    state.zones.forEach(zone => {
      const opt = document.createElement('option');
      opt.value = zone.id;
      opt.textContent = zone.name;
      junctionSelector.appendChild(opt);
    });
  }

  // Seed spatial dataset
  initializePitches();

  // Initialize Map layers & popup charts
  initializeMap();
  updateSpatialMarkers();

  // Bind sidebar and search elements
  setupEventListeners();
  
  // Bind zoning request proposal evaluator
  setupEvaluator();

  // Hydrate top metrics and records spreadsheet
  updateKpiMetrics();
  renderAnalyticsTable();

  // Initial welcome telemetry feed log
  logToTerminal("CurbSpace IQ Telemetry initialized. Chennai T. Nagar Active.", "success");
  logToTerminal("AI pedestrian bottleneck compliance systems: ONLINE.", "info");
});

// Formal Escalation Dispatcher (Municipal Authorities Notification API)
window.escalatePitch = function(pitchID) {
  const rawPitch = state.pitches.find(p => p.pitchID === pitchID);
  if (!rawPitch) return;
  
  const pitch = getActivePitchProperties(rawPitch);
  
  if (!state.escalatedPitches) {
    state.escalatedPitches = [];
  }
  
  if (!state.escalatedPitches.includes(pitchID)) {
    state.escalatedPitches.push(pitchID);
  }
  
  // Appends timestamped formal enforcement updates into the Municipal Operations Terminal
  logToTerminal(`[ESCALATION ALERT] Pitch "${pitchID}" (${pitch.vendorName}) has been formally escalated to Greater Chennai Corporation (GCC) enforcement officers. AI warning verified.`, 'danger');
  
  // Citation notification micro-modal
  alert(`CITATION DISPATCHED SUCCESSFUL!\n\nA digital compliance alert and Pedestrian Encroachment Diagnostic Log have been successfully transmitted to the GCC Field Enforcement units for ${pitchID} (${pitch.vendorName}).`);
  
  // Dynamic refresh of state metrics & ledger lists
  renderAnalyticsTable();
  updateSpatialMarkers();
};

// AI Zoning Compliance Evaluator Rule Engine
function setupEvaluator() {
  const evaluateBtn = document.getElementById('btn-evaluate');
  if (!evaluateBtn) return;
  
  evaluateBtn.addEventListener('click', () => {
    const vendorType = document.getElementById('eval-vendor-type').value;
    const zoneIdx = parseInt(document.getElementById('eval-zone').value, 10);
    const location = document.getElementById('eval-location').value;
    const time = document.getElementById('eval-time').value;
    
    const zoneName = state.zones[zoneIdx - 1].name;
    const resultBox = document.getElementById('eval-result-container');
    if (!resultBox) return;
    
    // Evaluate zoning compliance rules
    let isOk = true;
    const reasons = [];
    let matchScore = 100;
    
    // Rule 1: Fire Hydrant clearance
    if (location === 'hydrant') {
      isOk = false;
      reasons.push("NOT OK: Requested placement violates GCC safety clearance guidelines (stands must maintain a 15-foot radial distance from active fire hydrant outlets).");
      matchScore -= 50;
    }
    
    // Rule 2: Crosswalk / Wheelchair ramp blockage
    if (location === 'crosswalk' && (vendorType === 'Food Joint' || vendorType === 'Apparel')) {
      isOk = false;
      reasons.push("NOT OK: Food Joints and Sari/Retail stalls generate heavy queues that obstruct standard pedestrian crosswalk lines or ADA wheelchair-accessible ramps.");
      matchScore -= 40;
    }
    
    // Rule 3: High congestion times at busy nodes
    if (zoneIdx === 1 && time === 'evening' && (vendorType === 'Apparel' || vendorType === 'Artisan Craft')) {
      isOk = false;
      reasons.push("NOT OK: T. Nagar evening pedestrian traffic is extremely dense. Sari and handicraft tables are prohibited on main pathways to prevent street bottlenecks.");
      matchScore -= 30;
    }
    
    // Rule 4: Morning rush hours at Parrys Corner
    if (zoneIdx === 3 && time === 'morning' && vendorType === 'Artisan Craft') {
      isOk = false;
      reasons.push("NOT OK: Parrys Corner wholesale morning transit corridors must remain unobstructed. Artisan tables are restricted to back alleys during this timeframe.");
      matchScore -= 35;
    }
    
    // If still OK, add positive reasons
    if (isOk) {
      matchScore = Math.max(75, 100 - (location === 'pathway' ? 15 : 0) - (time === 'morning' && zoneIdx === 2 ? 10 : 0));
      reasons.push("OK: Proposed placement complies with GCC spatial footprint guidelines.");
      
      if (location === 'plaza') {
        reasons.push("Highly Compatible: Back alleys or open plazas provide optimal clearance and prevent street bottlenecking.");
      } else {
        reasons.push("Acceptable: Pathway width at this node exceeds 3.5m, allowing a compliant 1.8m pedestrian buffer.");
      }
      
      if (zoneIdx === 2 && time === 'afternoon' && vendorType === 'Food Joint') {
        reasons.push("Synergy Spot: Mobile food carts can take advantage of high solar yield slots at Thiruvanmiyur Beach.");
      }
    }
    
    // Update operations terminal
    const logText = `[AI PROPOSAL] Evaluated ${vendorType} request at ${zoneName} (${location}). Result: ${isOk ? 'APPROVED' : 'REJECTED'} (Score: ${matchScore}%).`;
    logToTerminal(logText, isOk ? 'success' : 'warning');
    
    // Display Result Box
    resultBox.classList.remove('hidden');
    
    let borderClass = 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';
    let statusText = '🟢 REQUEST APPROVED (OK)';
    if (!isOk) {
      borderClass = 'border-rose-500/20 bg-rose-500/10 text-rose-400';
      statusText = '🔴 REQUEST REJECTED (NOT OK)';
    }
    
    resultBox.className = `mt-2.5 p-3 rounded border text-[11px] leading-normal font-semibold ${borderClass} transition-all duration-300`;
    
    const reasonsHTML = reasons.map(r => `<div class="mt-1.5 flex items-start gap-1.5"><span class="${isOk ? 'text-emerald-500' : 'text-rose-500'}">•</span><span>${r}</span></div>`).join('');
    
    resultBox.innerHTML = `
      <div class="font-extrabold uppercase text-xs tracking-wider border-b border-current/20 pb-1.5 flex justify-between items-center">
        <span>${statusText}</span>
        <span class="px-1.5 py-0.5 rounded bg-current/10 text-[9px]">${matchScore}% Match</span>
      </div>
      <div class="mt-2 font-medium">
        ${reasonsHTML}
      </div>
    `;
  });
}
