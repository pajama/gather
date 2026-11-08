import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { draftLineCount, type RecipeDraft } from '@/core/import/draft';
import { readRecipeFile } from '@/core/import/files';
import { parseRecipeText } from '@/core/import/text';
import { extractRecipesFromHtml } from '@/core/import/web';
import { formatDuration } from '@/core/recipe/durations';
import { useDb } from '@/data/react';
import { PageFetchError } from '@/data/services/fetch-page';
import { fetchPage } from '@/data/services/page-fetcher';
import { pickFile } from '@/data/services/pick-file';
import { Button, Card, CONTENT_MAX_WIDTH, Field, Icon, Photo, SegmentedControl, Tap, Text, useTheme } from '@/ui';

type Mode = 'url' | 'text' | 'file';

type ImportResult = { draft: RecipeDraft } | { error: string };

/** Downloads a page and extracts its best recipe. Never throws. */
async function importFromUrl(target: string): Promise<ImportResult> {
  try {
    const page = await fetchPage(target);
    const [best] = extractRecipesFromHtml(page.html, page.url);
    if (!best || draftLineCount(best.ingredients) + draftLineCount(best.steps) === 0) {
      return { error: 'No recipe found on that page. Try copying the recipe text and pasting it instead.' };
    }
    return { draft: best };
  } catch (e) {
    return { error: e instanceof PageFetchError ? e.message : 'Something went wrong reading that page.' };
  }
}

export function ImportScreen() {
  const params = useLocalSearchParams<{ url?: string; mode?: Mode }>();
  const db = useDb();
  const { colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(params.mode === 'text' ? 'text' : params.mode === 'file' ? 'file' : 'url');
  const [batch, setBatch] = useState<{ format: string; drafts: RecipeDraft[]; skipped: string[] } | null>(null);
  const [url, setUrl] = useState(params.url ?? '');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(Boolean(params.url));
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);

  const apply = (result: ImportResult) => {
    setLoading(false);
    if ('draft' in result) setDraft(result.draft);
    else setError(result.error);
  };

  const fetchUrl = (target = url) => {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    void importFromUrl(target).then(apply);
  };

  // Opened from the clipboard banner with a link: start right away.
  useEffect(() => {
    if (!params.url) return;
    let cancelled = false;
    void importFromUrl(params.url).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if ('draft' in result) setDraft(result.draft);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [params.url]);

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
            { value: 'file', label: 'File', icon: 'download' },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setDraft(null);
            setBatch(null);
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
        ) : mode === 'file' ? (
          <View style={{ gap: space.md }}>
            <Button
              title="Choose a file"
              icon="download"
              full
              onPress={async () => {
                setError(null);
                setDraft(null);
                setBatch(null);
                const file = await pickFile();
                if (!file) return;
                try {
                  const result = readRecipeFile(file.name, file.bytes);
                  if (result.drafts.length === 0) setError('No recipes found in that file.');
                  else if (result.drafts.length === 1 && result.skipped.length === 0) setDraft(result.drafts[0]!);
                  else setBatch(result);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Gather couldn’t read that file.');
                }
              }}
            />
            <Text variant="footnote" tone="secondary">
              Crouton recipes (.crumb, or a zip of them), Paprika exports (.paprikarecipes), Gather recipe files, saved web pages and plain text.
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

        {batch ? (
          <Card style={{ gap: space.md }}>
            <Text variant="title3">
              {batch.drafts.length} {batch.drafts.length === 1 ? 'recipe' : 'recipes'} from {batch.format}
            </Text>
            {batch.drafts.slice(0, 8).map((d, i) => (
              <Text key={i} variant="subhead" numberOfLines={1}>
                • {d.name}
              </Text>
            ))}
            {batch.drafts.length > 8 ? (
              <Text variant="footnote" tone="secondary">
                and {batch.drafts.length - 8} more…
              </Text>
            ) : null}
            {batch.skipped.length ? (
              <Text variant="footnote" tone="danger">
                {batch.skipped.length} could not be read.
              </Text>
            ) : null}
            <Button
              title={`Import ${batch.drafts.length} ${batch.drafts.length === 1 ? 'recipe' : 'recipes'}`}
              icon="download"
              onPress={() => {
                for (const d of batch.drafts) db.recipes.createFromDraft(d);
                router.dismissAll?.();
                router.replace('/');
              }}
            />
          </Card>
        ) : null}
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
