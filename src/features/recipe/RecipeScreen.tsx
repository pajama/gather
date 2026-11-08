import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Animated, Platform, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { recipeToHtml } from '@/core/export/print';
import { crumbFromDraft } from '@/core/import/crumb';
import { toGatherFile } from '@/core/import/files';
import { coverImage, newId, recipeToDraft, recipeToText, totalSeconds } from '@/core/model/recipe';
import type { Recipe, UnitPreference } from '@/core/model/types';
import { formatDuration } from '@/core/recipe/durations';
import { formatNumber } from '@/core/recipe/quantity';
import { useDb, useFolders, useRecipe, useSettings } from '@/data/react';
import { shareTextFile } from '@/data/services/pick-file';
import { inlineRecipePhotos } from '@/data/services/photo-files';
import { photoDataUrl } from '@/data/services/photos';
import { printHtml, shareHtmlAsPdf } from '@/data/services/print-recipe';
import { TimerSheet, useTimerActions } from '@/features/timers';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  haptic,
  Icon,
  IconButton,
  ListRow,
  ListSection,
  Photo,
  SegmentedControl,
  Sheet,
  Stepper,
  Tap,
  Text,
  useTheme,
} from '@/ui';

import { RatingStars } from './RatingStars';
import { AddToGroceriesSheet, AddToPlanSheet } from './RecipeSheets';
import { IngredientCallout, IngredientLine, StepText, useIngredientViews, type IngredientView } from './RecipeText';

const DETAIL_MAX_WIDTH = 680;

export function RecipeScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const recipe = useRecipe(id);
  const { colors } = useTheme();
  if (!recipe) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <EmptyState
          icon="book"
          title="Recipe not found"
          message="It may have been deleted."
          action={<Button title="Back to recipes" onPress={() => router.replace('/')} />}
        />
      </View>
    );
  }
  return <RecipeDetail recipe={recipe} backLabel={from ?? 'Recipes'} />;
}

/**
 * The recipe page. `embedded` renders it as the detail pane of the wide-screen
 * library (no back button, sized to its container rather than the window).
 */
export function RecipeDetail({ recipe, embedded = false, backLabel = 'Recipes' }: { recipe: Recipe; embedded?: boolean; backLabel?: string }) {
  const db = useDb();
  const settings = useSettings();
  const folders = useFolders();
  const timers = useTimerActions();
  const { colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [scrollY] = useState(() => new Animated.Value(0));
  const windowSize = useWindowDimensions();
  const [paneWidth, setPaneWidth] = useState(windowSize.width);
  const width = embedded ? paneWidth : windowSize.width;
  const baseServings = recipe.servings ?? 0;
  const [servings, setServings] = useState(baseServings || 1);
  const [multiplier, setMultiplier] = useState(1);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [units, setUnits] = useState<UnitPreference>(settings.units);
  const [sheet, setSheet] = useState<'plan' | 'groceries' | 'more' | 'share' | 'folders' | 'scale' | 'units' | 'timers' | null>(null);
  // One bubble at a time inside a step card: an ingredient's amount, or Crouton's "Start Timer" prompt.
  const [callout, setCallout] = useState<
    { stepId: string; kind: 'ingredient'; view: IngredientView } | { stepId: string; kind: 'timer'; seconds: number; label: string } | null
  >(null);
  const scale = baseServings ? servings / baseServings : multiplier;
  const views = useIngredientViews(recipe, scale, units);
  const total = totalSeconds(recipe);
  const gutter = width >= 720 ? 24 : 16;
  const columnWidth = Math.min(width, DETAIL_MAX_WIDTH);
  const heroHeight = Math.round(Math.min((columnWidth - gutter * 2) * 0.56, 320));
  const navHeight = insets.top + 50;

  useEffect(() => {
    if (!settings.keepAwake || Platform.OS === 'web') return;
    void activateKeepAwakeAsync('recipe');
    return () => {
      void deactivateKeepAwake('recipe');
    };
  }, [settings.keepAwake]);

  useEffect(() => {
    if (!callout) return;
    const handle = setTimeout(() => setCallout(null), callout.kind === 'timer' ? 5000 : 2600);
    return () => clearTimeout(handle);
  }, [callout]);

  const stepNumbers = useMemo(() => {
    const numbers = new Map<string, number>();
    let n = 0;
    for (const section of recipe.steps) for (const step of section.items) numbers.set(step.id, ++n);
    return numbers;
  }, [recipe.steps]);

  const startTimer = (seconds: number, label: string) => {
    timers.start(label, seconds, recipe.id);
  };

  const share = async () => {
    const text = recipeToText(recipe);
    try {
      await Share.share(Platform.OS === 'web' ? { message: text, title: recipe.name } : { message: text });
    } catch {
      // Share sheets can be dismissed or unavailable on some browsers.
    }
  };

  const printable = async () => {
    // Stored photos are files; the print view gets them embedded.
    const stored = coverImage(recipe);
    const cover = stored ? await photoDataUrl(stored) : undefined;
    return recipeToHtml(recipe, {
      scale,
      units,
      accentColor: colors.accent,
      ...(cover && /^(https?:|data:)/.test(cover) ? { imageUrl: cover } : {}),
    });
  };

  const remove = () => {
    const doDelete = () => {
      db.recipes.delete(recipe.id);
      if (!embedded) router.back();
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`Delete “${recipe.name}”? This can’t be undone.`) ?? true) doDelete();
      return;
    }
    Alert.alert('Delete recipe?', `“${recipe.name}” will be removed from your library, plan and groceries.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const recipeFolders = folders.filter((f) => recipe.folderIds.includes(f.id));
  const times: { label: string; value: string }[] = [];
  if (recipe.prepSeconds) times.push({ label: 'Prep', value: formatDuration(recipe.prepSeconds) });
  if (recipe.cookSeconds) times.push({ label: 'Cook', value: formatDuration(recipe.cookSeconds) });
  if (!times.length && total) times.push({ label: 'Total', value: formatDuration(total) });
  const scaleLabel = scale === 1 ? 'Scale' : baseServings ? `Serves ${servings}` : `${formatNumber(multiplier)}×`;

  return (
    <View
      style={[styles.fill, { backgroundColor: colors.background }]}
      onLayout={embedded ? (e) => setPaneWidth(Math.round(e.nativeEvent.layout.width)) : undefined}
    >
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: navHeight + space.xs, paddingBottom: insets.bottom + 48 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== 'web' })}
      >
        <View style={{ width: columnWidth, alignSelf: 'center', paddingHorizontal: gutter, gap: space.lg }}>
          {/* Hero: the photo as a rounded card with the title on it. */}
          <View style={[styles.hero, { height: heroHeight, borderRadius: radius.xl, boxShadow: `0 8px 24px ${colors.shadow}` }]}>
            <Photo uri={coverImage(recipe)} style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]} fallbackIcon="restaurant" />
            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.12)', 'transparent']}
              locations={[0, 0.45, 0.8]}
              style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]}
            />
            <Text variant="title1" tone="onImage" numberOfLines={3} style={[styles.heroTitle, { padding: space.lg }]} accessibilityRole="header">
              {recipe.name}
            </Text>
            {recipe.favorite ? (
              <View style={[styles.heroFavorite, { right: space.md, bottom: space.md }]}>
                <Icon name="heart" size={16} color="#FFFFFF" />
              </View>
            ) : null}
          </View>

          {/* Actions: Start (green), groceries (yellow), share (purple). */}
          <View style={[styles.actions, { gap: space.md }]}>
            <Button title="Start" icon="play" variant="green" size="lg" onPress={() => router.push(`/recipe/${recipe.id}/cook`)} style={styles.startButton} />
            <View style={styles.flex} />
            <IconButton icon="basket" variant="tinted" tint="yellow" size={56} onPress={() => setSheet('groceries')} accessibilityLabel="Add to groceries" />
            <IconButton icon="send" variant="tinted" tint="purple" size={56} onPress={() => setSheet('share')} accessibilityLabel="Share recipe" />
          </View>

          {/* Servings and times. */}
          {baseServings || times.length ? (
            <View style={[styles.infoRow, { gap: space.md }]}>
              {baseServings ? (
                <Tap onPress={() => setSheet('scale')} style={[styles.servingsTile, { backgroundColor: colors.surface, borderRadius: radius.xl }]} accessibilityLabel={`Serves ${servings}`}>
                  <Icon name="people" size={22} tone="secondary" />
                  <Text variant="title3" weight="600">
                    {formatNumber(servings)}
                  </Text>
                </Tap>
              ) : null}
              {times.length ? (
                <View style={[styles.timeTile, { backgroundColor: colors.surface, borderRadius: radius.xl }]}>
                  {times.map((t) => (
                    <View key={t.label} style={styles.timeCell}>
                      <Icon name="time" size={20} tone="secondary" />
                      <Text variant="headline" weight="600" numberOfLines={1}>
                        {t.label} {t.value}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.ratingRow, { gap: space.md }]}>
            <RatingStars value={recipe.rating} onChange={(rating) => db.recipes.setRating(recipe.id, rating)} />
            {recipe.difficulty ? (
              <View style={[styles.difficulty, { backgroundColor: colors.fill, borderRadius: radius.pill }]}>
                <Icon name="flame" size={14} tone="secondary" />
                <Text variant="footnote" tone="secondary" weight="600">
                  {DIFFICULTY_LABELS[recipe.difficulty]}
                </Text>
              </View>
            ) : null}
          </View>

          {recipe.description ? (
            <Text variant="body" tone="secondary">
              {recipe.description}
            </Text>
          ) : null}

          {/* Ingredients */}
          <View style={{ gap: space.sm }}>
            <View style={styles.sectionHeader}>
              <Text variant="title3" weight="600" style={styles.flex}>
                Ingredients
              </Text>
              <Button title={scaleLabel} variant="tinted" size="sm" onPress={() => setSheet('scale')} />
              <IconButton icon="sliders" variant="tinted" size={32} onPress={() => setSheet('units')} accessibilityLabel="Ingredient display options" style={styles.slidersButton} />
            </View>
            <Card style={{ paddingVertical: space.md, borderRadius: radius.xl }}>
              {recipe.ingredients.length === 0 ? (
                <Text variant="subhead" tone="secondary">
                  No ingredients yet.
                </Text>
              ) : null}
              {recipe.ingredients.map((section, i) => (
                <View key={section.id} style={i > 0 ? { marginTop: space.md } : null}>
                  {section.title ? (
                    <Text variant="headline" style={{ marginBottom: space.xs }}>
                      {section.title}
                    </Text>
                  ) : null}
                  {section.items.map((item) => {
                    const view = views.get(item.id);
                    return view ? (
                      <View key={item.id} style={section.title ? styles.indented : null}>
                        <IngredientLine
                          view={view}
                          checked={checked.has(item.id)}
                          onToggle={() => {
                            const next = new Set(checked);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            setChecked(next);
                          }}
                        />
                      </View>
                    ) : null;
                  })}
                </View>
              ))}
            </Card>
          </View>

          {/* Steps */}
          {recipe.steps.length ? (
            <View style={{ gap: space.sm }}>
              <View style={styles.sectionHeader}>
                <Text variant="title3" weight="600" style={styles.flex}>
                  Steps
                </Text>
                <Button title="Step by step" variant="tinted" size="sm" icon="play" onPress={() => router.push(`/recipe/${recipe.id}/cook`)} />
              </View>
              {recipe.steps.map((section) => (
                <View key={section.id} style={{ gap: space.md }}>
                  {section.title ? (
                    <Text variant="headline" tone="secondary" style={{ marginTop: space.xs, marginLeft: space.xs }}>
                      {section.title}
                    </Text>
                  ) : null}
                  {section.items.map((step) => (
                    <Card key={step.id} style={{ borderRadius: radius.xl, gap: space.sm }}>
                      {callout?.stepId === step.id && callout.kind === 'ingredient' ? <IngredientCallout view={callout.view} /> : null}
                      {callout?.stepId === step.id && callout.kind === 'timer' ? (
                        <Button
                          title={`Start ${formatDuration(callout.seconds)} timer`}
                          icon="timer"
                          variant="yellow"
                          size="sm"
                          style={styles.calloutButton}
                          onPress={() => {
                            startTimer(callout.seconds, callout.label);
                            setCallout(null);
                          }}
                        />
                      ) : null}
                      <View style={[styles.step, { gap: space.md }]}>
                        <View style={[styles.stepNumber, { backgroundColor: colors.accent }]}>
                          <Text variant="subhead" rounded weight="800" color={colors.onAccent}>
                            {stepNumbers.get(step.id)}
                          </Text>
                        </View>
                        <View style={styles.flex}>
                          <StepText
                            text={step.text}
                            recipe={recipe}
                            views={views}
                            onStartTimer={(seconds, label) => {
                              haptic();
                              setCallout({ stepId: step.id, kind: 'timer', seconds, label });
                            }}
                            onIngredientPress={(view) => {
                              haptic();
                              setCallout({ stepId: step.id, kind: 'ingredient', view });
                            }}
                          />
                        </View>
                      </View>
                    </Card>
                  ))}
                </View>
              ))}
            </View>
          ) : null}

          {recipe.notes ? (
            <View style={{ gap: space.sm }}>
              <Text variant="title3" weight="600">
                Notes
              </Text>
              <Card style={{ borderRadius: radius.xl }}>
                <Text variant="body">{recipe.notes}</Text>
              </Card>
            </View>
          ) : null}

          {recipe.nutrition ? (
            <View style={{ gap: space.sm }}>
              <Text variant="title3" weight="600">
                Nutrition
              </Text>
              <Card style={[styles.nutrition, { borderRadius: radius.xl, gap: space.sm }]}>
                {Object.entries(recipe.nutrition).map(([key, value]) => (
                  <View key={key} style={[styles.nutrient, { backgroundColor: colors.fill, borderRadius: radius.md, padding: space.sm }]}>
                    <Text variant="caption" tone="secondary">
                      {NUTRITION_LABELS[key] ?? key}
                    </Text>
                    <Text variant="headline">{value}</Text>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          {recipe.sourceName || recipe.sourceUrl ? (
            <Tap
              onPress={recipe.sourceUrl ? () => void WebBrowser.openBrowserAsync(recipe.sourceUrl!) : undefined}
              style={[styles.source, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.md, gap: space.md }]}
            >
              <Icon name={recipe.sourceUrl ? 'globe' : 'book'} tone="accent" />
              <View style={styles.flex}>
                <Text variant="caption" tone="secondary">
                  Source
                </Text>
                <Text variant="headline" numberOfLines={1}>
                  {recipe.sourceName ?? recipe.sourceUrl}
                  {recipe.author ? ` · ${recipe.author}` : ''}
                </Text>
              </View>
              {recipe.sourceUrl ? <Icon name="chevron" size={18} tone="tertiary" /> : null}
            </Tap>
          ) : null}

          {recipe.tags.length || recipeFolders.length ? (
            <View style={[styles.tags, { gap: space.sm }]}>
              {recipeFolders.map((f) => (
                <Chip key={f.id} label={f.name} icon="folder" onPress={() => setSheet('folders')} />
              ))}
              {recipe.tags.map((t) => (
                <Chip key={t} label={t} icon="pricetag" />
              ))}
            </View>
          ) : null}

          {recipe.lastCookedAt ? (
            <Text variant="footnote" tone="tertiary" align="center">
              Cooked {recipe.cookCount} {recipe.cookCount === 1 ? 'time' : 'times'} · last on {new Date(recipe.lastCookedAt).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* Navigation bar: back link, title once the hero scrolls away, timer and more buttons. */}
      <View style={[styles.navBar, { height: navHeight, paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.background,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.separator,
              opacity: scrollY.interpolate({ inputRange: [heroHeight - 40, heroHeight], outputRange: [0, 1], extrapolate: 'clamp' }),
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.navTitle,
            { top: insets.top, opacity: scrollY.interpolate({ inputRange: [heroHeight - 20, heroHeight + 10], outputRange: [0, 1], extrapolate: 'clamp' }) },
          ]}
        >
          <Text variant="headline" numberOfLines={1}>
            {recipe.name}
          </Text>
        </Animated.View>
        <View style={[styles.navContent, { paddingHorizontal: gutter }]} pointerEvents="box-none">
          <View style={styles.navSide}>
            {embedded ? null : (
              <Tap
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                accessibilityLabel={`Back to ${backLabel}`}
                hitSlop={10}
                style={styles.backLink}
              >
                <Icon name="back" size={26} tone="accent" />
                {/* The label gives way to the title once the hero scrolls off, as on iOS. */}
                <Animated.View
                  style={[
                    styles.backLabel,
                    { opacity: scrollY.interpolate({ inputRange: [heroHeight - 40, heroHeight - 10], outputRange: [1, 0], extrapolate: 'clamp' }) },
                  ]}
                >
                  <Text variant="body" tone="accent" numberOfLines={1}>
                    {backLabel}
                  </Text>
                </Animated.View>
              </Tap>
            )}
          </View>
          <View style={[styles.navRightSide, { gap: space.md }]}>
            <IconButton icon="timer" variant="tinted" size={34} badge onPress={() => setSheet('timers')} accessibilityLabel="Timers" />
            <IconButton icon="more" variant="tinted" size={34} onPress={() => setSheet('more')} accessibilityLabel="More actions" />
          </View>
        </View>
      </View>

      <AddToPlanSheet recipe={recipe} visible={sheet === 'plan'} onClose={() => setSheet(null)} />
      {sheet === 'groceries' ? <AddToGroceriesSheet recipe={recipe} scale={scale} visible onClose={() => setSheet(null)} /> : null}
      <TimerSheet visible={sheet === 'timers'} onClose={() => setSheet(null)} label={recipe.name} recipeId={recipe.id} />

      <Sheet visible={sheet === 'scale'} onClose={() => setSheet(null)} title="Scale recipe">
        <View style={{ gap: space.lg, alignItems: 'center', paddingVertical: space.md }}>
          {baseServings ? (
            <>
              <Text variant="subhead" tone="secondary">
                Written for {formatNumber(baseServings)} {baseServings === 1 ? 'serving' : 'servings'}
              </Text>
              <Stepper value={servings} onChange={setServings} min={1} max={99} format={(v) => `${v} ${v === 1 ? 'serving' : 'servings'}`} />
            </>
          ) : (
            <Stepper value={multiplier} onChange={setMultiplier} min={0.5} max={8} step={0.5} format={(v) => `${formatNumber(v)}×`} />
          )}
          <View style={[styles.tags, { gap: space.sm, justifyContent: 'center' }]}>
            {[0.5, 1, 2, 3].map((m) => (
              <Chip
                key={m}
                label={`${formatNumber(m)}×`}
                selected={Math.abs(scale - m) < 1e-6}
                onPress={() => (baseServings ? setServings(Math.max(1, Math.round(baseServings * m))) : setMultiplier(m))}
              />
            ))}
          </View>
        </View>
      </Sheet>

      <Sheet visible={sheet === 'units'} onClose={() => setSheet(null)} title="Measurements">
        <View style={{ gap: space.md }}>
          <SegmentedControl
            options={[
              { value: 'original', label: 'As written' },
              { value: 'us', label: 'Imperial' },
              { value: 'metric', label: 'Metric' },
            ]}
            value={units}
            onChange={(u) => setUnits(u as UnitPreference)}
          />
          <Text variant="footnote" tone="secondary">
            Converted amounts are rounded to friendly kitchen measures. Tap an ingredient to check it off while you prep.
          </Text>
          {checked.size ? <Button title="Uncheck all ingredients" variant="tinted" onPress={() => setChecked(new Set())} /> : null}
        </View>
      </Sheet>

      <Sheet visible={sheet === 'more'} onClose={() => setSheet(null)} title={recipe.name}>
        <ListSection>
          <ListRow icon="edit" title="Edit recipe" onPress={() => { setSheet(null); router.push(`/recipe/${recipe.id}/edit`); }} />
          <ListRow icon="calendar" iconColor="#34C759" title="Add to meal plan" onPress={() => setSheet('plan')} />
          <ListRow icon={recipe.favorite ? 'heart' : 'heartOutline'} iconColor="#FF3B30" title={recipe.favorite ? 'Remove from favorites' : 'Add to favorites'} onPress={() => { db.recipes.toggleFavorite(recipe.id); setSheet(null); }} />
          <ListRow icon="folder" iconColor="#5E8BD6" title="Folders" value={recipeFolders.map((f) => f.name).join(', ') || 'None'} onPress={() => setSheet('folders')} />
          <ListRow icon="checkCircle" iconColor="#2F9E5B" title="Mark as cooked" onPress={() => { db.recipes.markCooked(recipe.id); haptic('success'); setSheet(null); }} />
          <ListRow icon="copy" iconColor="#8A9A5B" title="Duplicate" onPress={() => { const copy = db.recipes.duplicate(recipe.id); setSheet(null); if (copy) router.push(`/recipe/${copy.id}`); }} />
        </ListSection>
        <ListSection>
          <ListRow icon="send" iconColor="#5E5CE6" title="Share and export" onPress={() => setSheet('share')} />
        </ListSection>
        <ListSection>
          <ListRow icon="trash" iconColor={colors.danger} title="Delete recipe" destructive onPress={() => { setSheet(null); remove(); }} />
        </ListSection>
      </Sheet>

      <Sheet visible={sheet === 'share'} onClose={() => setSheet(null)} title="Share">
        <ListSection>
          <ListRow icon="share" iconColor="#7C6FD6" title="Share as text" onPress={() => { setSheet(null); void share(); }} />
          <ListRow icon="print" iconColor="#5E8BD6" title="Print" onPress={() => { setSheet(null); void printable().then(printHtml); }} />
          {Platform.OS !== 'web' ? (
            <ListRow icon="download" iconColor="#D98B00" title="Share as PDF" onPress={() => { setSheet(null); void printable().then((html) => shareHtmlAsPdf(html, recipe.name)); }} />
          ) : null}
          <ListRow
            icon="upload"
            iconColor="#2F9E5B"
            title="Share as Gather file"
            subtitle="Anyone with Gather can import it"
            onPress={() => {
              setSheet(null);
              const slug = recipe.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recipe';
              void inlineRecipePhotos(recipe).then((full) =>
                shareTextFile(`${slug}.gather`, JSON.stringify(toGatherFile([recipeToDraft(full)]), null, 2)),
              );
            }}
          />
          <ListRow
            icon="upload"
            iconColor="#F5A623"
            title="Share as Crouton file"
            subtitle="A .crumb file Crouton can open"
            onPress={() => {
              setSheet(null);
              const slug = recipe.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recipe';
              void inlineRecipePhotos(recipe).then((full) => {
                const crumb = crumbFromDraft(recipeToDraft(full), () => newId().toUpperCase());
                return shareTextFile(`${slug}.crumb`, JSON.stringify(crumb), 'application/json');
              });
            }}
          />
        </ListSection>
      </Sheet>

      <Sheet visible={sheet === 'folders'} onClose={() => setSheet(null)} title="Folders">
        <ListSection footer="Recipes can be in several folders at once.">
          {folders.map((f) => (
            <ListRow
              key={f.id}
              icon="folderFilled"
              title={f.name}
              accessory={recipe.folderIds.includes(f.id) ? 'check' : 'none'}
              onPress={() => db.folders.toggleRecipe(recipe.id, f.id)}
            />
          ))}
        </ListSection>
      </Sheet>
    </View>
  );
}

const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

const NUTRITION_LABELS: Record<string, string> = {
  servingSize: 'Serving',
  calories: 'Calories',
  fat: 'Fat',
  saturatedFat: 'Saturated fat',
  carbohydrates: 'Carbs',
  fiber: 'Fiber',
  sugar: 'Sugar',
  protein: 'Protein',
  cholesterol: 'Cholesterol',
  sodium: 'Sodium',
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  hero: { overflow: 'hidden' },
  heroTitle: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  heroFavorite: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  startButton: { minWidth: 168 },
  infoRow: { flexDirection: 'row', alignItems: 'stretch' },
  servingsTile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 22, minHeight: 72 },
  timeTile: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 12, paddingHorizontal: 8, minHeight: 72 },
  timeCell: { alignItems: 'center', gap: 4, flexShrink: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  calloutButton: { alignSelf: 'flex-start' },
  difficulty: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4 },
  slidersButton: { width: 44 },
  indented: { paddingLeft: 10 },
  step: { flexDirection: 'row', alignItems: 'flex-start' },
  stepNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: -1 },
  nutrition: { flexDirection: 'row', flexWrap: 'wrap' },
  nutrient: { minWidth: 96 },
  source: { flexDirection: 'row', alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
  navBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  navContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  navSide: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  navRightSide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  backLink: { flexDirection: 'row', alignItems: 'center', marginLeft: -8, flexShrink: 1 },
  backLabel: { flexShrink: 1, marginLeft: -2 },
  navTitle: { position: 'absolute', left: 100, right: 100, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
