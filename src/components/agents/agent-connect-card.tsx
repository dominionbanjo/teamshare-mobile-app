import * as Clipboard from 'expo-clipboard';
import { Code1, Copy, Flash, Play, TickCircle } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import { TSCard } from '@/components/shared';
import {
  buildConnectCommand,
  buildDaemonCommand,
  buildDaemonConfig,
  buildInstallCommand,
  buildMcpSnippet,
  buildRegisterCommand,
  buildRunCommand,
} from '@/components/agents/agent-utils';
import { tokens } from '@/constants/theme';

export interface AgentConnectCardProps {
  agentId: string;
}

type Snippet = { id: string; title: string; code: string };

/** Copy-row with feedback - reused for every snippet in the card. */
function CopyRow({ id, title, code }: Snippet) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <View className="gap-1">
      <Text className="text-xs font-semibold text-foreground">{title}</Text>
      <View className="flex-row items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-2">
        <Text className="flex-1 font-mono text-[11px] leading-4 text-foreground" numberOfLines={3}>
          {code}
        </Text>
        <Pressable
          onPress={() => void copy()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${title}`}
          className="h-9 w-9 items-center justify-center rounded-md active:bg-muted"
        >
          {copied ? (
            <TickCircle size={16} variant="Outline" color={tokens.success} />
          ) : (
            <Copy size={16} variant="Outline" color={tokens.textSecondary} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Connect this agent - three setup methods as static snippets with copy
 * buttons (mirrors the web Launch Console content).
 */
export function AgentConnectCard({ agentId }: AgentConnectCardProps) {
  return (
    <TSCard title="Connect this agent" description="Three ways to wire this agent to your machine - pick one.">
      <View className="gap-4">
        <ConnectMethod
          index="01"
          title="Terminal session"
          icon={<Code1 size={20} variant="TwoTone" color={tokens.primary} />}
          description="One-off sessions from your terminal. The agent runs, reports back, and exits."
        >
          <CopyRow id="install" title="Install the bridge CLI" code={buildInstallCommand()} />
          <CopyRow id="connect" title="Connect this agent" code={buildConnectCommand(agentId)} />
          <CopyRow
            id="run"
            title="Run a task (swap ts_... for the key)"
            code={buildRunCommand(agentId)}
          />
        </ConnectMethod>

        <ConnectMethod
          index="02"
          title="Auto-wake daemon"
          icon={<Flash size={20} variant="TwoTone" color={tokens.warning} />}
          description="A background daemon that keeps this agent awake - it reacts to assignments and mentions the moment they happen."
        >
          <CopyRow id="daemon" title="Start the daemon" code={buildDaemonCommand()} />
          <CopyRow id="daemon-config" title="Saved to ~/.teamshare/config.json" code={buildDaemonConfig(agentId)} />
        </ConnectMethod>

        <ConnectMethod
          index="03"
          title="Run button / deep link"
          icon={<Play size={20} variant="TwoTone" color={tokens.success} />}
          description="A short-lived run token opens a teamshare:// deep link the bridge turns into a session."
        >
          <CopyRow id="register" title="Register the deep link" code={buildRegisterCommand()} />
          <CopyRow id="mcp" title="Wire it into opencode (opencode.json)" code={buildMcpSnippet()} />
        </ConnectMethod>
      </View>
    </TSCard>
  );
}

function ConnectMethod({
  index,
  title,
  icon,
  description,
  children,
}: {
  index: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-lg bg-muted">{icon}</View>
        <View className="flex-1">
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-primary">Method {index}</Text>
          <Text className="text-sm font-semibold text-foreground">{title}</Text>
        </View>
      </View>
      <Text className="text-xs leading-5 text-muted-foreground">{description}</Text>
      <View className="gap-2 border-t border-border pt-2">{children}</View>
    </View>
  );
}
