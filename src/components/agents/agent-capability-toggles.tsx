import * as React from 'react';
import { Text, View } from 'react-native';

import { TSSwitch } from '@/components/shared';
import { AGENT_CAPABILITY_GROUPS, type AgentCapabilityValue } from '@/constants/enums';
import { capabilityDescription, capabilityLabel } from './agent-utils';

export interface AgentCapabilityTogglesProps {
  value: AgentCapabilityValue[];
  onChange: (next: AgentCapabilityValue[]) => void;
  disabled?: boolean;
}

/**
 * Capability picker grouped by Read / Work / Communicate (Agent Hub
 * contract section 1). Reused by the create dialog and the detail editor.
 */
export function AgentCapabilityToggles({ value, onChange, disabled = false }: AgentCapabilityTogglesProps) {
  const toggle = (capability: AgentCapabilityValue) => {
    const next = value.includes(capability)
      ? value.filter((c) => c !== capability)
      : [...value, capability];
    onChange(next);
  };

  return (
    <View className="gap-4">
      {Object.entries(AGENT_CAPABILITY_GROUPS).map(([key, group]) => (
        <View key={key} className="gap-2">
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </Text>
          <View className="gap-2.5">
            {group.capabilities.map((capability) => {
              const checked = value.includes(capability);
              return (
                <View key={capability} className="flex-row items-center gap-3">
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-medium text-foreground">{capabilityLabel(capability)}</Text>
                    <Text className="text-xs text-muted-foreground">{capabilityDescription(capability)}</Text>
                  </View>
                  <TSSwitch
                    checked={checked}
                    disabled={disabled}
                    onValueChange={() => toggle(capability)}
                    accessibilityLabel={`${capabilityLabel(capability)} toggle`}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
