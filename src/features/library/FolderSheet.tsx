import { useState } from 'react';
import { View } from 'react-native';

import type { Folder } from '@/core/model/types';
import { useDb } from '@/data/react';
import { Button, Chip, Field, SegmentedControl, Sheet, Text, useTheme } from '@/ui';

/**
 * Create or edit a folder. Picking tags makes it a smart folder: recipes with
 * those tags show up in it alongside the ones added by hand.
 */
export function FolderSheet({
  folder,
  visible,
  allTags,
  onClose,
  onCreated,
}: {
  folder?: Folder;
  visible: boolean;
  allTags: string[];
  onClose: () => void;
  onCreated?: (folder: Folder) => void;
}) {
  const db = useDb();
  const { space } = useTheme();
  const [name, setName] = useState(folder?.name ?? '');
  const [tags, setTags] = useState<string[]>(folder?.tags ?? []);
  const [match, setMatch] = useState<'any' | 'all'>(folder?.tagMatch ?? 'any');
  const [editingId, setEditingId] = useState(folder?.id);
  if (folder?.id !== editingId) {
    setEditingId(folder?.id);
    setName(folder?.name ?? '');
    setTags(folder?.tags ?? []);
    setMatch(folder?.tagMatch ?? 'any');
  }

  const toggle = (tag: string) => {
    const has = tags.some((t) => t.toLowerCase() === tag.toLowerCase());
    setTags(has ? tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...tags, tag]);
  };

  const save = () => {
    if (!name.trim()) return;
    const rule = tags.length ? { tags, tagMatch: match } : { tags: [], tagMatch: undefined };
    if (folder) {
      db.folders.update(folder.id, { name: name.trim(), ...rule });
      onClose();
    } else {
      const created = db.folders.create(name, tags.length ? { tags, tagMatch: match } : {});
      setName('');
      setTags([]);
      onClose();
      onCreated?.(created);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={folder ? 'Edit folder' : 'New folder'}>
      <View style={{ gap: space.lg }}>
        <Field
          value={name}
          onChangeText={setName}
          placeholder="Folder name"
          autoFocus={!folder}
          returnKeyType="done"
          onSubmitEditing={save}
        />
        {allTags.length ? (
          <View style={{ gap: space.sm }}>
            <Text variant="headline">Collect recipes tagged</Text>
            <Text variant="footnote" tone="secondary">
              Recipes with these tags appear here automatically, next to the ones you add yourself.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {allTags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  icon="pricetag"
                  selected={tags.some((t) => t.toLowerCase() === tag.toLowerCase())}
                  onPress={() => toggle(tag)}
                />
              ))}
            </View>
            {tags.length > 1 ? (
              <SegmentedControl
                options={[
                  { value: 'any', label: 'Any of these tags' },
                  { value: 'all', label: 'All of them' },
                ]}
                value={match}
                onChange={(v) => setMatch(v as 'any' | 'all')}
              />
            ) : null}
          </View>
        ) : null}
        <Button title={folder ? 'Save' : 'Create folder'} onPress={save} disabled={!name.trim()} full />
      </View>
    </Sheet>
  );
}
