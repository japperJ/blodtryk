// Billedkomprimering og -behandling
// Komprimerer store kamerabilleder til passende størrelse til OCR

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.8;

/**
 * Komprimerer et billede til OCR-egnet størrelse
 * Returnerer base64-streng (uden data-URL præfix)
 */
export async function compressImageForOCR(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      // Beregn nye dimensioner
      let { width, height } = img;

      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      // Opret canvas og tegn billede
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Tegn billede med nye dimensioner
      ctx.drawImage(img, 0, 0, width, height);

      // Gråtone + kontrastforstærkning (samme som kameraets enhanceForOCR)
      const imageData = ctx.getImageData(0, 0, width, height);
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

      // Konverter til JPEG base64
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const base64 = dataUrl.split(',')[1] || '';

      URL.revokeObjectURL(url);
      resolve(base64);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Opretter thumbnail til preview (mindre end OCR-versionen)
 */
export async function createThumbnail(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      URL.revokeObjectURL(url);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Beregner estimeret filstørrelse i KB for base64-streng
 */
export function estimateBase64SizeKB(base64: string): number {
  return Math.round((base64.length * 3) / 4 / 1024);
}

/**
 * Tjekker om et billede er stort nok til OCR
 * (minimum ~37KB base64 = ~50KB fil)
 */
export function isImageLargeEnough(base64: string): boolean {
  return estimateBase64SizeKB(base64) >= 37;
}
