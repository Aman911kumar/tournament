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
  ...props
}: GameArtImageProps) => {
  const discoveryGame = getDiscoveryGame(game);

  return (
    <img
      src={src || discoveryGame.image}
      alt={alt ?? discoveryGame.label}
      loading={loading}
      decoding={decoding}
      className={cn("h-full w-full object-cover", className)}
      style={{ objectPosition: getGameImagePosition(game, variant), ...style }}
      {...props}
    />
  );
};

export default GameArtImage;
