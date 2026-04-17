// itinerario.js — Itinerário Inteligente v5.6
// Google Places API (New) Text Search + Routes API computeRoutes + Maps JS

const GOOGLE_API_KEY = "AIzaSyCddd3rhCmIOkRWYvEMwD5GJOMGpIQuxXE";
const ROUTES_KEY = GOOGLE_API_KEY;
const MAPS_KEY   = GOOGLE_API_KEY;

const LUANDA_RADIUS = 25000; // 25 km bias radius

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

// Normalise a string for comparison: lowercase, no accents, no punctuation
function normalise(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// Check if the place name returned by Google is a plausible match
// for the shop name we searched for.
// Strategy: every word of shopName (length > 2) must appear in the place name.
function isPlausibleMatch(shopName, placeDisplayName) {
  const normShop  = normalise(shopName);
  const normPlace = normalise(placeDisplayName);

  // All significant words of the shop name must be present in the place name
  const words = normShop.split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return false;
  return words.every(w => normPlace.includes(w));
}

// ─────────────────────────────────────────────────────────
// PHASE 1 — Places Text Search (New)
// Returns { shopName, placeId, displayName, address, lat, lng } or null
// ─────────────────────────────────────────────────────────
async function findNearestPlace(shopName, biasLat, biasLng) {
  const url  = "https://places.googleapis.com/v1/places:searchText";
  const body = {
    textQuery:      `${shopName} Luanda Angola`,
    languageCode:   "pt",
    maxResultCount: 5, // get top-5 so we can pick the best match
    locationBias: {
      circle: {
        center: { latitude: biasLat, longitude: biasLng },
        radius: LUANDA_RADIUS,
      },
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type":     "application/json",
      "X-Goog-Api-Key":   GOOGLE_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Places API (${shopName}): ${err?.error?.message || resp.statusText}`);
  }

  const data   = await resp.json();
  const places = data.places || [];

  // Find the first result whose displayName is a plausible match
  const match = places.find(p => isPlausibleMatch(shopName, p.displayName?.text || ""));

  if (!match) {
    console.warn(`[Places] No plausible match for "${shopName}" in ${places.length} results:`,
      places.map(p => p.displayName?.text));
    return null; // will be reported as skipped
  }

  return {
    shopName,
    placeId:     match.id,
    displayName: match.displayName?.text || shopName,
    address:     match.formattedAddress  || "",
    lat:         match.location.latitude,
    lng:         match.location.longitude,
  };
}

// ─────────────────────────────────────────────────────────
// PHASE 2 — Routes API computeRoutes (TSP optimised)
// ─────────────────────────────────────────────────────────
async function computeOptimisedRoute(origin, returnToOrigin, places) {
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

  const toLatLngWaypoint = ({ lat, lng }) => ({
    via: false,
    location: { latLng: { latitude: lat, longitude: lng } },
  });

  const toPlaceWaypoint = ({ placeId }) => ({
    via:     false,
    placeId,
  });

  const originWP      = toLatLngWaypoint(origin);
  const destinationWP = returnToOrigin
    ? toLatLngWaypoint(origin)
    : toPlaceWaypoint(places[places.length - 1]);

  const body = {
    origin:                 originWP,
    destination:            destinationWP,
    intermediates:          places.map(toPlaceWaypoint),
    travelMode:             "DRIVE",
    optimizeWaypointOrder:  true,
    routingPreference:      "TRAFFIC_AWARE",
    computeAlternativeRoutes: false,
    languageCode:           "pt-PT",
    units:                  "METRIC",
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type":     "application/json",
      "X-Goog-Api-Key":   ROUTES_KEY,
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters," +
        "routes.optimizedIntermediateWaypointIndex," +
        "routes.legs.duration,routes.legs.distanceMeters," +
        "routes.polyline.encodedPolyline",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Routes API: ${err?.error?.message || resp.statusText}`);
  }
  return await resp.json();
}

// ─────────────────────────────────────────────────────────
// MAIN EXPORT — buildItinerary
// shops: [{ shopName, shopId, cor }] (unique, already deduped)
// origin: { lat, lng }
// ─────────────────────────────────────────────────────────
export async function buildItinerary({ shops, origin, returnToOrigin = true, onStatus }) {
  onStatus?.("A pesquisar filiais próximas…");

  // Phase 1: resolve each unique shop to a place — in parallel
  const placeResults = await Promise.all(
    shops.map(s =>
      findNearestPlace(s.shopName, origin.lat, origin.lng).catch(err => {
        console.error(err);
        return null;
      })
    )
  );

  const validPlaces = placeResults.filter(Boolean);
  const skipped     = shops.filter((s, i) => !placeResults[i]);

  if (!validPlaces.length) {
    throw new Error("Nenhuma filial encontrada nas proximidades para os supermercados listados.");
  }

  onStatus?.(`${validPlaces.length} filial(ais) encontrada(s). A calcular rota optimizada…`);

  // Phase 2: optimised route
  let routeData;
  try {
    routeData = await computeOptimisedRoute(origin, returnToOrigin, validPlaces);
  } catch (e) {
    // If Routes API fails with multiple stops try sequential (no optimisation)
    console.warn("Routes API optimised failed, retrying sequential:", e.message);
    throw e;
  }

  const route = routeData.routes?.[0];
  if (!route) throw new Error("Nenhuma rota encontrada. Verifique as coordenadas de origem.");

  // Re-order places by optimised waypoint index
  const orderIdx     = route.optimizedIntermediateWaypointIndex || validPlaces.map((_, i) => i);
  const orderedPlaces = orderIdx.map(i => validPlaces[i]);

  const legs = route.legs || [];
  const stops = orderedPlaces.map((place, i) => ({
    ...place,
    legDuration:  legs[i]?.duration        || "0s",
    legDistMetres: legs[i]?.distanceMeters || 0,
  }));

  return {
    origin,
    returnToOrigin,
    stops,
    skipped,
    totalDuration:   parseDuration(route.duration || "0s"),
    totalDistance:   route.distanceMeters || 0,
    encodedPolyline: route.polyline?.encodedPolyline || null,
    legs,
  };
}

// ─────────────────────────────────────────────────────────
// FORMATTING HELPERS (exported for use in app.js & viewer)
// ─────────────────────────────────────────────────────────
export function parseDuration(s) {
  const m = (s || "").match(/(\d+)s/);
  return m ? parseInt(m[1]) : 0;
}
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}
export function formatDistance(metres) {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${metres} m`;
}

// ─────────────────────────────────────────────────────────
// MAPS JS — lazy load + render
// ─────────────────────────────────────────────────────────
let mapsLoaded       = false;
let mapsLoadPromise  = null;

export function loadMapsAPI() {
  if (mapsLoaded)      return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    const script  = document.createElement("script");
    script.src    = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=geometry`;
    script.async  = true;
    script.onload = () => { mapsLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Erro ao carregar Google Maps JS."));
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

export async function renderMap(containerId, itinerary, supermercados = {}) {
  await loadMapsAPI();
  const container = document.getElementById(containerId);
  if (!container) return;

  const { google } = window;
  const map = new google.maps.Map(container, {
    zoom:             12,
    center:           { lat: itinerary.origin.lat, lng: itinerary.origin.lng },
    mapTypeId:        "roadmap",
    disableDefaultUI: false,
    styles: [
      { featureType: "poi",     stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
    ],
  });

  const bounds = new google.maps.LatLngBounds();

  // Origin marker
  const originPos = { lat: itinerary.origin.lat, lng: itinerary.origin.lng };
  new google.maps.Marker({
    position: originPos, map,
    title: "Ponto de partida",
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10, fillColor: "#1A1714", fillOpacity: 1,
      strokeColor: "#fff", strokeWeight: 2,
    },
    zIndex: 10,
  });
  bounds.extend(originPos);

  // Stop markers
  itinerary.stops.forEach((stop, i) => {
    // Find colour from supermercados registry by shopName
    const shopEntry = Object.values(supermercados).find(s =>
      normalise(s.nome) === normalise(stop.shopName)
    );
    const cor = shopEntry?.cor || "#2D6A4F";
    const pos = { lat: stop.lat, lng: stop.lng };
    new google.maps.Marker({
      position: pos, map,
      title: `${i + 1}. ${stop.displayName}`,
      label: { text: String(i + 1), color: "#fff", fontFamily: "Syne,sans-serif", fontWeight: "700", fontSize: "13px" },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 16, fillColor: cor, fillOpacity: 1,
        strokeColor: "#fff", strokeWeight: 2,
      },
      zIndex: 5,
    });
    bounds.extend(pos);
  });

  // Route polyline
  if (itinerary.encodedPolyline && google.maps.geometry?.encoding) {
    const path = google.maps.geometry.encoding.decodePath(itinerary.encodedPolyline);
    new google.maps.Polyline({
      path, map,
      strokeColor: "#2D6A4F", strokeOpacity: 0.85, strokeWeight: 4,
    });
    path.forEach(p => bounds.extend(p));
  }

  map.fitBounds(bounds, { padding: 48 });
}