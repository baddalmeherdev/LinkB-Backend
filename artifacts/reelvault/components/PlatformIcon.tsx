import { Feather, FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";

type Props = {
  platform: string;
  size?: number;
  color?: string;
};

export function PlatformIcon({ platform, size = 18, color = "#fff" }: Props) {
  switch (platform) {
    case "YouTube":
      return <FontAwesome name="youtube-play" size={size} color="#FF0000" />;
    case "Instagram":
      return <MaterialCommunityIcons name="instagram" size={size} color="#E1306C" />;
    case "Facebook":
      return <FontAwesome name="facebook" size={size} color="#1877F2" />;
    case "X/Twitter":
      return <FontAwesome name="twitter" size={size} color="#1DA1F2" />;
    case "TikTok":
      return <MaterialCommunityIcons name="music-note" size={size} color="#69C9D0" />;
    case "Vimeo":
      return <FontAwesome name="vimeo" size={size} color="#1AB7EA" />;
    default:
      return <Feather name="globe" size={size} color={color} />;
  }
}
