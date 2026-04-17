import * as React from "react";

const MOBILE_MAX = 640; // < 640: phone
const TABLET_MAX = 1024; // 640-1023: tablet, >=1024: desktop

export type Breakpoint = "mobile" | "tablet" | "desktop";

function compute(): Breakpoint {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < MOBILE_MAX) return "mobile";
  if (w < TABLET_MAX) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = React.useState<Breakpoint>(() => compute());
  React.useEffect(() => {
    const onResize = () => setBp(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return bp;
}
