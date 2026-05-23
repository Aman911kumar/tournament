type CompressOptions = {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
  targetType?: "image/webp" | "image/jpeg" | "image/png";
};

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    image.src = url;
  });

export const compressImageFile = async (
  file: File,
  {
    maxWidth,
    maxHeight,
    quality = 0.82,
    targetType = "image/webp",
  }: CompressOptions,
) => {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;

  try {
    const image = await loadImage(file);
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return file;

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, targetType, quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const extension = targetType === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "profile-image";
    return new File([blob], `${baseName}.${extension}`, {
      type: blob.type || targetType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
};
