import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
// Adds bearing support to Leaflet in place: twist, drag the compass or
// shift-scroll to turn the map, and it converts taps back to coordinates
// correctly at any angle.
import "leaflet-rotate";
import type { DirectionsRoute, RoutePoint } from "../types";

export interface MapDestination extends RoutePoint {
  name: string;
}

interface RouteMapProps {
  route: DirectionsRoute | null;
  origin: RoutePoint | null;
  destination: MapDestination | null;
  user: (RoutePoint & { accuracy?: number | null }) | null;
  follow: boolean;
  picking: boolean;
  onPick: (point: RoutePoint) => void;
  className?: string;
}

function destinationIcon(): L.DivIcon {
  return L.divIcon({
    className: "nav-marker",
    html: '<span class="nav-pin"></span>',
    iconSize: [30, 44],
    iconAnchor: [15, 38],
  });
}

function originIcon(): L.DivIcon {
  return L.divIcon({
    className: "nav-marker",
    html: '<span class="nav-origin"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function userIcon(): L.DivIcon {
  return L.divIcon({
    className: "nav-marker",
    html: '<span class="nav-me"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/**
 * Leaflet is created once and then driven imperatively: route lines, markers
 * and the live position all update by reference, which keeps GPS ticks from
 * tearing down and rebuilding the map.
 */
export function RouteMap({
  route,
  origin,
  destination,
  user,
  follow,
  picking,
  onPick,
  className,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const destinationRef = useRef<L.Marker | null>(null);
  const originRef = useRef<L.Marker | null>(null);
  const userRef = useRef<L.Marker | null>(null);
  const accuracyRef = useRef<L.Circle | null>(null);

  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const pickingRef = useRef(picking);
  pickingRef.current = picking;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: [9.03, 38.74],
      zoom: 13,
      minZoom: 3,
      zoomControl: false,
      worldCopyJump: true,
      // Free 360° rotation: two-finger twist on a phone, shift-scroll or a
      // sideways drag on the compass at a desk. Tapping the compass snaps the
      // map back to north. Pitch stays off — this is a street map, not a
      // horizon view.
      rotate: true,
      bearing: 0,
      pitch: 0,
      rotateControl: { position: "topleft", closeOnZeroBearing: false },
      shiftKeyRotate: true,
      touchRotate: true,
      pitchDrag: false,
      touchPitch: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      // Carrying the tile credit is a condition of using the tile service, so
      // this stays even though the pages label the map plainly as "Street map".
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);

    routeLayerRef.current = L.layerGroup().addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      if (!pickingRef.current) return;
      onPickRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
    });
    mapRef.current = map;

    return () => {
      // The plugin binds shift-scroll on the container outside Leaflet's own
      // teardown; drop it so a reused container cannot answer for a dead map.
      map.shiftKeyRotate?.disable();
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      destinationRef.current = null;
      originRef.current = null;
      userRef.current = null;
      accuracyRef.current = null;
    };
  }, []);

  // Route line: a soft casing under a bright centre line, then frame it.
  useEffect(() => {
    const map = mapRef.current;
    const layer = routeLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (!route || route.path.length < 2) return;

    const line = route.path.map((point) => [point.lat, point.lng] as [number, number]);
    L.polyline(line, {
      color: "#0b3d26",
      weight: 11,
      opacity: 0.22,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(layer);
    L.polyline(line, {
      color: "#16a34a",
      weight: 5.5,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(layer);

    if (!follow) {
      map.fitBounds(L.latLngBounds(line), { padding: [36, 36], maxZoom: 16 });
    }
    // `follow` only gates the initial framing; the map should not jump back to
    // the whole route every time navigation starts or stops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Destination pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!destination) {
      destinationRef.current?.remove();
      destinationRef.current = null;
      return;
    }

    const latlng: L.LatLngTuple = [destination.lat, destination.lng];
    if (!destinationRef.current) {
      destinationRef.current = L.marker(latlng, {
        icon: destinationIcon(),
        keyboard: false,
        zIndexOffset: 900,
      }).addTo(map);
    } else {
      destinationRef.current.setLatLng(latlng);
    }
    // The name can arrive in a shared link, so it is bound as text, never HTML.
    const label = document.createElement("span");
    label.textContent = destination.name;
    destinationRef.current.unbindTooltip().bindTooltip(label, {
      direction: "top",
      offset: [0, -34],
      className: "nav-tooltip",
    });
  }, [destination?.lat, destination?.lng, destination?.name]);

  // Start pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!origin) {
      originRef.current?.remove();
      originRef.current = null;
      return;
    }
    const latlng: L.LatLngTuple = [origin.lat, origin.lng];
    if (!originRef.current) {
      originRef.current = L.marker(latlng, {
        icon: originIcon(),
        interactive: false,
        keyboard: false,
      }).addTo(map);
    } else {
      originRef.current.setLatLng(latlng);
    }
  }, [origin?.lat, origin?.lng]);

  // Live position plus its accuracy halo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!user) {
      userRef.current?.remove();
      userRef.current = null;
      accuracyRef.current?.remove();
      accuracyRef.current = null;
      return;
    }

    const latlng: L.LatLngTuple = [user.lat, user.lng];
    if (!userRef.current) {
      userRef.current = L.marker(latlng, {
        icon: userIcon(),
        interactive: false,
        keyboard: false,
        zIndexOffset: 800,
      }).addTo(map);
    } else {
      userRef.current.setLatLng(latlng);
    }

    if (user.accuracy && user.accuracy > 5) {
      if (!accuracyRef.current) {
        accuracyRef.current = L.circle(latlng, {
          radius: user.accuracy,
          color: "#2563eb",
          weight: 1,
          opacity: 0.35,
          fillColor: "#3b82f6",
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(map);
      } else {
        accuracyRef.current.setLatLng(latlng).setRadius(user.accuracy);
      }
    }
  }, [user?.lat, user?.lng, user?.accuracy]);

  // Keep the live position centred while navigating.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow || !user) return;
    if (map.getZoom() < 15) map.setZoom(16);
    map.panTo([user.lat, user.lng], { animate: true, duration: 0.6 });
  }, [follow, user?.lat, user?.lng]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="application"
      aria-label="Route map"
    />
  );
}
