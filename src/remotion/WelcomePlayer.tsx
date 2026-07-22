import { Player } from "@remotion/player";
import { Welcome } from "./compositions/Welcome";
import { resolveDark } from "../lib/theme";
import { useDocumentStore } from "../stores/documentStore";

export function WelcomePlayer() {
  const theme = useDocumentStore((s) => s.theme);
  const dark = resolveDark(theme);

  return (
    <Player
      component={Welcome}
      inputProps={{ dark }}
      durationInFrames={90}
      compositionWidth={560}
      compositionHeight={320}
      fps={30}
      style={{ width: "100%", height: "100%" }}
      controls={false}
      loop
      autoPlay
      acknowledgeRemotionLicense
    />
  );
}
