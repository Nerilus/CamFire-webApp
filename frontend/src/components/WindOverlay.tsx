import React, { useRef, useEffect } from 'react';

interface WindOverlayProps {
  windDirection: number; // Meteorological wind direction (degrees, 0 = from North)
  windSpeed: number; // km/h
}

export const WindOverlay: React.FC<WindOverlayProps> = ({ windDirection, windSpeed }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Adjust canvas resolution to match its container, not the whole window
    const resize = () => {
      const parent = canvas.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', resize);
    resize();

    // Map meteorological wind direction to canvas movement angle
    const movingDeg = (windDirection + 180) % 360;
    const angleRad = (movingDeg - 90) * (Math.PI / 180);

    // Particle system
    const numParticles = 400; // Increase density for a better fluid look
    const particles: any[] = [];

    const speedMultiplier = Math.max(0.5, windSpeed / 10); 

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        age: 0,
        maxAge: 40 + Math.random() * 80, 
        speed: speedMultiplier * (1 + Math.random() * 0.8), // Slightly faster
      });
    }

    const draw = () => {
      // Magic trick for fading trails on a transparent canvas:
      // We use 'destination-out' to slightly erase the existing canvas each frame
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; // The alpha value controls trail length (lower = longer)
      ctx.fillRect(0, 0, width, height);

      // Switch back to normal drawing for the particles
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; // Sky blue

      ctx.beginPath();
      for (let p of particles) {
        // Draw from current position to next position
        ctx.moveTo(p.x, p.y);
        
        const dx = Math.cos(angleRad) * p.speed * 2;
        const dy = Math.sin(angleRad) * p.speed * 2;
        
        p.x += dx;
        p.y += dy;
        
        ctx.lineTo(p.x, p.y);
        
        p.age++;
        
        if (p.age > p.maxAge || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
          p.x = Math.random() * width;
          p.y = Math.random() * height;
          p.age = 0;
          p.speed = speedMultiplier * (1 + Math.random() * 0.8);
        }
      }
      ctx.stroke();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [windDirection, windSpeed]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 500, // 500 is higher than Leaflet map pane (400) but lower than markers (600). Perfect!
      }}
    />
  );
};
