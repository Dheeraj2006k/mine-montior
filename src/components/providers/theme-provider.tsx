"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "iris-theme";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "dark",
  setTheme: () => {},
});

// Pure and exported specifically so it's unit-testable without a DOM -
// this project's test setup has no jsdom/React Testing Library (every
// existing test is domain-logic or mocked-API-route level), so this is
// the one part of the theme mechanism that can be verified the same way.
export function resolveStoredTheme(stored: string | null): Theme {
  return stored === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default "dark" matches the unconditional :root values in globals.css -
  // a user who never touched the toggle sees exactly what this app always
  // looked like. The actual on-screen color is already correct before this
  // component even mounts, via the blocking inline script in layout.tsx
  // (see ThemeInitScript) - this state only drives the toggle control's
  // own label/icon, which is why a short mislabel is an acceptable
  // tradeoff here (same pattern already used for ViewModeProvider) rather
  // than a full-page color flash, which the inline script already prevents.
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(resolveStoredTheme(stored));
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    window.localStorage.setItem(STORAGE_KEY, t);
    if (t === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Runs before hydration/paint via a blocking <script> in layout.tsx's
// <head> - this is what actually prevents a wrong-theme flash, since it
// sets the DOM attribute (and therefore every CSS custom property) before
// the browser paints anything, independent of React's own hydration timing.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;
