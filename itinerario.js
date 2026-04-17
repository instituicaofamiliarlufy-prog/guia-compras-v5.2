// itinerario.js — Itinerário Inteligente v5.6
// Google Places API (New) Text Search + Routes API computeRoutes + Maps JS

const GOOGLE_API_KEY = "AIzaSyCddd3rhCmIOkRWYvEMwD5GJOMGpIQuxXE";
const ROUTES_KEY = GOOGLE_API_KEY;
const MAPS_KEY   = GOOGLE_API_KEY;

const LUANDA_RADIUS   = 30000; // 30 km bias for initial search
const MAX_CANDIDATES  = 5;     // filiais candidatas por supermercado

// ─────────────────────────────────────────────────────────
// STRING HELPERS
// ─────────────────────────────────────────────────────────
function normalise(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// Every significant word (>2 chars) of shopName must appear in the place name
function isPlausibleMatch(shopName, placeDisplayName) {
  const normShop  = normalise(shopName);
  const normPlace = normalise(placeDisplayName);
  const words     = normShop.split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return false;
  return words.every(w => normPlace.includes(w));
}

// ─────────────────────────────────────────────────────────
// GEO HELPERS
// ─────────────────────────────────────────────────────────

// Haversine distance in metres between two { lat, lng } points
function haversine(a, b) {
  const R  = 6371000;
  const φ1 = a.lat * Math.PI / 180;
  const φ2 = b.lat * Math.PI / 180;
  const Δφ = (b.lat - a.lat) * Math.PI / 180;
  const Δλ = (b.lng - a.lng) * Math.PI / 180;
  const x  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Centroid of a list of { lat, lng } points
function centroid(points) {
  if (!points.length) return { lat: 0, lng: 0 };
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

// ─────────────────────────────────────────────────────────
// PHASE 1 — Fetch ALL candidates for a shop name
// Returns array of { shopName, placeId, displayName, address, lat, lng }
// ─────────────────────────────────────────────────────────
async function fetchCandidates(shopName, biasLat, biasLng) {
  const url  = "https://places.googleapis.com/v1/places:searchText";
  const body = {
    textQuery:      `${shopName} Luanda Angola`,
    languageCode:   "pt",
    maxResultCount: MAX_CANDIDATES,
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

  const data = await resp.json();
  return (data.places || [])
    .filter(p => isPlausibleMatch(shopName, p.displayName?.text || ""))
    .map(p => ({
      shopName,
      placeId:     p.id,
      displayName: p.displayName?.text || shopName,
      address:     p.formattedAddress  || "",
      lat:         p.location.latitude,
      lng:         p.location.longitude,
    }));
}

// ─────────────────────────────────────────────────────────
// PHASE 1b — Smart candidate selection
//
// Strategy:
//   1. For each shop, fetch up to MAX_CANDIDATES filiais.
//   2. Compute the "working centroid" = centroid of:
//        origin + all other shops' best-so-far candidate
//      (initialised to their closest-to-origin candidate).
//   3. For each shop, pick the candidate closest to the
//      working centroid of the OTHER shops.
//   4. Iterate once (one pass is sufficient for small N).
//
// This avoids picking a faraway branch when a closer one
// exists near the cluster of the other waypoints.
// ─────────────────────────────────────────────────────────
async function selectBestCandidates(shops, origin, onStatus) {
  onStatus?.("A pesquisar filiais candidatas…");

  // Step A: fetch all candidates in parallel
  const allCandidates = await Promise.all(
    shops.map(s =>
      fetchCandidates(s.shopName, origin.lat, origin.lng)
        .catch(err => { console.error(err); return []; })
    )
  );

  // Separate found vs not-found
  const foundShops    = [];
  const skippedShops  = [];
  const candidateSets = []; // parallel arrays with foundShops

  shops.forEach((s, i) => {
    if (allCandidates[i].length > 0) {
      foundShops.push(s);
      candidateSets.push(allCandidates[i]);
    } else {
      skippedShops.push(s);
      console.warn(`[Places] No plausible candidates for "${s.shopName}"`);
    }
  });

  if (!foundShops.length) return { selected: [], skipped: shops };

  // Step B: initialise each shop's "current best" = candidate closest to origin
  const currentBest = candidateSets.map(candidates =>
    candidates.reduce((best, c) =>
      haversine(origin, c) < haversine(origin, best) ? c : best
    )
  );

  // Step C: one optimisation pass — for each shop, pick candidate
  //         closest to the centroid of (origin + all other shops' currentBest)
  const optimised = currentBest.map((_, i) => {
    const others = [
      origin,
      ...currentBest.filter((_, j) => j !== i),
    ];
    const clusterCentre = centroid(others);

    return candidateSets[i].reduce((best, c) =>
      haversine(clusterCentre, c) < haversine(clusterCentre, best) ? c : best
    );
  });

  // Step D: second pass for convergence (handles cases where pass 1 shifts centroid significantly)
  const optimised2 = optimised.map((_, i) => {
    const others = [
      origin,
      ...optimised.filter((_, j) => j !== i),
    ];
    const clusterCentre = centroid(others);

    return candidateSets[i].reduce((best, c) =>
      haversine(clusterCentre, c) < haversine(clusterCentre, best) ? c : best
    );
  });

  return { selected: optimised2, skipped: skippedShops };
}

// ─────────────────────────────────────────────────────────
// PHASE 2 — Routes API computeRoutes (TSP optimised)
// ─────────────────────────────────────────────────────────
async function computeOptimisedRoute(origin, returnToOrigin, places) {
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

  const originWP = {
    location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
  };
  const destinationWP = returnToOrigin
    ? { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } }
    : { placeId: places[places.length - 1].placeId };

  const body = {
    origin:                  originWP,
    destination:             destinationWP,
    intermediates:           places.map(p => ({ via: false, placeId: p.placeId })),
    travelMode:              "DRIVE",
    optimizeWaypointOrder:   true,
    routingPreference:       "TRAFFIC_AWARE",
    computeAlternativeRoutes: false,
    languageCode:            "pt-PT",
    units:                   "METRIC",
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
  return resp.json();
}

// ─────────────────────────────────────────────────────────
// MAIN EXPORT — buildItinerary
// shops: [{ shopName, shopId, cor }] — already unique
// origin: { lat, lng }
// ─────────────────────────────────────────────────────────
export async function buildItinerary({ shops, origin, returnToOrigin = true, onStatus }) {

  // Phase 1: select best candidate per shop using cluster optimisation
  const { selected: validPlaces, skipped } =
    await selectBestCandidates(shops, origin, onStatus);

  if (!validPlaces.length) {
    throw new Error("Nenhuma filial encontrada nas proximidades para os supermercados listados.");
  }

  onStatus?.(`${validPlaces.length} filial(ais) seleccionada(s). A calcular rota optimizada…`);

  // Phase 2: TSP-optimised route
  const routeData = await computeOptimisedRoute(origin, returnToOrigin, validPlaces);
  const route     = routeData.routes?.[0];
  if (!route) throw new Error("Nenhuma rota encontrada. Verifique as coordenadas de origem.");

  // Re-order places by TSP result
  const orderIdx      = route.optimizedIntermediateWaypointIndex || validPlaces.map((_, i) => i);
  const orderedPlaces = orderIdx.map(i => validPlaces[i]);
  const legs          = route.legs || [];

  const stops = orderedPlaces.map((place, i) => ({
    ...place,
    legDuration:   legs[i]?.duration        || "0s",
    legDistMetres: legs[i]?.distanceMeters  || 0,
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
// FORMATTING HELPERS
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
let mapsLoaded      = false;
let mapsLoadPromise = null;

export function loadMapsAPI() {
  if (mapsLoaded)      return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    const script   = document.createElement("script");
    script.src     = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=geometry`;
    script.async   = true;
    script.onload  = () => { mapsLoaded = true; resolve(); };
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
      path:        google.maps.SymbolPath.CIRCLE,
      scale:       10,
      fillColor:   "#1A1714",
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 2,
    },
    zIndex: 10,
  });
  bounds.extend(originPos);

  // Stop markers coloured by shop
  itinerary.stops.forEach((stop, i) => {
    const shopEntry = Object.values(supermercados).find(s =>
      normalise(s.nome) === normalise(stop.shopName)
    );
    const cor = shopEntry?.cor || "#2D6A4F";
    const pos = { lat: stop.lat, lng: stop.lng };
    new google.maps.Marker({
      position: pos, map,
      title: `${i + 1}. ${stop.displayName}`,
      label: {
        text: String(i + 1), color: "#fff",
        fontFamily: "Syne,sans-serif", fontWeight: "700", fontSize: "13px",
      },
      icon: {
        path:        google.maps.SymbolPath.CIRCLE,
        scale:       16,
        fillColor:   cor,
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
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
      strokeColor:   "#2D6A4F",
      strokeOpacity: 0.85,
      strokeWeight:  4,
    });
    path.forEach(p => bounds.extend(p));
  }

  map.fitBounds(bounds, { padding: 48 });
}