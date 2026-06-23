/** Creates an HTMLImageElement from a data URL. */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = url;
  });
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crop an image to the given pixel area and return a JPEG Blob.
 * Uses Canvas API — no external dependencies.
 *
 * @param imageUrl  - data URL of the original image
 * @param pixelCrop - crop coordinates in original-image pixel space
 * @param quality   - JPEG quality 0–1 (default 0.92 for hero display)
 */
export async function getCroppedBlob(
  imageUrl: string,
  pixelCrop: CropArea,
  quality = 0.92,
): Promise<Blob> {
  const image = await createImage(imageUrl);

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D 上下文不可用');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('图片裁剪失败'));
        }
      },
      'image/jpeg',
      quality,
    );
  });
}
