const rawBaseUrl = import.meta.env.VITE_API_BASE_URL
	|| import.meta.env.VITE_API_BASE
	|| "http://localhost:8081";

export const API_BASE_URL = rawBaseUrl.replace(/\/$/, "");

console.log("API BASE URL:", API_BASE_URL);
