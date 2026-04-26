import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom delivery icon
const deliveryIcon = new L.DivIcon({
  className: "custom-delivery-icon",
  html: `
    <div style="
      background: hsl(var(--primary));
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid hsl(var(--card));
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      color: hsl(var(--primary-foreground));
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
        <path d="M15 18H9"/>
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
        <circle cx="17" cy="18" r="2"/>
        <circle cx="7" cy="18" r="2"/>
      </svg>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

// Custom destination icon
const destinationIcon = new L.DivIcon({
  className: "custom-destination-icon",
  html: `
    <div style="
      background: hsl(var(--destructive));
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid hsl(var(--card));
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      color: hsl(var(--destructive-foreground));
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

interface Position {
  lat: number;
  lng: number;
}

interface DeliveryMapProps {
  deliveryPosition: Position;
  destinationPosition: Position;
}

// Component to update map view when position changes
function MapUpdater({ deliveryPosition }: { deliveryPosition: Position }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView([deliveryPosition.lat, deliveryPosition.lng], map.getZoom(), {
      animate: true,
      duration: 1
    });
  }, [deliveryPosition, map]);

  return null;
}

export function DeliveryMap({ deliveryPosition, destinationPosition }: DeliveryMapProps) {
  const center: [number, number] = [
    (deliveryPosition.lat + destinationPosition.lat) / 2,
    (deliveryPosition.lng + destinationPosition.lng) / 2
  ];

  return (
    <MapContainer 
      center={center}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Delivery Person Marker */}
      <Marker 
        position={[deliveryPosition.lat, deliveryPosition.lng]} 
        icon={deliveryIcon}
      >
        <Popup>
          <div className="text-center">
            <strong>Entregador</strong>
            <p className="text-sm">A caminho do seu endereço</p>
          </div>
        </Popup>
      </Marker>

      {/* Destination Marker */}
      <Marker 
        position={[destinationPosition.lat, destinationPosition.lng]} 
        icon={destinationIcon}
      >
        <Popup>
          <div className="text-center">
            <strong>Seu Endereço</strong>
            <p className="text-sm">Destino da entrega</p>
          </div>
        </Popup>
      </Marker>

      <MapUpdater deliveryPosition={deliveryPosition} />
    </MapContainer>
  );
}
