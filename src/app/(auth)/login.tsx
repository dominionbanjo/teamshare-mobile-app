import { useRouter } from 'expo-router';
import { Lock, Sms } from 'iconsax-react-native';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  TSCard,
  TSForm,
  TSFormFieldError,
  TSFormPasswordInput,
  TSFormTextInput,
  TSButton,
  TSScreen,
} from '@/components/shared';
import { useAuth } from '@/lib/auth/auth-context';
import { SignInSchema } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const onSubmit = async (values: { email: string; password: string }) => {
    setError(null);
    setPending(true);
    try {
      await login(values.email, values.password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setPending(false);
    }
  };

  return (
    <TSScreen contentClassName="justify-center">
      <View className="items-center gap-2">
        <Text className="text-3xl font-bold text-foreground">TeamShare</Text>
        <Text className="text-center text-sm text-muted-foreground">
          Projects, tasks and teams - in one place.
        </Text>
      </View>

      <TSCard title="Sign in" description="Welcome back!">
        <TSForm
          schema={SignInSchema}
          defaultValues={{}}
          onSubmit={(values) => void onSubmit(values)}
          render={({ handleSubmit }) => (
            <>
              <TSFormTextInput
                name="email"
                label="Email"
                placeholder="you@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                leadingIcon={<Sms size={16} variant="Outline" color={tokens.textMuted} />}
                required
              />
              <TSFormPasswordInput
                name="password"
                label="Password"
                placeholder="••••••••"
                leadingIcon={<Lock size={16} variant="Outline" color={tokens.textMuted} />}
                required
              />
              <Pressable onPress={() => router.push('/forgot-password')} className="min-h-11 justify-center">
                <Text className="text-right text-sm font-medium text-[var(--ts-primary-500)]">
                  Forgot password?
                </Text>
              </Pressable>
              <TSButton onPress={handleSubmit((values) => void onSubmit(values))} loading={pending}>
                Sign in
              </TSButton>
              {error && <TSFormFieldError message={error} />}
            </>
          )}
        />
      </TSCard>

      <View className="flex-row items-center justify-center gap-1">
        <Text className="text-sm text-muted-foreground">New to TeamShare?</Text>
        <Pressable onPress={() => router.push('/register')} className="min-h-11 justify-center">
          <Text className="text-sm font-semibold text-[var(--ts-primary-500)]">Create account</Text>
        </Pressable>
      </View>
    </TSScreen>
  );
}
