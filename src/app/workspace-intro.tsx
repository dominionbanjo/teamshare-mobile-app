import { useRouter } from 'expo-router';
import { Building4, Personalcard } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  TSButton,
  TSCard,
  TSForm,
  TSFormFieldError,
  TSFormTextInput,
  TSScreen,
  TSSkeleton,
} from '@/components/shared';
import { useAuth } from '@/lib/auth/auth-context';
import { createCompany } from '@/lib/api/companies';
import { listCompanies } from '@/lib/api/companies';
import { listProjects } from '@/lib/api/projects';
import { loadOnboarded, setOnboarded } from '@/lib/api/session';
import { CreateCompanySchema } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';
import { cn } from '@/lib/utils';

type WorkspaceChoice = 'personal' | 'company' | null;

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Onboarding: asks whether the user signs up as an individual (Personal
 * workspace) or as a company (org workspace). Shown once after account
 * creation (or first Google login) when the user has no workspaces yet.
 */
export default function WorkspaceIntroScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [choice, setChoice] = React.useState<WorkspaceChoice>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (await loadOnboarded()) {
          if (!cancelled) router.replace('/');
          return;
        }
        const [companies, projects] = await Promise.all([
          listCompanies(token ?? '').catch(() => ({ items: [] })),
          listProjects(token ?? '').catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        if (companies.items.length > 0 || projects.items.length > 0) {
          await setOnboarded();
          router.replace('/');
          return;
        }
        setChecking(false);
      } catch {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const finish = async () => {
    await setOnboarded();
    router.replace('/');
  };

  const onPersonal = async () => {
    setError(null);
    setPending(true);
    try {
      await finish();
    } finally {
      setPending(false);
    }
  };

  const onCompany = async (values: { name: string; slug: string }) => {
    setError(null);
    setPending(true);
    try {
      await createCompany(token ?? '', values);
      await finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the company.');
      setPending(false);
    }
  };

  if (checking) {
    return (
      <TSScreen contentClassName="justify-center">
        <View className="items-center gap-3">
          <TSSkeleton className="h-6 w-56" />
          <TSSkeleton className="h-4 w-72" />
          <TSSkeleton className="h-32 w-full rounded-xl" />
        </View>
      </TSScreen>
    );
  }

  return (
    <TSScreen contentClassName="justify-center">
      <View className="items-center gap-2">
        <Text className="text-3xl font-bold text-foreground">TeamShare</Text>
        <Text className="text-center text-sm text-muted-foreground">
          How will you use TeamShare? This shapes your workspace.
        </Text>
      </View>

      <View className="gap-3">
        <Pressable
          onPress={() => setChoice('personal')}
          className={cn(
            'rounded-2xl border-2 p-4',
            choice === 'personal' ? 'border-[var(--ts-primary-500)] bg-[var(--ts-primary-100)]/40' : 'border-border bg-surface'
          )}
        >
          <View className="flex-row items-start gap-3">
            <Personalcard size={24} variant="TwoTone" color={tokens.primary} />
            <View className="flex-1 gap-1">
              <Text className="text-base font-semibold text-foreground">Personal workspace</Text>
              <Text className="text-xs text-muted-foreground">
                Just you. Individual projects, tasks and documents - free, no billing.
              </Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setChoice('company')}
          className={cn(
            'rounded-2xl border-2 p-4',
            choice === 'company' ? 'border-[var(--ts-primary-500)] bg-[var(--ts-primary-100)]/40' : 'border-border bg-surface'
          )}
        >
          <View className="flex-row items-start gap-3">
            <Building4 size={24} variant="TwoTone" color={tokens.primary} />
            <View className="flex-1 gap-1">
              <Text className="text-base font-semibold text-foreground">Company workspace</Text>
              <Text className="text-xs text-muted-foreground">
                A team: members with roles, teams, shared projects, documents, env secrets and billing.
              </Text>
            </View>
          </View>
        </Pressable>
      </View>

      {choice === 'personal' && (
        <TSCard title="Personal workspace">
          <Text className="text-sm text-muted-foreground">
            You can create or join a company later from Settings - this just gets you started faster.
          </Text>
          <TSButton onPress={() => void onPersonal()} loading={pending} className="mt-4">
            Continue with Personal
          </TSButton>
        </TSCard>
      )}

      {choice === 'company' && (
        <TSCard title="Create your company">
          <TSForm
            schema={CreateCompanySchema}
            defaultValues={{}}
            onSubmit={(values) => void onCompany(values)}
            render={({ handleSubmit, watch }) => {
              const preview = slugify(watch('name') ?? '');
              return (
                <View className="gap-3">
                  <TSFormTextInput
                    name="name"
                    label="Company name"
                    placeholder="Acme Inc."
                    required
                  />
                  <TSFormTextInput
                    name="slug"
                    label="Slug"
                    placeholder="acme"
                    autoCapitalize="none"
                    autoCorrect={false}
                    required
                  />
                  {preview ? (
                    <Text className="text-xs text-muted-foreground">
                      URL preview: teamshare.app/{preview}
                    </Text>
                  ) : null}
                  <TSButton onPress={handleSubmit((values) => void onCompany(values))} loading={pending}>
                    Create company
                  </TSButton>
                  {error && <TSFormFieldError message={error} />}
                </View>
              );
            }}
          />
        </TSCard>
      )}

      {choice === null && (
        <TSButton variant="ghost" onPress={() => void onPersonal()} loading={pending}>
          Skip for now - start with Personal
        </TSButton>
      )}
    </TSScreen>
  );
}
