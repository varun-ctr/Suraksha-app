/** A geographic position as tracked during an SOS/journey session. */
export interface Coords {
  lat: number;
  lng: number;
  accuracy: number | null;
}
