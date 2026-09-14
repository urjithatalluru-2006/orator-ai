/**
 * Local Vision & Canvas CV Metrics Engine
 * Operates at 30fps locally on an OFFSCREEN Canvas to measure objective physical metrics:
 * - Posture stability delta (movement relative to baseline)
 * - Camera gaze focus ratio (eye/head orientation relative to camera center)
 * - Gesture motion energy (frame-to-frame pixel luminance delta)
 * 
 * CRITICAL FIX: Uses offscreen processing canvas so it NEVER visually duplicates
 * or overlays a second ghost frame over the live video element.
 */
export class LocalVisionService {
  constructor(videoElement, onMetricsUpdate) {
    this.video = videoElement;
    this.onMetricsUpdate = onMetricsUpdate;

    // Use OFFSCREEN canvas to prevent any ghost image rendering over live video
    this.offscreenCanvas = document.createElement('canvas');
    this.ctx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    this.animFrameId = null;
    this.isRunning = false;

    this.prevFrameData = null;
    this.baselineCenter = { x: 0.5, y: 0.5 };
    this.postureDelta = 0;
    this.gazeRatio = 0.85; // 0.0 (away) to 1.0 (centered at camera)
    this.gestureActivity = 0.2; // Motion energy
  }

  start() {
    if (!this.video) return;
    this.isRunning = true;
    this.loop();
  }

  loop() {
    if (!this.isRunning) return;

    if (this.video && this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      const width = this.video.videoWidth || 640;
      const height = this.video.videoHeight || 480;

      if (this.offscreenCanvas.width !== width) this.offscreenCanvas.width = width;
      if (this.offscreenCanvas.height !== height) this.offscreenCanvas.height = height;

      if (this.ctx) {
        this.ctx.drawImage(this.video, 0, 0, width, height);
        this.processFrame(width, height);
      }
    }

    this.animFrameId = requestAnimationFrame(() => this.loop());
  }

  processFrame(width, height) {
    try {
      // Sample central region (face/head approximation)
      const sampleWidth = Math.floor(width * 0.4);
      const sampleHeight = Math.floor(height * 0.4);
      const startX = Math.floor((width - sampleWidth) / 2);
      const startY = Math.floor((height - sampleHeight) / 3);

      const frame = this.ctx.getImageData(startX, startY, sampleWidth, sampleHeight);
      const data = frame.data;

      // 1. Calculate Motion Energy (Luminance delta against previous frame)
      let totalDelta = 0;
      if (this.prevFrameData && this.prevFrameData.length === data.length) {
        for (let i = 0; i < data.length; i += 16) {
          const lumCurr = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const lumPrev = 0.299 * this.prevFrameData[i] + 0.587 * this.prevFrameData[i + 1] + 0.114 * this.prevFrameData[i + 2];
          totalDelta += Math.abs(lumCurr - lumPrev);
        }
        const samples = data.length / 16;
        const avgMotion = totalDelta / samples;
        this.gestureActivity = Math.min(1.0, parseFloat((avgMotion / 30).toFixed(2)));
      }
      this.prevFrameData = data;

      // 2. Posture Baseline Shift & Gaze Estimation
      let sumX = 0, sumY = 0, count = 0;
      for (let y = 0; y < sampleHeight; y += 10) {
        for (let x = 0; x < sampleWidth; x += 10) {
          const idx = (y * sampleWidth + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (lum < 160) {
            sumX += x;
            sumY += y;
            count++;
          }
        }
      }

      if (count > 0) {
        const currX = (sumX / count) / sampleWidth;
        const currY = (sumY / count) / sampleHeight;

        const distFromCenter = Math.sqrt(Math.pow(currX - 0.5, 2) + Math.pow(currY - 0.5, 2));
        this.gazeRatio = Math.max(0.1, parseFloat((1.0 - Math.min(1.0, distFromCenter * 2.5)).toFixed(2)));

        const postureShift = Math.abs(currY - this.baselineCenter.y);
        this.postureDelta = parseFloat(postureShift.toFixed(2));
      }

      if (this.onMetricsUpdate) {
        this.onMetricsUpdate({
          gazeRatio: this.gazeRatio,
          postureDelta: this.postureDelta,
          gestureActivity: this.gestureActivity
        });
      }
    } catch (e) {
      // Ignore canvas processing exceptions
    }
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
