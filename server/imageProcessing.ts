import sharp from "sharp";

interface ProcessedImage {
  buffer: Buffer;
  mimetype: string;
  originalSize: number;
  processedSize: number;
}

interface ProcessingOptions {
  maxDimension?: number;
  quality?: number;
  grayscale?: boolean;
}

const DEFAULT_OPTIONS: Required<ProcessingOptions> = {
  maxDimension: 1280,
  quality: 85,
  grayscale: true,
};

/**
 * Process a receipt image for optimal OCR and storage.
 * 
 * Transformations applied:
 * 1. Auto-rotate based on EXIF orientation (then strip EXIF)
 * 2. Resize so longest side is maxDimension pixels (no upscaling)
 * 3. Convert to grayscale (optional, default true)
 * 4. Convert to JPEG at specified quality
 * 
 * @param inputBuffer - The original image buffer
 * @param options - Processing options
 * @returns Processed image buffer with metadata
 */
export async function processReceiptImage(
  inputBuffer: Buffer,
  options: ProcessingOptions = {}
): Promise<ProcessedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = inputBuffer.length;

  // Get original image metadata to determine dimensions
  const metadata = await sharp(inputBuffer).metadata();
  const { width = 0, height = 0 } = metadata;

  // Determine if resizing is needed (don't upscale)
  const longestSide = Math.max(width, height);
  const needsResize = longestSide > opts.maxDimension;

  // Build the sharp pipeline
  let pipeline = sharp(inputBuffer)
    // Auto-rotate based on EXIF orientation, then remove EXIF data
    .rotate();

  // Only resize if image is larger than maxDimension
  if (needsResize) {
    pipeline = pipeline.resize({
      width: opts.maxDimension,
      height: opts.maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Apply grayscale if enabled
  if (opts.grayscale) {
    pipeline = pipeline.grayscale();
  }

  // Convert to JPEG with specified quality
  pipeline = pipeline.jpeg({
    quality: opts.quality,
    mozjpeg: true, // Use mozjpeg for better compression
  });

  const processedBuffer = await pipeline.toBuffer();

  return {
    buffer: processedBuffer,
    mimetype: "image/jpeg",
    originalSize,
    processedSize: processedBuffer.length,
  };
}

/**
 * Calculate compression ratio as a percentage reduction.
 */
export function getCompressionStats(original: number, processed: number): {
  reductionPercent: number;
  originalKB: number;
  processedKB: number;
} {
  const reductionPercent = Math.round((1 - processed / original) * 100);
  return {
    reductionPercent,
    originalKB: Math.round(original / 1024),
    processedKB: Math.round(processed / 1024),
  };
}
