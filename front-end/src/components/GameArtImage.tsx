import type { ImgHTMLAttributes } from "react";
import { getDiscoveryGame, getGameImagePosition } from "@/config/discovery.config";
import { cn } from "@/lib/utils";

type GameArtImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  game?: string;
  variant?: "card" | "banner";
};

export const GameArtImage = ({
  game,
  variant = "card",
  className,
  style,
  src,
  alt,
  loading = "lazy",
  decoding = "async",
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  ...props
}: GameArtImageProps) => {
  const discoveryGame = getDiscoveryGame(game);

  return (
    <img
      src={src || discoveryGame.image}
      alt={alt ?? discoveryGame.label}
      loading={loading}
      decoding={decoding}
      sizes={sizes}
      draggable={false}
      className={cn("h-full w-full bg-muted/30 object-cover", className)}
      style={{ objectPosition: getGameImagePosition(game, variant), ...style }}
      {...props}
    />
  );
};

export default GameArtImage;
