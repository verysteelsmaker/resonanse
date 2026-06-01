import { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
  frequencyData: Uint8Array;
  isPlaying: boolean;
}

export function AudioVisualizer({ frequencyData, isPlaying }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (!isPlaying) {
        // Draw idle line
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        animationId = requestAnimationFrame(draw);
        return;
      }

      const barCount = frequencyData.length;
      const barWidth = width / barCount;
      const gap = 1;

      for (let i = 0; i < barCount; i++) {
        const value = frequencyData[i];
        const percent = value / 255;
        const barHeight = percent * height * 0.85;
        const x = i * barWidth;
        const y = (height - barHeight) / 2;

        // Gradient from white to gray based on intensity
        const intensity = Math.floor(percent * 200 + 55);
        ctx.fillStyle = `rgba(${intensity}, ${intensity}, ${intensity}, ${0.3 + percent * 0.7})`;
        ctx.fillRect(x + gap / 2, y, barWidth - gap, barHeight);
      }

      // Center glow line
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [frequencyData, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={200}
      className="w-full h-48 rounded-lg"
      style={{ imageRendering: 'auto' }}
    />
  );
}
