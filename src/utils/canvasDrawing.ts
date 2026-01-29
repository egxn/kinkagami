import * as poseDetection from '@tensorflow-models/pose-detection';
import { logger } from './logger';

// Helper function to draw a single keypoint
export const drawKeypoint = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string
) => {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, 2 * Math.PI);
  ctx.fillStyle = 'red';
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.font = '10px Arial';
  ctx.fillText(label, x + 10, y);
};

// Helper function to draw connections between keypoints
export const drawConnections = (
  ctx: CanvasRenderingContext2D,
  keypoints: poseDetection.Keypoint[],
  adjacentPairs: [number, number][]
) => {
  adjacentPairs.forEach(([i, j]) => {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];

    if (kp1.score && kp2.score && kp1.score > 0.1 && kp2.score > 0.1) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
};

// Main draw function for poses
export const drawPosesOnCanvas = (
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  poses: poseDetection.Pose[]
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scaleX = canvas.width / video.videoWidth;
  const scaleY = canvas.height / video.videoHeight;

  logger.log('Canvas', `Video: ${video.videoWidth}x${video.videoHeight}, Canvas: ${canvas.width}x${canvas.height}`);

  poses.forEach(pose => {
    const visibleKeypoints = pose.keypoints.filter(kp => kp.score && kp.score > 0.1);
    logger.log('Canvas', `Pose has ${visibleKeypoints.length} keypoints with score > 0.1`);

    // Draw keypoints
    pose.keypoints.forEach(keypoint => {
      if (keypoint.score && keypoint.score > 0.1) {
        const x = keypoint.x * scaleX;
        const y = keypoint.y * scaleY;
        drawKeypoint(ctx, x, y, keypoint.name || '');
      }
    });

    // Draw connections
    const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(
      poseDetection.SupportedModels.MoveNet
    );

    const scaledKeypoints = pose.keypoints.map(kp => ({
      ...kp,
      x: kp.x * scaleX,
      y: kp.y * scaleY,
    }));

    drawConnections(ctx, scaledKeypoints, adjacentKeyPoints);
  });
};
