/**
 * Ultra-Delightful 3D "Product into Bag" Animation Engine for Magora Store.
 *
 * When the user clicks "Add to bag":
 * 1. An elegant 3D shopping bag / basket pops up on screen with depth & lighting.
 * 2. The 3D product (phone case, skin, or gadget) detaches from its card/hero,
 *    lifts towards the camera with genuine 3D perspective and deep shadow,
 *    arcs gracefully through the air, and plunges physically INTO the bag opening
 *    (disappearing behind the front wall of the bag).
 * 3. The bag catches it with an elastic squash-and-stretch bounce, shoots out
 *    a fountain of glowing celebratory sparkles, and pops a "✓ Added to Bag!" badge.
 * 4. The bag handles close, and the whole bag zips up smoothly into the header cart icon.
 */

export interface FlyItemOptions {
  name?: string;
  colorHex?: string;
  emoji?: string;
  image?: string;
  modelSlug?: string;
  sourceElement?: HTMLElement | null;
}

// Gentle pleasant haptic audio drop sound using native Web Audio API
function playDropChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    // Harmonic marimba drop tone (480Hz -> 280Hz -> 420Hz bounce)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(390, now + 0.22);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.33);
  } catch {}
}

export function triggerFlyToBag(sourceElement: HTMLElement | null, options: FlyItemOptions = {}) {
  if (typeof window === "undefined") return;

  // Cleanup any active animation stage so rapid clicks never stack or glitch
  const existingStage = document.getElementById("magora-fly-stage");
  if (existingStage) existingStage.remove();

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isMobile = vw < 768;

  // 1. Locate starting position
  // Prefer the 3D phone hero or product canvas if on screen, otherwise the clicked CTA button
  const heroEl =
    document.getElementById("product-hero-container") ||
    document.querySelector(".product-hero-canvas") ||
    document.querySelector("canvas");

  let startRect: { left: number; top: number; width: number; height: number };

  if (heroEl) {
    const r = heroEl.getBoundingClientRect();
    // Only use hero if it's currently visible in viewport
    if (r.top < vh && r.bottom > 0 && r.width > 30) {
      startRect = {
        left: r.left + r.width * 0.2,
        top: r.top + r.height * 0.2,
        width: r.width * 0.6,
        height: r.height * 0.6,
      };
    } else if (sourceElement) {
      startRect = sourceElement.getBoundingClientRect();
    } else {
      startRect = { left: vw / 2 - 40, top: vh / 2 - 60, width: 80, height: 120 };
    }
  } else if (sourceElement) {
    startRect = sourceElement.getBoundingClientRect();
  } else {
    startRect = { left: vw / 2 - 40, top: vh / 2 - 60, width: 80, height: 120 };
  }

  // 2. Position the Shopping Bag on screen
  // Desktop: center-right / center; Mobile: comfortably centered in viewport
  const bagWidth = isMobile ? 140 : 168;
  const bagHeight = isMobile ? 165 : 196;
  const bagX = isMobile ? vw / 2 : Math.min(vw * 0.62, vw - bagWidth - 60);
  const bagY = isMobile ? Math.max(160, vh * 0.44) : Math.max(180, vh * 0.48);

  // Bag opening target coordinates (where the product enters the mouth)
  const bagMouthX = bagX;
  const bagMouthY = bagY - bagHeight * 0.26;

  // 3. Find Header Cart button target (for final zoom-in)
  const headerCart =
    document.getElementById("header-cart-btn") ||
    document.querySelector("button[aria-label*='Cart']") ||
    document.querySelector("a[href='/cart']");

  const headerCartRect = headerCart ? headerCart.getBoundingClientRect() : {
    left: vw - 50,
    top: 24,
    width: 40,
    height: 40,
  };
  const headerCartX = headerCartRect.left + headerCartRect.width / 2;
  const headerCartY = headerCartRect.top + headerCartRect.height / 2;

  // 4. Create Master Animation Container
  const stage = document.createElement("div");
  stage.id = "magora-fly-stage";
  stage.setAttribute("aria-hidden", "true");
  stage.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 999999;
    perspective: 1200px;
    transform-style: preserve-3d;
    overflow: hidden;
  `;

  // Soft cinematic backdrop glow
  const backdrop = document.createElement("div");
  backdrop.style.cssText = `
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at ${bagX}px ${bagY}px, rgba(79, 70, 229, 0.12) 0%, transparent 65%);
    opacity: 0;
    transition: opacity 0.3s ease-out;
  `;
  stage.appendChild(backdrop);

  // 5. Build the 3D Shopping Bag Component (Layered for Depth)
  const bagWrap = document.createElement("div");
  bagWrap.style.cssText = `
    position: absolute;
    left: ${bagX}px;
    top: ${bagY}px;
    width: ${bagWidth}px;
    height: ${bagHeight}px;
    transform: translate(-50%, -50%) scale(0) rotate(-6deg);
    transform-origin: center bottom;
    transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;

  // Floor shadow underneath bag
  const floorShadow = document.createElement("div");
  floorShadow.style.cssText = `
    position: absolute;
    left: 10%;
    bottom: -14px;
    width: 80%;
    height: 24px;
    background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.4) 0%, transparent 75%);
    border-radius: 50%;
    transform: scale(0.6);
    transition: transform 0.4s ease;
  `;
  bagWrap.appendChild(floorShadow);

  // Bag Back Layer (Handles, inside cavity, back rim) - z-index: 10
  const bagBack = document.createElement("div");
  bagBack.style.cssText = `
    position: absolute;
    inset: 0;
    z-index: 10;
  `;
  bagBack.innerHTML = `
    <svg viewBox="0 0 160 190" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="handle-grad-back" x1="0" y1="0" x2="0" y2="100%">
          <stop offset="0%" stop-color="#4f46e5" />
          <stop offset="100%" stop-color="#312e81" />
        </linearGradient>
        <radialGradient id="cavity-depth" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#050713" />
          <stop offset="85%" stop-color="#0c0e1e" />
          <stop offset="100%" stop-color="#1e1b4b" />
        </radialGradient>
      </defs>
      <!-- Back handle loop -->
      <path d="M 52 50 C 52 14, 108 14, 108 50" stroke="url(#handle-grad-back)" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.8" />
      <!-- Dark deep cavity where the product falls inside -->
      <ellipse cx="80" cy="54" rx="60" ry="18" fill="url(#cavity-depth)" />
    </svg>
  `;
  bagWrap.appendChild(bagBack);

  // Product Drop Slot (z-index: 20) - Between Bag Back and Bag Front!
  const productSlot = document.createElement("div");
  productSlot.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 20;
    overflow: hidden; /* Clips the product as it drops behind the front wall! */
    border-radius: 0 0 28px 28px;
  `;
  bagWrap.appendChild(productSlot);

  // Bag Front Layer (Front wall, luxury shine, front handles, Magora logo) - z-index: 30
  const bagFront = document.createElement("div");
  bagFront.style.cssText = `
    position: absolute;
    inset: 0;
    z-index: 30;
    pointer-events: none;
  `;
  bagFront.innerHTML = `
    <svg viewBox="0 0 160 190" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bag-front-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#4338ca" />
          <stop offset="45%" stop-color="#3730a3" />
          <stop offset="100%" stop-color="#1e1b4b" />
        </linearGradient>
        <linearGradient id="bag-rim-shine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#818cf8" stop-opacity="0.9" />
          <stop offset="50%" stop-color="#ffffff" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#818cf8" stop-opacity="0.9" />
        </linearGradient>
        <linearGradient id="handle-grad-front" x1="0" y1="0" x2="0" y2="100%">
          <stop offset="0%" stop-color="#818cf8" />
          <stop offset="100%" stop-color="#4f46e5" />
        </linearGradient>
        <linearGradient id="gold-monogram" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fde047" />
          <stop offset="100%" stop-color="#eab308" />
        </linearGradient>
      </defs>
      
      <!-- Front Tote Bag Shell with curved 3D perspective -->
      <path d="M 20 54 Q 80 72 140 54 L 126 172 Q 80 184 34 172 Z" fill="url(#bag-front-body)" filter="drop-shadow(0 14px 28px rgba(0,0,0,0.35))" />
      
      <!-- Front Rim Lip highlighting the open mouth -->
      <path d="M 20 54 Q 80 72 140 54 Q 80 64 20 54 Z" fill="url(#bag-rim-shine)" />
      
      <!-- Subtle side crease lines for 3D tote depth -->
      <path d="M 34 172 L 40 60" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" />
      <path d="M 126 172 L 120 60" stroke="rgba(0,0,0,0.3)" stroke-width="2" />
      
      <!-- Front handle loop -->
      <path d="M 52 58 C 52 24, 108 24, 108 58" stroke="url(#handle-grad-front)" stroke-width="7" stroke-linecap="round" fill="none" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.3))" />

      <!-- Magora Luxury Monogram / Logo on front -->
      <g transform="translate(80, 118)">
        <circle cx="0" cy="0" r="16" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="1.2" />
        <circle cx="0" cy="0" r="10" stroke="url(#gold-monogram)" stroke-width="2.2" fill="none" />
        <path d="M -4 4 L 0 -4 L 4 4" stroke="url(#gold-monogram)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </svg>
  `;
  bagWrap.appendChild(bagFront);

  // Celebratory Floating Pill: "✓ Added to Bag!"
  const badge = document.createElement("div");
  badge.style.cssText = `
    position: absolute;
    left: 50%;
    top: -26px;
    transform: translate(-50%, 10px) scale(0);
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: linear-gradient(135deg, #10b981, #059669);
    border: 2px solid rgba(255, 255, 255, 0.95);
    border-radius: 999px;
    color: #ffffff;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.2px;
    white-space: nowrap;
    box-shadow: 0 10px 25px rgba(16, 185, 129, 0.45), 0 3px 8px rgba(0, 0, 0, 0.2);
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;
  badge.innerHTML = `<span>✓</span><span>Added to Bag!</span>`;
  bagWrap.appendChild(badge);

  stage.appendChild(bagWrap);

  // 6. Build the 3D Flying Product
  const startCenterX = startRect.left + startRect.width / 2;
  const startCenterY = startRect.top + startRect.height / 2;

  const flyer = document.createElement("div");
  const pWidth = isMobile ? 64 : 76;
  const pHeight = isMobile ? 112 : 132;

  flyer.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: ${pWidth}px;
    height: ${pHeight}px;
    z-index: 999998;
    transform-origin: center center;
    pointer-events: none;
    will-change: transform, opacity;
    transform-style: preserve-3d;
  `;

  // Realistic 3D Phone Case / Product Model Card
  const phoneBody = document.createElement("div");
  phoneBody.style.cssText = `
    width: 100%;
    height: 100%;
    border-radius: 20px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.45), 0 8px 18px rgba(0, 0, 0, 0.25);
    transform-style: preserve-3d;
  `;

  if (options.image) {
    phoneBody.innerHTML = `
      <img src="${options.image}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:20px;border:2.5px solid rgba(255,255,255,0.85);" />
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.4) 0%,transparent 60%);pointer-events:none;"></div>
    `;
  } else {
    const bgCol = options.colorHex || "#374151";
    phoneBody.innerHTML = `
      <div style="width:100%;height:100%;background:${bgCol};border-radius:20px;border:2.5px solid rgba(255,255,255,0.85);position:relative;display:flex;align-items:center;justify-content:center;">
        <!-- MagSafe Ring -->
        <div style="width:36px;height:36px;border-radius:50%;border:2px solid rgba(255,255,255,0.55);position:relative;">
          <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:2.5px;height:7px;background:rgba(255,255,255,0.55);border-radius:2px;"></div>
        </div>
        <!-- Camera Plateau at top left -->
        <div style="position:absolute;top:7px;left:7px;width:24px;height:24px;border-radius:7px;background:rgba(0,0,0,0.22);border:1px solid rgba(255,255,255,0.25);display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:3px;">
          <div style="background:#111;border-radius:50%;border:0.8px solid rgba(255,255,255,0.4);"></div>
          <div style="background:#111;border-radius:50%;border:0.8px solid rgba(255,255,255,0.4);"></div>
        </div>
        <!-- Specular reflection sweep -->
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.45) 0%,transparent 55%);pointer-events:none;"></div>
      </div>
    `;
  }

  flyer.appendChild(phoneBody);
  stage.appendChild(flyer);
  document.body.appendChild(stage);

  // 7. Execute the 3D Animation Choreography

  // Step A: Pop the Bag onto the Screen
  requestAnimationFrame(() => {
    backdrop.style.opacity = "1";
    bagWrap.style.transform = "translate(-50%, -50%) scale(1) rotate(0deg)";
    floorShadow.style.transform = "scale(1)";
  });

  // Step B: Product Flight & Drop (Total flight duration: 750ms)
  const flightDuration = 760;
  const startTime = performance.now();

  // Trajectory Control Points (Quadratic Bezier with 3D arc)
  const startX = startCenterX - pWidth / 2;
  const startY = startCenterY - pHeight / 2;
  const targetDropX = bagMouthX - pWidth / 2;
  const targetDropY = bagMouthY - pHeight * 0.45; // Plunge target just above cavity

  // Calculate high arc curve
  const midY = Math.min(startY, targetDropY) - Math.max(120, Math.abs(startY - targetDropY) * 0.35 + 80);

  function animateFlight(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / flightDuration, 1);

    if (progress < 0.85) {
      // Phase 1: Arcing flight in full 3D perspective towards the bag mouth
      const p = progress / 0.85;
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // in-out quad

      // Parabolic position
      const curX = (1 - ease) * startX + ease * targetDropX;
      const curY = (1 - ease) * (1 - ease) * startY + 2 * (1 - ease) * ease * midY + ease * ease * targetDropY;

      // 3D rotations: item lifts towards camera, turns, and angles to face the opening
      const liftScale = 1 + Math.sin(p * Math.PI) * 0.32; // scales up to 1.32x at peak
      const rotX = 15 + p * 45; // tilts forward to drop into bag
      const rotY = -25 + p * 25; // untwists
      const rotZ = Math.sin(p * Math.PI) * 22; // playful banking turn

      flyer.style.transform = `
        translate3d(${curX}px, ${curY}px, ${Math.sin(p * Math.PI) * 160}px)
        rotateX(${rotX}deg)
        rotateY(${rotY}deg)
        rotateZ(${rotZ}deg)
        scale(${liftScale})
      `;
      flyer.style.opacity = "1";

      requestAnimationFrame(animateFlight);
    } else {
      // Phase 2: PLUNGE INTO THE BAG! (85% to 100%)
      const dropP = (progress - 0.85) / 0.15; // 0 to 1
      const dropEase = dropP * dropP; // accelerated gravity drop

      const curX = targetDropX;
      // Drops 70px downward right into the bag opening
      const curY = targetDropY + dropEase * 75;
      const dropScale = 1.0 - dropEase * 0.45; // shrinks slightly as it enters depth
      const dropRotX = 60 + dropEase * 15; // steep vertical drop angle

      flyer.style.transform = `
        translate3d(${curX}px, ${curY}px, 0px)
        rotateX(${dropRotX}deg)
        scale(${dropScale})
      `;

      // Crucial optical effect: fade out quickly as it passes behind front tote wall
      flyer.style.opacity = `${Math.max(0, 1 - dropEase * 1.5)}`;

      if (progress < 1) {
        requestAnimationFrame(animateFlight);
      } else {
        // Landing complete!
        flyer.remove();
        onProductLanded();
      }
    }
  }

  requestAnimationFrame(animateFlight);

  // Step C: Impact Reaction & Sparkles
  function onProductLanded() {
    // 1. Play soft audio chime
    playDropChime();

    // 2. Elastic squash-and-stretch on the bag
    bagWrap.animate(
      [
        { transform: "translate(-50%, -50%) scale(1, 1)" },
        { transform: "translate(-50%, -50%) scale(1.18, 0.82) translateY(10px)", offset: 0.25 },
        { transform: "translate(-50%, -50%) scale(0.92, 1.12) translateY(-6px)", offset: 0.55 },
        { transform: "translate(-50%, -50%) scale(1.05, 0.96) translateY(2px)", offset: 0.8 },
        { transform: "translate(-50%, -50%) scale(1, 1) translateY(0)" },
      ],
      {
        duration: 520,
        easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    );

    // 3. Show "Added to Bag!" celebratory badge
    badge.style.transform = "translate(-50%, -6px) scale(1)";

    // 4. Burst joyful fountain sparkles from bag mouth
    spawnSparkles(bagWrap, bagWidth / 2, bagHeight * 0.26);

    // Step D: Send the whole bag to Header Cart icon
    setTimeout(() => {
      badge.style.transform = "translate(-50%, 10px) scale(0)";
      backdrop.style.opacity = "0";

      // Calculate path from Bag Center to Header Cart Button
      const deltaX = headerCartX - bagX;
      const deltaY = headerCartY - bagY;

      bagWrap.style.transition = "transform 0.55s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.55s ease";
      bagWrap.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(0.2) rotate(15deg)`;
      bagWrap.style.opacity = "0";

      setTimeout(() => {
        // Pulse the header cart button
        headerCart?.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.4) rotate(-6deg)", offset: 0.3 },
            { transform: "scale(0.88) rotate(4deg)", offset: 0.6 },
            { transform: "scale(1.1) rotate(-2deg)", offset: 0.8 },
            { transform: "scale(1) rotate(0deg)" },
          ],
          {
            duration: 450,
            easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          },
        );

        stage.remove();
      }, 550);
    }, 450);
  }
}

// Sparkle fountain emitter
function spawnSparkles(container: HTMLElement, originX: number, originY: number) {
  const colors = ["#fbbf24", "#38bdf8", "#a855f7", "#34d399", "#ffffff", "#f43f5e"];
  const count = 14;

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5; // Upward fan angle
    const distance = 40 + Math.random() * 55;
    const endX = Math.cos(angle) * distance;
    const endY = Math.sin(angle) * distance;
    const color = colors[i % colors.length];
    const size = 5 + Math.random() * 6;

    p.style.cssText = `
      position: absolute;
      left: ${originX}px;
      top: ${originY}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      box-shadow: 0 0 10px ${color}, 0 0 4px #fff;
      pointer-events: none;
      z-index: 50;
      transform: translate(-50%, -50%) scale(0);
      transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease-out;
    `;

    container.appendChild(p);

    requestAnimationFrame(() => {
      p.style.transform = `translate(calc(-50% + ${endX}px), calc(-50% + ${endY}px)) scale(1.2) rotate(${Math.random() * 180}deg)`;
      setTimeout(() => {
        p.style.opacity = "0";
        p.style.transform += " scale(0.3)";
        setTimeout(() => p.remove(), 600);
      }, 250);
    });
  }
}
