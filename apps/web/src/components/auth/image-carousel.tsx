"use client";

import { useState, useEffect } from "react";

const images = [
  "/images/bus-stop-signage-near-the-trees-at-the-roadside-2026-01-08-06-52-02-utc.jpg",
  "/images/smiling-woman-with-crutches-riding-public-transpor-2026-01-11-10-53-36-utc.jpg",
  "/images/vertical-shot-of-the-wheel-of-a-wheelchair-with-a-2026-01-05-00-03-01-utc.jpeg",
];

export function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {images.map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            index === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-black/40" />
    </>
  );
}
