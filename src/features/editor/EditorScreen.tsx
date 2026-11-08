import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ingredientsToText,
  minutesFieldToSeconds,
  secondsToMinutesField,
  stepsToText,
  textToIngredients,
  textToSteps,
} from '@/core/model/editing';
import { createRecipe, newId } from '@/core/model/recipe';
import type { Difficulty, Recipe } from '@/core/model/types';
import { useDb, useFolders, useRecipe } from '@/data/react';
import { RatingStars } from '@/features/recipe';
import { Button, Chip, CONTENT_MAX_WIDTH, Field, Icon, IconButton, Photo, SegmentedControl, Tap, Text, useTheme } from '@/ui';

export function NewRecipeScreen() {
  const initial = useMemo(() => createRecipe({ name: '' }), []);
  return <Editor initial={initial} isNew />;
}

export function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipe(id);
  if (!recipe) return null;
  return <Editor initial={recipe} isNew={false} />;
}

function Editor({ initial, isNew }: { initial: Recipe; isNew: boolean }) {
  const db = useDb();
  const folders = useFolders();
  const { colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? '');
  const [sourceName, setSourceName] = useState(initial.sourceName ?? '');
  const [sourceUrl, setSourceUrl] = useState(initial.sourceUrl ?? '');
  const [servings, setServings] = useState(initial.servings ? String(initial.servings) : '');
  const [prep, setPrep] = useState(secondsToMinutesField(initial.prepSeconds));
  const [cook, setCook] = useState(secondsToMinutesField(initial.cookSeconds));
  const [ingredients, setIngredients] = useState(ingredientsToText(initial.ingredients));
  const [steps, setSteps] = useState(stepsToText(initial.steps));
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [rating, setRating] = useState<number | undefined>(initial.rating);
  const [difficulty, setDifficulty] = useState<Difficulty | 'none'>(initial.difficulty ?? 'none');
  const [folderIds, setFolderIds] = useState<string[]>(initial.folderIds);
  const [images, setImages] = useState(initial.images);
  const [imageUrl, setImageUrl] = useState('');

  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const servingsNumber = Number(servings.replace(',', '.'));
    const next: Recipe = {
      ...initial,
      name: name.trim(),
      images,
      ingredients: textToIngredients(ingredients, initial.ingredients),
      steps: textToSteps(steps, initial.steps),
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      folderIds,
    };
    const optional: [keyof Recipe, unknown][] = [
      ['description', description.trim() || undefined],
      ['sourceName', sourceName.trim() || undefined],
      ['sourceUrl', sourceUrl.trim() || undefined],
      ['servings', Number.isFinite(servingsNumber) && servingsNumber > 0 ? servingsNumber : undefined],
      ['prepSeconds', minutesFieldToSeconds(prep)],
      ['cookSeconds', minutesFieldToSeconds(cook)],
      ['notes', notes.trim() || undefined],
      ['rating', rating],
      ['difficulty', difficulty === 'none' ? undefined : difficulty],
    ];
    for (const [key, value] of optional) {
      if (value === undefined) delete (next as unknown as Record<string, unknown>)[key];
      else (next as unknown as Record<string, unknown>)[key] = value;
    }
    // The total is derived from prep + cook once they are edited.
    if (prep !== secondsToMinutesField(initial.prepSeconds) || cook !== secondsToMinutesField(initial.cookSeconds)) delete next.totalSeconds;
    const saved = db.recipes.save(next);
    if (isNew) router.replace(`/recipe/${saved.id}`);
    else router.back();
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3], base64: Platform.OS === 'web' });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    // On the web the picked file is a short-lived blob URL; keep a data URL instead.
    const uri = Platform.OS === 'web' && asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
    setImages([{ id: newId(), uri, width: asset.width, height: asset.height }, ...images]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={[styles.fill, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? insets.top + space.md : space.lg, paddingHorizontal: space.lg, borderBottomColor: colors.separator }]}>
        <Tap onPress={() => router.back()} hitSlop={10}>
          <Text variant="body" tone="accent">
            Cancel
          </Text>
        </Tap>
        <Text variant="headline">{isNew ? 'New Recipe' : 'Edit Recipe'}</Text>
        <Tap onPress={save} disabled={!canSave} hitSlop={10}>
          <Text variant="body" tone="accent" weight="700" style={{ opacity: canSave ? 1 : 0.4 }}>
            Save
          </Text>
        </Tap>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + 48 }]} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.sm }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <Tap onPress={pickImage} style={[styles.addPhoto, { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.separator }]} accessibilityLabel="Add photo">
              <Icon name="camera" size={26} tone="accent" />
              <Text variant="footnote" tone="accent" weight="600">
                Add photo
              </Text>
            </Tap>
            {images.map((image, index) => (
              <View key={image.id}>
                <Photo uri={image.uri} style={[styles.thumb, { borderRadius: radius.lg }]} />
                <IconButton
                  icon="close"
                  variant="glass"
                  size={26}
                  style={styles.removePhoto}
                  onPress={() => setImages(images.filter((i) => i.id !== image.id))}
                  accessibilityLabel="Remove photo"
                />
                {index === 0 ? (
                  <View style={[styles.coverBadge, { backgroundColor: colors.accent, borderRadius: radius.pill }]}>
                    <Text variant="caption" color={colors.onAccent}>
                      Cover
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
          <View style={[styles.row, { gap: space.sm }]}>
            <Field value={imageUrl} onChangeText={setImageUrl} placeholder="…or paste an image link" style={styles.flex} autoCapitalize="none" keyboardType="url" />
            <Button
              title="Add"
              variant="tinted"
              disabled={!/^https?:\/\//.test(imageUrl.trim())}
              onPress={() => {
                setImages([...images, { id: newId(), uri: imageUrl.trim() }]);
                setImageUrl('');
              }}
            />
          </View>
        </View>

        <Field label="Name" value={name} onChangeText={setName} placeholder="Grandma's apple pie" autoFocus={isNew} />
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="A short note about this recipe" multiline />
        <View style={[styles.row, { gap: space.md }]}>
          <Field label="Serves" value={servings} onChangeText={setServings} placeholder="4" keyboardType="numeric" style={styles.flex} />
          <Field label="Prep (min)" value={prep} onChangeText={setPrep} placeholder="15" keyboardType="numeric" style={styles.flex} />
          <Field label="Cook (min)" value={cook} onChangeText={setCook} placeholder="30" keyboardType="numeric" style={styles.flex} />
        </View>

        <View style={{ gap: space.xs }}>
          <Field label="Ingredients" value={ingredients} onChangeText={setIngredients} placeholder={'2 cups flour\n1 tsp salt\n\nFor the glaze:\n1 cup icing sugar'} multiline minInputHeight={200} />
          <Text variant="footnote" tone="secondary">
            One per line. End a line with a colon to start a section.
          </Text>
        </View>
        <View style={{ gap: space.xs }}>
          <Field label="Method" value={steps} onChangeText={setSteps} placeholder={'Heat the oven to 350°F.\nMix the dry ingredients.\nBake for 25 minutes.'} multiline minInputHeight={240} />
          <Text variant="footnote" tone="secondary">
            One step per line. Times like “25 minutes” become timers.
          </Text>
        </View>
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Tips, substitutions, what you'd change next time" multiline minInputHeight={120} />

        <View style={[styles.row, { gap: space.md }]}>
          <Field label="Source" value={sourceName} onChangeText={setSourceName} placeholder="Website or cookbook" style={styles.flex} />
          <Field label="Link" value={sourceUrl} onChangeText={setSourceUrl} placeholder="https://" autoCapitalize="none" keyboardType="url" style={styles.flex} />
        </View>
        <Field label="Tags" value={tags} onChangeText={setTags} placeholder="Dinner, Vegetarian, Quick" />

        <View style={[styles.row, { gap: space.lg, alignItems: 'flex-end' }]}>
          <View style={{ gap: space.sm }}>
            <Text variant="footnote" tone="secondary" weight="600">
              Rating
            </Text>
            <View style={{ height: 36, justifyContent: 'center' }}>
              <RatingStars value={rating} onChange={setRating} size={26} />
            </View>
          </View>
          <View style={[styles.flex, { gap: space.sm }]}>
            <Text variant="footnote" tone="secondary" weight="600">
              Difficulty
            </Text>
            <SegmentedControl
              options={[
                { value: 'none', label: '—' },
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' },
              ]}
              value={difficulty}
              onChange={(v) => setDifficulty(v as Difficulty | 'none')}
            />
          </View>
        </View>

        {folders.length ? (
          <View style={{ gap: space.sm }}>
            <Text variant="footnote" tone="secondary" weight="600">
              Folders
            </Text>
            <View style={[styles.wrap, { gap: space.sm }]}>
              {folders.map((f) => {
                const selected = folderIds.includes(f.id);
                return (
                  <Chip
                    key={f.id}
                    label={f.name}
                    icon="folder"
                    selected={selected}
                    onPress={() => setFolderIds(selected ? folderIds.filter((x) => x !== f.id) : [...folderIds, f.id])}
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        <Button title={isNew ? 'Save recipe' : 'Save changes'} onPress={save} disabled={!canSave} size="lg" full />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  addPhoto: { width: 120, height: 90, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderStyle: 'dashed' },
  thumb: { width: 120, height: 90 },
  removePhoto: { position: 'absolute', top: 6, right: 6 },
  coverBadge: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 8, paddingVertical: 2 },
});
