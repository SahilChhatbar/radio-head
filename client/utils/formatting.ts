export const formatVotes = (v?: number) => {
  const n = typeof v === "number" ? v : 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1000) return `${sign}${abs}`;
  if (abs < 1_000_000) {
    const val = +(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1);
    return `${sign}${val}k`;
  }
  const val = +(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1);
  return `${sign}${val}M`;
};
