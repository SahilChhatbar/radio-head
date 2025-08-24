export const MOCK_STATIONS = Array.from(
  { length: 136 },
  (_, i) => `FM ${(88.1 + i * 0.2).toFixed(1)}`
);