"use client";

import { useEffect, useRef } from "react";

interface LordIconProps {
  src: string;
  trigger?: "hover" | "click" | "loop" | "morph" | "boomerang" | "loop-on-hover" | "in";
  colors?: string;
  delay?: string;
  target?: string;
  size?: number;
  className?: string;
}

export default function LordIcon({
  src,
  trigger = "hover",
  colors,
  delay,
  target,
  size = 24,
  className,
}: LordIconProps) {
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (iconRef.current) {
      const element = document.createElement("lord-icon");
      element.setAttribute("src", src);
      element.setAttribute("trigger", trigger);
      if (colors) element.setAttribute("colors", colors);
      if (delay) element.setAttribute("delay", delay);
      if (target) element.setAttribute("target", target);
      element.style.width = `${size}px`;
      element.style.height = `${size}px`;

      iconRef.current.innerHTML = "";
      iconRef.current.appendChild(element);
    }
  }, [src, trigger, colors, delay, target, size]);

  return <div ref={iconRef} className={className} />;
}
