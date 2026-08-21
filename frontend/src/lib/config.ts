export function getBackendUrl(): string {
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  // If explicitly pointing to a remote host (e.g. production domain), use it directly
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }
  // For local development and testing from mobile phones on LAN (e.g. 192.168.x.x)
  const hostname = typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "localhost";
  return `http://${hostname}:4000`;
}
