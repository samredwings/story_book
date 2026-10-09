import axios from "axios";
import { getApiBase } from "./auth";

const client = axios.create({
  baseURL: getApiBase(),
  timeout: 60_000,
});

client.interceptors.request.use((config) => {
  // Re-resolve base on each request so tests can override env if needed
  config.baseURL = getApiBase();
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
export { getApiBase };
