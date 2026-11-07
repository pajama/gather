import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { draftLineCount, type RecipeDraft } from '@/core/import/draft';
import { parseRecipeText } from '@/core/import/text';
import { extractRecipesFromHtml } from '@/core/import/web';
import { formatDuration } from '@/core/recipe/durations';
import { useDb } from '@/data/react';
import { PageFetchError } from '@/data/services/fetch-page';
import { fetchRecipePage } from '@/data/services/page-fetcher';
import { Button, Card, CONTENT_MAX_WIDTH, Field, Icon, Photo, SegmentedControl, Tap, Text, useTheme } from '@/ui';

type Mode = 'url' | 'text';

export function ImportScreen() {
  const params = useLocalSearchParams<{ url?: string; mode?: Mode }>();
  const db = useDb();
  const { colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(params.mode === 'text' ? 'text' : 'url');
  const [url, setUrl] = useState(params.url ?? '');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);

  const fetchUrl = async (target = url) => {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const page = await fetchRecipePage(target);
      const [best] = extractRecipesFromHtml(page.html, page.url);
      if (!best || draftLineCount(best.ingredients) + draftLineCount(best.steps) === 0) {
        setError('No recipe found on that page. Try copying the recipe text and pasting it instead.');
      } else setDraft(best);
    } catch (e) {
      setError(e instanceof PageFetchError ? e.message : 'Something went wrong reading that page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.url) void fetchUrl(params.url);
    // Only on first open with a URL from the clipboard banner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (edit: boolean) => {
    if (!draft) return;
    const recipe = db.recipes.createFromDraft(draft);
    router.dismissAll?.();
    router.push(edit ? `/recipe/${recipe.id}/edit` : `/recipe/${recipe.id}`);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.fill, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? insets.top + space.md : space.lg, paddingHorizontal: space.lg, borderBottomColor: colors.separator }]}>
        <Tap onPress={() => router.back()} hitSlop={10}>
          <Text variant="body" tone="accent">
            Cancel
          </Text>
        </Tap>
        <Text variant="headline">Import Recipe</Text>
        <View style={{ width: 52 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.body, { padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + 48 }]} keyboardShouldPersistTaps="handled">
        <SegmentedControl
          options={[
            { value: 'url', label: 'Website', icon: 'globe' },
            { value: 'text', label: 'Text', icon: 'text' },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setDraft(null);
            setError(null);
          }}
        />

        {mode === 'url' ? (
          <View style={{ gap: space.md }}>
            <Field
              value={url}
              onChangeText={setUrl}
              placeholder="https://www.example.com/best-lasagna"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={() => void fetchUrl()}
              autoFocus={!params.url}
            />
            <Button title="Find recipe" icon="search" onPress={() => void fetchUrl()} loading={loading} disabled={!url.trim()} full />
            <Text variant="footnote" tone="secondary">
              Works with most recipe sites. Gather keeps the recipe and leaves the life story behind.
            </Text>
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            <Field
              value={text}
              onChangeText={setText}
              placeholder={'Paste a recipe: the title on the first line, then the ingredients and the method.'}
              multiline
              style={{ minHeight: 220 }}
              autoFocus
            />
            <Button title="Read recipe" icon="sparkles" onPress={() => setDraft(parseRecipeText(text))} disabled={!text.trim()} full />
          </View>
        )}

        {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} /> : null}

        {error ? (
          <Card style={[styles.errorCard, { gap: space.md, backgroundColor: colors.accentSoft }]}>
            <Icon name="alert" tone="accent" />
            <Text variant="subhead" style={styles.flex}>
              {error}
            </Text>
          </Card>
        ) : null}

        {draft ? <DraftPreview draft={draft} onSave={() => save(false)} onEdit={() => save(true)} radius={radius.lg} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DraftPreview({ draft, onSave, onEdit, radius }: { draft: RecipeDraft; onSave: () => void; onEdit: () => void; radius: number }) {
  const { space } = useTheme();
  const ingredientCount = draftLineCount(draft.ingredients);
  const stepCount = draftLineCount(draft.steps);
  const meta = [
    draft.servings ? `Serves ${draft.servings}` : undefined,
    draft.totalSeconds ? formatDuration(draft.totalSeconds) : undefined,
    `${ingredientCount} ingredients`,
    `${stepCount} steps`,
  ].filter(Boolean);
  return (
    <Card padded={false}>
      {draft.imageUrls[0] ? <Photo uri={draft.imageUrls[0]} style={{ height: 200, borderTopLeftRadius: radius, borderTopRightRadius: radius }} /> : null}
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Text variant="title2">{draft.name}</Text>
        {draft.sourceName ? (
          <Text variant="subhead" tone="accent" weight="600">
            {draft.sourceName}
          </Text>
        ) : null}
        <Text variant="subhead" tone="secondary">
          {meta.join(' · ')}
        </Text>
        {draft.ingredients[0]?.lines.slice(0, 4).map((line, i) => (
          <Text key={i} variant="subhead" numberOfLines={1}>
            • {line}
          </Text>
        ))}
        {ingredientCount > 4 ? (
          <Text variant="footnote" tone="secondary">
            and {ingredientCount - 4} more…
          </Text>
        ) : null}
        <View style={[styles.row, { gap: space.sm, marginTop: space.md }]}>
          <Button title="Edit first" variant="tinted" onPress={onEdit} style={styles.flex} />
          <Button title="Save recipe" icon="download" onPress={onSave} style={styles.flex} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  errorCard: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row' },
});
