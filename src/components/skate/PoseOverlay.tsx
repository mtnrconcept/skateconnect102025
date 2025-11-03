import { useEffect, useRef } from 'react';

interface PoseOverlayProps {
  keypoints: any[];
  boardVector: { angle: number; pitch: number; yaw: number } | null;
  show: boolean;
}

export default function PoseOverlay({ keypoints, boardVector, show }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!show || !canvasRef.current || keypoints.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw skeleton connections
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // head
      [1, 5], [5, 6], [6, 7], // left arm
      [1, 8], [8, 9], [9, 10], // right arm
      [1, 11], [11, 12], [12, 13], // left leg
      [1, 14], [14, 15], [15, 16], // right leg
    ];

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;

    keypoints.forEach((kp: any) => {
      if (!kp.x || !kp.y || kp.confidence < 0.5) return;

      const x = kp.x * canvas.width;
      const y = kp.y * canvas.height;

      // Draw connections
      connections.forEach(([start, end]) => {
        const startKp = keypoints[start];
        const endKp = keypoints[end];
        if (startKp && endKp && startKp.confidence > 0.5 && endKp.confidence > 0.5) {
          ctx.beginPath();
          ctx.moveTo(startKp.x * canvas.width, startKp.y * canvas.height);
          ctx.lineTo(endKp.x * canvas.width, endKp.y * canvas.height);
          ctx.stroke();
        }
      });

      // Draw keypoint
      ctx.fillStyle = kp.confidence > 0.7 ? '#00ff00' : '#ffff00';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw board vector if available
    if (boardVector) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height * 0.75; // Approximate board position
      const length = 100;
      const angleRad = (boardVector.angle * Math.PI) / 180;

      ctx.strokeStyle = '#ff6b00';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + length * Math.cos(angleRad),
        centerY + length * Math.sin(angleRad),
      );
      ctx.stroke();

      // Rotation indicator
      ctx.fillStyle = '#ff6b00';
      ctx.font = '16px sans-serif';
      ctx.fillText(
        `Roll: ${Math.round(boardVector.angle)}°`,
        centerX + length * Math.cos(angleRad) + 10,
        centerY + length * Math.sin(angleRad),
      );
    }
  }, [keypoints, boardVector, show]);

  if (!show) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    />
  );
}







