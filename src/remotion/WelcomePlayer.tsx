import { Player } from '@remotion/player';
import { resolveDark } from '../lib/theme';
import { useDocumentStore } from '../stores/documentStore';
import { Welcome } from './compositions/Welcome';

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
      style={{ width: '100%', height: '100%' }}
      controls={false}
      loop
      autoPlay
      acknowledgeRemotionLicense
    />
  );
}
