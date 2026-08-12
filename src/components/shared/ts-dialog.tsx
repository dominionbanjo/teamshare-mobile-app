import * as React from 'react';
import { Text, View, type ViewProps } from 'react-native';

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
  AlertDialogAction,
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

export type TSDialogProps = ViewProps & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  trigger?: React.ReactNode;
};

/** TeamShare modal - surface panel, radius-lg per style guide 7.7. */
export function TSDialog({ title, description, footer, trigger, className, children, ...props }: TSDialogProps) {
  return (
    <Dialog {...(props as object)}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn('max-w-[420px] rounded-xl', className)}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle className="text-base font-semibold">{title}</DialogTitle>}
            {description && <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
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
  onConfirm: () => void | Promise<void>;
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
  return (
    <AlertDialog>
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
            <Text className="text-sm font-medium text-foreground">{cancelLabel}</Text>
          </AlertDialogCancel>
          <AlertDialogAction asChild onPress={() => void onConfirm()}>
            <Text className="text-sm font-medium text-white">{confirmLabel}</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
