// Mission signal delays. Source: docs/delay_table.md (round trip = 2 x one-way).
// Moon and Mars rows there are still secondary sources; Mars uses the 22 min one-way demo value.

export interface Mission {
  id: string;
  label: string;
  one_way_s: number | null;    // null = no link
  round_trip_s: number | null; // null = no link
}

export const MISSIONS: Mission[] = [
  { id: "iss", label: "ISS", one_way_s: 0.25, round_trip_s: 0.5 },
  { id: "moon", label: "Moon", one_way_s: 1.3, round_trip_s: 2.6 },
  { id: "mars", label: "Mars", one_way_s: 1320, round_trip_s: 2640 },
  { id: "conjunction", label: "Solar conjunction", one_way_s: null, round_trip_s: null },
];

// 10 minute placeholder, UNSOURCED
export const SAFE_WAIT_S = 600;
