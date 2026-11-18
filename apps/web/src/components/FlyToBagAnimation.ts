/**
 * Delightful "Fly to Bag" animation.
 * When the user clicks "Add to bag", an animated preview of the item detaches,
 * arcs in a realistic parabolic 3D trajectory into the header shopping bag,
 * and causes the shopping bag to do an elastic bounce/gulp.
 */

export interface FlyItemOptions {
  name?: string;
  colorHex?: string;
  emoji?: string;
  image?: string;
}

export function triggerFlyToBag(sourceElement: HTMLElement | null, options: FlyItemOptions = {}) {
  if (typeof window === "undefined") return;

  // Find header cart button
  const cartBtn = document.getElementById("header-cart-btn") || document.querySelector("button[aria-label*='Cart']");
  if (!cartBtn) return;

  // Calculate start and end coordinates
  const startRect = sourceElement?.getBoundingClientRect() || {
    left: window.innerWidth / 2 - 25,
    top: window.innerHeight / 2 - 25,
    width: 50,
    height: 50,
  };
  const targetRect = cartBtn.getBoundingClientRect();

  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  const endX = targetRect.left + targetRect.width / 2;
  const endY = targetRect.top + targetRect.height / 2;

  // Create flyer element
  const flyer = document.createElement("div");
  flyer.setAttribute("aria-hidden", "true");
  flyer.style.position = "fixed";
  flyer.style.zIndex = "99999";
  flyer.style.pointerEvents = "none";
  flyer.style.width = "48px";
  flyer.style.height = "48px";
  flyer.style.borderRadius = "14px";
  flyer.style.left = `${startX - 24}px`;
  flyer.style.top = `${startY - 24}px`;
  flyer.style.boxShadow = "0 12px 30px rgba(74, 101, 255, 0.45), 0 4px 10px rgba(0, 0, 0, 0.2)";
  flyer.style.display = "grid";
  flyer.style.placeItems = "center";
  flyer.style.fontSize = "24px";
  flyer.style.transformOrigin = "center center";
  flyer.style.willChange = "transform, opacity";

  if (options.colorHex) {
    flyer.style.backgroundColor = options.colorHex;
    flyer.style.border = "2.5px solid rgba(255, 255, 255, 0.9)";
  } else {
    flyer.style.background = "linear-gradient(135deg, #4a65ff, #8b5cf6)";
  }

  if (options.image) {
    const img = document.createElement("img");
    img.src = options.image;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "11px";
    flyer.appendChild(img);
  } else {
    flyer.innerText = options.emoji || "📱";
  }

  document.body.appendChild(flyer);

  const duration = 720; // 0.72s
  const startTime = performance.now();
  const arcHeight = Math.min(-140, -(Math.abs(startY - endY) * 0.4 + 80));

  function frame(currentTime: number) {
    const elapsed = currentTime - startTime;
    const p = Math.min(elapsed / duration, 1);

    // Quad bezier curve
    const ease = p * (2 - p); // easeOutQuad
    const curX = startX + (endX - startX) * ease;
    const curY = startY + (endY - startY) * p + Math.sin(p * Math.PI) * arcHeight;
    const scale = 1 - p * 0.65; // scale from 1 down to 0.35
    const rotate = p * 420; // energetic spin

    flyer.style.transform = `translate3d(${curX - startX}px, ${curY - startY}px, 0) scale(${scale}) rotate(${rotate}deg)`;
    flyer.style.opacity = `${1 - Math.max(0, (p - 0.75) / 0.25) * 0.5}`;

    if (p < 1) {
      requestAnimationFrame(frame);
    } else {
      flyer.remove();

      // Elastic gulp bounce on the cart button
      cartBtn?.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.35) rotate(-6deg)", offset: 0.3 },
          { transform: "scale(0.88) rotate(4deg)", offset: 0.6 },
          { transform: "scale(1.1) rotate(-2deg)", offset: 0.8 },
          { transform: "scale(1) rotate(0deg)" },
        ],
        {
          duration: 480,
          easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        },
      );
    }
  }

  requestAnimationFrame(frame);
}
