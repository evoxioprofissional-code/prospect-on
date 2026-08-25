"use client";

export type ThemeMode = "light" | "dark" | "system";

export function getTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const t = localStorage.getItem("theme");
  return t === "light" || t === "dark" || t === "system" ? t : "system";
}

export function applyTheme(mode: ThemeMode) {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(mode: ThemeMode) {
  localStorage.setItem("theme", mode);
  applyTheme(mode);
}
