export function getBackendUrl(): string {
  const envUrl = import.meta.env.VITE_BACKEND_URL?.trim();

  // If explicitly configured in Vercel (.env), use it and strip any trailing slash
  if (envUrl && envUrl.length > 0 && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/+$/, "");
  }

  // Local development fallbacks (localhost or LAN IP)
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.")
    ) {
      return `http://${hostname}:4000`;
    }
  }

  // Deployed production backend on Render
  return "https://reneo-backend-5eq6.onrender.com";
}
