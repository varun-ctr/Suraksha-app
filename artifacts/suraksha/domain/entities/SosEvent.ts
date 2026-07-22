/** A single SOS activation record. */
export interface SosEvent {
  id: string;
  lat: number;
  lng: number;
  address: string | null;
  triggeredAt: string;
  resolvedAt: string | null;
}
