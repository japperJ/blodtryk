"use client";
import { useRef, useState, useCallback, useEffect } from "react";

/** Convert canvas to grayscale with boosted contrast for better OCR */
function enhanceForOCR(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }

  const range = max - min || 1;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    let val = ((gray - min) / range) * 255;
    val = ((val / 255 - 0.5) * 1.5 + 0.5) * 255;
    val = Math.max(0, Math.min(255, val));
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
  }
  ctx.putImageData(imageData, 0, 0);
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // When video element appears in DOM, attach the stream
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream && !video.srcObject) {
      console.log("Attaching stream to video element");
      video.srcObject = stream;
      video.play().catch((e) => console.warn("Video play failed:", e));
    }
  });

  const start = useCallback(async () => {
    try {
      setError(null);
      setIsReady(false);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });

      // Store stream in ref so useEffect can attach it
      streamRef.current = mediaStream;

      // Also try to attach immediately in case video element already exists
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }

      // Wait for metadata
      const video = videoRef.current;
      if (video) {
        await new Promise<void>((resolve) => {
          if (video.readyState >= 1) {
            resolve();
          } else {
            video.addEventListener("loadedmetadata", () => resolve(), { once: true });
          }
        });

        await video.play();

        // Wait for video data
        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) {
            resolve();
            return;
          }
          if (typeof video.requestVideoFrameCallback === "function") {
            const timeout = setTimeout(() => resolve(), 3000);
            video.requestVideoFrameCallback(() => {
              clearTimeout(timeout);
              resolve();
            });
          } else {
            const interval = setInterval(() => {
              if (video.readyState >= 2) {
                clearInterval(interval);
                resolve();
              }
            }, 100);
            setTimeout(() => {
              clearInterval(interval);
              resolve();
            }, 3000);
          }
        });

        const track = mediaStream.getVideoTracks()[0];
        const settings = track?.getSettings();
        console.log("Camera ready:", {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          trackW: settings?.width,
          trackH: settings?.height,
        });
      }
      setIsActive(true);
      setIsReady(true);
    } catch (err) {
      console.error("Camera error:", err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Kameraadgang nægtet. Åbn browserindstillinger og tillad kamera for denne side.");
      } else {
        setError("Kamera ikke tilgængeligt. Tillad kameradgang i browseren.");
      }
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setIsReady(false);
  }, []);

  const capture = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const stream = streamRef.current;
    if (!video || !canvas) return null;

    // Method 1: ImageCapture API
    const track = stream?.getVideoTracks()[0];
    if (track && typeof ImageCapture !== "undefined") {
      try {
        // grabFrame mangler i de aktuelle TS lib-typings — udvid typen lokalt
        const imageCapture = new ImageCapture(track) as ImageCapture & {
          grabFrame(): Promise<ImageBitmap>;
        };
        const bitmap = await imageCapture.grabFrame();

        const maxW = 1920;
        const scale = bitmap.width > maxW ? maxW / bitmap.width : 1;
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        enhanceForOCR(ctx, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        console.log("Capture OK (ImageCapture):", canvas.width + "x" + canvas.height, "base64:", dataUrl.length);
        return dataUrl;
      } catch (e) {
        console.warn("ImageCapture failed, falling back:", e);
      }
    }

    // Method 2: Canvas fallback
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (!w || !h) {
      const settings = stream?.getVideoTracks()[0]?.getSettings();
      w = settings?.width ?? 640;
      h = settings?.height ?? 480;
    }

    const maxW = 1920;
    const scale = w > maxW ? maxW / w : 1;
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    enhanceForOCR(ctx, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    console.log("Capture OK (canvas):", canvas.width + "x" + canvas.height, "base64:", dataUrl.length);
    return dataUrl;
  }, []);

  return { videoRef, canvasRef, isActive, isReady, error, start, stop, capture };
}
