import Image from "next/image";

type IrisEyeLogoProps = {
  size?: number;
  priority?: boolean;
  className?: string;
};

export function IrisEyeLogo({ size = 32, priority = false, className }: IrisEyeLogoProps) {
  return (
    <Image
      src="/iris-eye-transparent.png"
      alt="IRIS"
      width={size}
      height={Math.round(size * 0.74)}
      priority={priority}
      className={className}
      style={{
        width: size,
        height: "auto",
        objectFit: "contain",
      }}
    />
  );
}

type IrisIconMarkProps = {
  size?: number;
  priority?: boolean;
  className?: string;
};

// A simplified derivative of the full eye badge - just the radar-iris core,
// cropped and circle-masked from the same source art. The full illustration
// (satellite, mountains, mine cross-section) reads as detailed and premium
// at hero/splash size, but turns to mush below ~64px; this mark is what a
// real brand system would call the "favicon/icon" cut, distinct from the
// "primary" mark, and is what every small UI context (sidebar, favicon,
// auth card) should use instead of shrinking the full illustration.
export function IrisIconMark({ size = 28, priority = false, className }: IrisIconMarkProps) {
  return (
    <Image
      src="/iris-icon-mark.png"
      alt="IRIS"
      width={size}
      height={size}
      priority={priority}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
      }}
    />
  );
}

type IrisWordmarkProps = {
  width?: number;
  priority?: boolean;
  className?: string;
};

export function IrisWordmark({ width = 112, priority = false, className }: IrisWordmarkProps) {
  return (
    <Image
      src="/iris-wordmark-mark.png"
      alt="IRIS"
      width={width}
      height={Math.round(width * 0.226)}
      priority={priority}
      className={className}
      style={{
        width,
        height: "auto",
        objectFit: "contain",
      }}
    />
  );
}
