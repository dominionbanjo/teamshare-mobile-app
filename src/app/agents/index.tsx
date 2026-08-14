import { useLocalSearchParams } from 'expo-router';
import { AddSquare } from 'iconsax-react-native';
import * as React from 'react';
import { RefreshControl } from 'react-native';

import { TSButton, TSPageHeader, TSScreen } from '@/components/shared';
import {
  AgentListSection,
  type AgentListSectionHandle,
} from '@/components/agents/agent-list-section';
import { CreateAgentDialog } from '@/components/agents/create-agent-dialog';
import { tokens } from '@/constants/theme';

export default function AgentsScreen() {
  const { companyId } = useLocalSearchParams<{ companyId?: string }>();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const listRef = React.useRef<AgentListSectionHandle>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await listRef.current?.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <TSScreen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={tokens.primary} />
      }
    >
      <TSPageHeader
        title="Agents"
        description={
          companyId
            ? "Your company's AI crew - statuses, models and last runs at a glance"
            : 'Your personal AI crew - statuses, models and last runs at a glance'
        }
        actions={
          <TSButton
            onPress={() => setCreateOpen(true)}
            icon={<AddSquare size={16} variant="Outline" color="#fff" />}
          >
            New agent
          </TSButton>
        }
      />

      <AgentListSection
        ref={listRef}
        companyId={companyId ?? undefined}
        onCreatePress={() => setCreateOpen(true)}
      />

      <CreateAgentDialog open={createOpen} onOpenChange={setCreateOpen} companyId={companyId} />
    </TSScreen>
  );
}
