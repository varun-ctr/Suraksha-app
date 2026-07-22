/** A plain shareable link to a coordinate that opens in any maps app. Single source of truth. */
export function coordLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}
