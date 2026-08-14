import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { AddSquare, DocumentText, DocumentUpload, Link21, Trash } from 'iconsax-react-native';
import * as React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import {
  TSAvatar,
  TSButton,
  TSConfirmDialog,
  TSDialog,
  TSEmptyState,
  TSErrorState,
  TSForm,
  TSFormFieldError,
  TSFormTextInput,
  TSSkeletonList,
} from '@/components/shared';
import { API_BASE_URL } from '@/lib/api/client';
import { createDocumentLink, deleteDocument, listDocuments, uploadDocumentFile } from '@/lib/api/documents';
import type { DocumentItem } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { formatRelative } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { DocumentLinkFormSchema, type DocumentLinkFormInput } from '@/lib/validation/schemas';
import { tokens } from '@/constants/theme';

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export type DocumentsTabProps = {
  projectId: string;
};

/** Project documents - shared links + uploaded files. */
export function DocumentsTab({ projectId }: DocumentsTabProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);

  const documents = useQuery({
    queryKey: queryKeys.projectDocuments(projectId),
    queryFn: () => listDocuments(token ?? '', projectId),
    enabled: !!token && !!projectId,
  });

  const addLink = useMutation({
    mutationFn: (values: DocumentLinkFormInput) =>
      createDocumentLink(token ?? '', { projectId, name: values.name, type: 'link', url: values.url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectDocuments(projectId) });
      setAddOpen(false);
    },
  });

  const upload = useMutation({
    mutationFn: (formData: FormData) => uploadDocumentFile(token ?? '', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectDocuments(projectId) });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDocument(token ?? '', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectDocuments(projectId) });
    },
  });

  const pickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('name', asset.name);
      formData.append('type', 'file');
      formData.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
      upload.mutate(formData);
    } catch (err) {
      console.warn('Document picker failed:', err);
    }
  };

  const openDocument = (doc: DocumentItem) => {
    if (doc.type === 'link') {
      void Linking.openURL(doc.urlOrKey);
    } else {
      void Linking.openURL(`${API_ORIGIN}${doc.urlOrKey.startsWith('/') ? '' : '/'}${doc.urlOrKey}`);
    }
  };

  const addLinkDialog = (
    <TSDialog
      open={addOpen}
      onOpenChange={setAddOpen}
      title="Add link"
      description="Share a useful URL with the project."
      trigger={
        <TSButton
          variant="outline"
          icon={<Link21 size={16} variant="Outline" color={tokens.textSecondary} />}
        >
          Add link
        </TSButton>
      }
    >
      <TSForm
        schema={DocumentLinkFormSchema}
        defaultValues={{}}
        onSubmit={(values) => addLink.mutate(values)}
        render={({ handleSubmit }) => (
          <>
            <TSFormTextInput name="name" label="Name" placeholder="e.g. Design spec" required maxLength={120} />
            <TSFormTextInput
              name="url"
              label="URL"
              placeholder="https://..."
              required
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              maxLength={2_048}
            />
            <TSButton onPress={handleSubmit((values) => addLink.mutate(values))} loading={addLink.isPending}>
              Add link
            </TSButton>
            {addLink.isError && <TSFormFieldError message={addLink.error?.message ?? 'Could not add link.'} />}
          </>
        )}
      />
    </TSDialog>
  );

  const mutationError = upload.isError ? upload.error?.message : remove.isError ? remove.error?.message : null;

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        {addLinkDialog}
        <TSButton
          variant="outline"
          icon={<DocumentUpload size={16} variant="Outline" color={tokens.textSecondary} />}
          onPress={() => void pickAndUpload()}
          loading={upload.isPending}
        >
          Upload
        </TSButton>
      </View>

      {mutationError && <TSFormFieldError message={mutationError} />}

      {documents.isLoading ? (
        <TSSkeletonList rows={4} />
      ) : documents.isError ? (
        <TSErrorState message={documents.error.message} onRetry={() => void documents.refetch()} />
      ) : documents.data && documents.data.items.length > 0 ? (
        <View className="overflow-hidden rounded-lg border border-border bg-background">
          {documents.data.items.map((doc, index) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              last={index === (documents.data?.items.length ?? 0) - 1}
              onOpen={() => openDocument(doc)}
              onDelete={() => remove.mutateAsync(doc.id)}
            />
          ))}
        </View>
      ) : (
        <TSEmptyState
          icon={<DocumentText size={28} variant="TwoTone" color={tokens.primary} />}
          title="No documents yet"
          description="Share links or upload files for the team."
        />
      )}
    </View>
  );
}

function DocumentRow({
  doc,
  last,
  onOpen,
  onDelete,
}: {
  doc: DocumentItem;
  last: boolean;
  onOpen: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const typeIcon =
    doc.type === 'link' ? (
      <Link21 size={20} variant="TwoTone" color={tokens.info} />
    ) : (
      <DocumentText size={20} variant="TwoTone" color={tokens.primary} />
    );

  return (
    <View
      className="min-h-12 flex-row items-center gap-3 border-b border-border px-4 py-3"
      style={last ? { borderBottomWidth: 0 } : undefined}
    >
      <View className="h-9 w-9 items-center justify-center rounded-md bg-muted">{typeIcon}</View>
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {doc.name}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <TSAvatar name={doc.uploader?.name ?? 'Unknown'} src={doc.uploader?.avatarUrl} size={20} />
          <Text className="text-xs text-muted-foreground">
            {doc.uploader?.name ?? 'Unknown'} · {formatRelative(doc.createdAt)}
          </Text>
        </View>
      </View>
      <TSButton variant="outline" tsSize="sm" onPress={onOpen}>
        Open
      </TSButton>
      <TSConfirmDialog
        title="Delete document?"
        description={`"${doc.name}" will be permanently removed.`}
        onConfirm={onDelete}
        trigger={
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${doc.name}`}
            className="h-11 w-11 items-center justify-center rounded-md"
          >
            <Trash size={20} variant="Outline" color={tokens.error} />
          </Pressable>
        }
      />
    </View>
  );
}
