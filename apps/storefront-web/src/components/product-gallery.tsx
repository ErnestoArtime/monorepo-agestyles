"use client";

import Image from "next/image";
import { useState } from "react";

/** Main photo with a row of thumbnails; used by the quick view and the product page. */
export function ProductGallery({
  images,
  alt,
  priority = false,
}: {
  images: string[];
  alt: string;
  priority?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const current = images[Math.min(index, images.length - 1)];
  return (
    <div className="gallery">
      <div className="gallery-main">
        {current ? (
          <Image
            src={current}
            alt={alt}
            fill
            unoptimized
            priority={priority}
            sizes="(max-width: 760px) 100vw, 45vw"
          />
        ) : (
          <div className="image-placeholder">AGESTYLES</div>
        )}
      </div>
      {images.length > 1 ? (
        <div className="gallery-thumbs" role="group" aria-label="Fotos del producto">
          {images.map((src, position) => (
            <button
              key={src}
              type="button"
              className={position === index ? "gallery-thumb is-active" : "gallery-thumb"}
              onClick={() => setIndex(position)}
              aria-label={`Ver foto ${position + 1} de ${images.length}`}
              aria-pressed={position === index}
            >
              <Image src={src} alt="" fill unoptimized sizes="64px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
