import * as React from "react";

const MOBILE_MAX = 640; // < 640: phone
const TABLET_MAX = 1024; // 640-1023: tablet, >=1024: desktop

export type Breakpoint = "mobile" | "tablet" | "desktop";

function compute(): Breakpoint {
  if (typeof window === "undefined") return "desktop";
  // Use the layout viewport width (documentElement.clientWidth) instead of
  // window.innerWidth. On iOS Safari, window.innerWidth changes when the user
  // pinch-zooms (visual viewport), which would otherwise flip the breakpoint
  // mid-session and unmount the editor. clientWidth stays stable during pinch.
  const w = document.documentElement?.clientWidth || window.innerWidth;
  if (w < MOBILE_MAX) return "mobile";
  if (w < TABLET_MAX) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = React.useState<Breakpoint>(() => compute());
  React.useEffect(() => {
    let lastWidth = document.documentElement?.clientWidth || window.innerWidth;
    const onResize = () => {
      const w = document.documentElement?.clientWidth || window.innerWidth;
      // Ignore resize events that are purely caused by pinch-zoom or the
      // mobile URL bar showing/hiding without an actual layout-width change.
      if (w === lastWidth) return;
      lastWidth = w;
      setBp(compute());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return bp;
}
