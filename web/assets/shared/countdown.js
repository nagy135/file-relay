export function formatCountdown(milliseconds) {
  if (milliseconds <= 0) return "Expired";
  const total = Math.ceil(milliseconds / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
  return days ? `${days}d ${clock}` : clock;
}
