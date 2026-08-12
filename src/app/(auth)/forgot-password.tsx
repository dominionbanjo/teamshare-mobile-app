import { useRouter } from 'expo-router';
import { Sms, TickCircle } from 'iconsax-react-native';
import * as React from 'react';
import { Text, View } from 'react-native';

import {
  TSCard,
  TSForm,
  TSFormFieldError,
  TSFormTextInput,
  TSButton,
  TSScreen,
} from '@/components/shared';
import { forgotPassword } from '@/lib/api/auth';
import { ForgotPasswordSchema } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const onSubmit = async (values: { email: string }) => {
    setError(null);
    setPending(true);
    try {
      await forgotPassword(values.email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <TSScreen contentClassName="justify-center">
        <TSCard title="Check your inbox">
          <View className="items-center gap-3 py-4">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-muted">
              <TickCircle size={28} variant="TwoTone" color={tokens.success} />
            </View>
            <Text className="text-center text-sm text-muted-foreground">
              If an account exists for that email, a reset link is on its way. Check your spam folder too.
            </Text>
            <TSButton variant="outline" onPress={() => router.back()} className="mt-2">
              Back to sign in
            </TSButton>
          </View>
        </TSCard>
      </TSScreen>
    );
  }

  return (
    <TSScreen contentClassName="justify-center">
      <View className="items-center gap-2">
        <Text className="text-3xl font-bold text-foreground">TeamShare</Text>
        <Text className="text-center text-sm text-muted-foreground">Reset your password.</Text>
      </View>

      <TSCard title="Forgot password" description="We'll email you a reset link.">
        <TSForm
          schema={ForgotPasswordSchema}
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
              <TSButton onPress={handleSubmit((values) => void onSubmit(values))} loading={pending}>
                Send reset link
              </TSButton>
              {error && <TSFormFieldError message={error} />}
            </>
          )}
        />
      </TSCard>

      <View className="items-center">
        <TSButton variant="ghost" onPress={() => router.back()}>
          Back to sign in
        </TSButton>
      </View>
    </TSScreen>
  );
}
