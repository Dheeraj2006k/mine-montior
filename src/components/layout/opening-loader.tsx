"use client";

import { useEffect, useState } from "react";
import { IrisEyeLogo, IrisWordmark } from "@/components/layout/iris-logo";

export function OpeningLoader() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      const hideTimer = window.setTimeout(() => setVisible(false), 0);
      return () => window.clearTimeout(hideTimer);
    }

    const leaveTimer = window.setTimeout(() => setLeaving(true), 1500);
    const hideTimer = window.setTimeout(() => setVisible(false), 2050);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className={`opening-loader ${leaving ? "opening-loader--leaving" : ""}`} aria-hidden>
      <div className="opening-loader__scan" />
      <div className="opening-loader__content">
        <div className="opening-loader__mark">
          <IrisEyeLogo size={168} priority className="opening-loader__logo" />
          <span className="opening-loader__orbit opening-loader__orbit--outer" />
          <span className="opening-loader__orbit opening-loader__orbit--inner" />
          <span className="opening-loader__pulse" />
        </div>
        <IrisWordmark width={230} priority className="opening-loader__wordmark-logo" />
        <p className="opening-loader__tagline">Safer mines &middot; Stable tomorrow</p>
        <div className="opening-loader__bar">
          <span />
        </div>
      </div>
    </div>
  );
}
