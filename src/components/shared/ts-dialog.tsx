import * as React from 'react';
import { ScrollView, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Danger } from 'iconsax-react-native';
import { tokens } from '@/constants/theme';
import { TSButton } from './ts-button';

export type TSDialogProps = ViewProps & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  trigger?: React.ReactNode;
  /** Controlled open state (see @rn-primitives/dialog Root). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** TeamShare modal - surface panel, radius-lg per style guide 7.7. */
export function TSDialog({
  title,
  description,
  footer,
  trigger,
  open,
  onOpenChange,
  className,
  children,
  ...props
}: TSDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...(props as object)}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn('max-h-[85%] max-w-[420px] rounded-xl', className)}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle className="text-base font-semibold">{title}</DialogTitle>}
            {description && <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>}
          </DialogHeader>
        )}
        <ScrollView
          className="min-h-0 flex-1"
          contentContainerClassName="gap-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export type TSConfirmDialogProps = {
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<unknown>;
  trigger: React.ReactNode;
};

/** Destructive confirmation - Broken icon variant per style guide. */
export function TSConfirmDialog({
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  trigger,
}: TSConfirmDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // Keep the dialog open so the caller can surface the error (toast).
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-[420px] rounded-xl">
        <AlertDialogHeader>
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: tokens.error100 }}>
              <Danger size={20} variant="Broken" color={tokens.error} />
            </View>
            <View className="flex-1">
              <AlertDialogTitle className="text-base font-semibold">{title}</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground">{description}</AlertDialogDescription>
            </View>
          </View>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <TSButton variant="outline" disabled={pending}>{cancelLabel}</TSButton>
          </AlertDialogCancel>
          <TSButton variant="destructive" loading={pending} onPress={() => void handleConfirm()}>
            {confirmLabel}
          </TSButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
