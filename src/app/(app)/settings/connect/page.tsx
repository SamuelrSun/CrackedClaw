import { ConnectClient } from './client';

export const metadata = {
  title: 'Connect Computer — CrackedClaw',
  description: 'Connect your computer to CrackedClaw',
};

export default function ConnectPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Connect Your Computer</h2>
        <p className="text-muted-foreground mt-1">
          Install the CrackedClaw Companion to let your AI agent control your local machine.
        </p>
      </div>
      <ConnectClient />
    </div>
  );
}
