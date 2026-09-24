// Subagent 6: Human Hand & Precision Cursor Workflow Synthesizer
export class CursorRig {
  constructor(container) {
    this.container = container;
    this.element = document.createElement('div');
    this.element.className = 'studio-cursor-rig';
    this.element.style.position = 'absolute';
    this.element.style.pointerEvents = 'none';
    this.element.style.zIndex = '9999';
    this.element.style.transform = 'translate3d(-100px, -100px, 0)';
    this.element.style.transition = 'none';

    // High fidelity SVG cursor with realistic drop shadow and click ripple container
    this.element.innerHTML = `
      <svg class="cursor-pointer" width="32" height="32" viewBox="0 0 32 32" fill="none" style="filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5)); transform-origin: 0 0;">
        <path d="M5.65376 2.34827C4.69805 1.54784 3.25 2.22855 3.25 3.47547V28.4755C3.25 29.8094 4.88726 30.4571 5.80373 29.4883L12.395 22.5204C12.7538 22.1411 13.2547 21.9274 13.7779 21.9274H25.4372C26.7412 21.9274 27.4285 20.3797 26.5492 19.4172L5.65376 2.34827Z" fill="#FFFFFF" stroke="#000000" stroke-width="2" stroke-linejoin="round"/>
      </svg>
      <div class="cursor-ripple" style="position: absolute; left: 0px; top: 0px; width: 0; height: 0; border-radius: 50%; background: radial-gradient(circle, rgba(59,130,246,0.6) 0%, rgba(59,130,246,0) 70%); transform: translate(-50%, -50%); opacity: 0; pointer-events: none;"></div>
    `;

    if (this.container) {
      this.container.appendChild(this.element);
    }
  }

  // Cubic-bezier smooth human movement from (x1, y1) to (x2, y2)
  moveTo(x, y, duration = 800, onComplete) {
    const startTime = performance.now();
    const startX = this.currentX || 100;
    const startY = this.currentY || 100;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Apple-style cubic-bezier easeOutQuint (0.16, 1, 0.3, 1)
      const ease = 1 - Math.pow(1 - progress, 5);

      this.currentX = startX + (x - startX) * ease;
      this.currentY = startY + (y - startY) * ease;

      this.element.style.transform = `translate3d(${this.currentX}px, ${this.currentY}px, 0)`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (onComplete) {
        onComplete();
      }
    };
    requestAnimationFrame(animate);
  }

  // Visual click down, ripple wave, and target depression
  click(targetSelector, onComplete) {
    const pointer = this.element.querySelector('.cursor-pointer');
    const ripple = this.element.querySelector('.cursor-ripple');

    // Down state
    pointer.style.transform = 'scale(0.85)';
    if (targetSelector) {
      const el = document.querySelector(targetSelector);
      if (el) el.style.transform = 'scale(0.96)';
    }

    // Emit ripple
    ripple.style.width = '60px';
    ripple.style.height = '60px';
    ripple.style.opacity = '1';
    ripple.style.transition = 'width 400ms cubic-bezier(0,0,0.2,1), height 400ms cubic-bezier(0,0,0.2,1), opacity 400ms ease';

    setTimeout(() => {
      // Up state
      pointer.style.transform = 'scale(1)';
      if (targetSelector) {
        const el = document.querySelector(targetSelector);
        if (el) el.style.transform = 'scale(1)';
      }
      ripple.style.opacity = '0';
      setTimeout(() => {
        ripple.style.width = '0px';
        ripple.style.height = '0px';
        ripple.style.transition = 'none';
        if (onComplete) onComplete();
      }, 200);
    }, 180);
  }
}
