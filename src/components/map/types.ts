export interface MapMarker {
  id?: string;
  kind: "restaurant" | "customer" | "driver";
  lat: number;
  lng: number;
  label?: string;
}
