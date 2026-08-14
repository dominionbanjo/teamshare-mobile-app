import { useRouter } from 'expo-router';
import { Google, Lock, Personalcard, Sms } from 'iconsax-react-native';
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
import { signInWithGoogle } from '@/lib/auth/google-signin';
import { SignUpSchema } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

export default function RegisterScreen() {
  const { register, completeGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [googlePending, setGooglePending] = React.useState(false);

  const onSubmit = async (values: { name: string; email: string; password: string }) => {
    setError(null);
    setPending(true);
    try {
      await register(values.name, values.email, values.password);
      router.replace('/workspace-intro');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setPending(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setGooglePending(true);
    try {
      const outcome = await signInWithGoogle();
      if (outcome !== 'cancelled') {
        await completeGoogle(outcome.code);
        router.replace('/workspace-intro');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setGooglePending(false);
    }
  };

  return (
    <TSScreen contentClassName="justify-center">
      <View className="items-center gap-2">
        <Text className="text-3xl font-bold text-foreground">TeamShare</Text>
        <Text className="text-center text-sm text-muted-foreground">
          Create your account to get started.
        </Text>
      </View>

      <TSCard title="Create account">
        <TSForm
          schema={SignUpSchema}
          defaultValues={{}}
          onSubmit={(values) => void onSubmit(values)}
          render={({ handleSubmit }) => (
            <>
              <TSFormTextInput
                name="name"
                label="Full name"
                placeholder="Ada Lovelace"
                leadingIcon={<Personalcard size={16} variant="Outline" color={tokens.textMuted} />}
                required
              />
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
                placeholder="At least 8 characters"
                leadingIcon={<Lock size={16} variant="Outline" color={tokens.textMuted} />}
                required
              />
              <TSButton onPress={handleSubmit((values) => void onSubmit(values))} loading={pending}>
                Create account
              </TSButton>
              {error && <TSFormFieldError message={error} />}
            </>
          )}
        />
      </TSCard>

      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs text-muted-foreground">or continue with</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <TSButton
        variant="secondary"
        icon={<Google size={18} variant="Outline" color={tokens.textSecondary} />}
        onPress={() => void onGoogle()}
        loading={googlePending}
        textClassName="text-foreground"
      >
        Continue with Google
      </TSButton>

      <View className="flex-row items-center justify-center gap-1">
        <Text className="text-sm text-muted-foreground">Already have an account?</Text>
        <Pressable onPress={() => router.back()} className="min-h-11 justify-center">
          <Text className="text-sm font-semibold text-[var(--ts-primary-500)]">Sign in</Text>
        </Pressable>
      </View>
    </TSScreen>
  );
}
