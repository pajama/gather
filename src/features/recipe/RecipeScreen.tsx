import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Animated, Platform, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { coverImage, recipeToText, totalSeconds } from '@/core/model/recipe';
import type { Recipe, UnitPreference } from '@/core/model/types';
import { formatDuration } from '@/core/recipe/durations';
import { formatNumber } from '@/core/recipe/quantity';
import { useDb, useFolders, useRecipe, useSettings } from '@/data/react';
import { useTimerHudOffset, useTimers } from '@/features/cook/timers';
import {
  Button,
  Card,
  Chip,
  CONTENT_MAX_WIDTH,
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
  Text,
  useTheme,
  type IconName,
} from '@/ui';

import { AddToGroceriesSheet, AddToPlanSheet } from './RecipeSheets';
import { IngredientLine, StepText, useIngredientViews } from './RecipeText';

export function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
  return <RecipeDetail recipe={recipe} />;
}

function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const db = useDb();
  const settings = useSettings();
  const folders = useFolders();
  const timers = useTimers();
  const { colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  useTimerHudOffset(insets.bottom + 16);
  const [scrollY] = useState(() => new Animated.Value(0));
  const [solid, setSolid] = useState(false);
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const baseServings = recipe.servings ?? 0;
  const [servings, setServings] = useState(baseServings || 1);
  // Recipes without a serving count scale by a multiplier instead (½×, 1×, 1½×, 2×…).
  const [multiplier, setMultiplier] = useState(1);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [units, setUnits] = useState<UnitPreference>(settings.units);
  const [sheet, setSheet] = useState<'plan' | 'groceries' | 'more' | 'folders' | null>(null);
  const scale = baseServings ? servings / baseServings : multiplier;
  const views = useIngredientViews(recipe, scale, units);
  const total = totalSeconds(recipe);
  const heroHeight = wide ? 420 : Math.min(Math.max(height * 0.42, 260), 460);
  const columnWidth = Math.min(width, wide ? 1180 : CONTENT_MAX_WIDTH);
  const gutter = width >= 720 ? 24 : 16;

  useEffect(() => {
    if (!settings.keepAwake || Platform.OS === 'web') return;
    void activateKeepAwakeAsync('recipe');
    return () => {
      void deactivateKeepAwake('recipe');
    };
  }, [settings.keepAwake]);

  const startTimer = (seconds: number, label: string) => timers.start(label, seconds, recipe.id);
  const stats: { icon: IconName; label: string; value: string }[] = [];
  const tileTime = (seconds: number) => formatDuration(seconds, seconds >= 3600 ? 'compact' : 'short');
  if (recipe.prepSeconds) stats.push({ icon: 'time', label: 'Prep', value: tileTime(recipe.prepSeconds) });
  if (recipe.cookSeconds) stats.push({ icon: 'flame', label: 'Cook', value: tileTime(recipe.cookSeconds) });
  if (total && (recipe.prepSeconds || recipe.cookSeconds)) stats.push({ icon: 'timer', label: 'Total', value: tileTime(total) });
  else if (total) stats.push({ icon: 'timer', label: 'Time', value: tileTime(total) });
  if (recipe.servings) stats.push({ icon: 'people', label: 'Serves', value: formatNumber(recipe.servings) });

  const share = async () => {
    const text = recipeToText(recipe);
    try {
      await Share.share(Platform.OS === 'web' ? { message: text, title: recipe.name } : { message: text });
    } catch {
      // Share sheets can be dismissed or unavailable on some browsers.
    }
  };

  const remove = () => {
    const doDelete = () => {
      db.recipes.delete(recipe.id);
      router.back();
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

  const ingredientsCard = (
    <Card style={{ gap: space.sm }}>
      <View style={styles.cardHeader}>
        <Text variant="title2">Ingredients</Text>
        {baseServings ? (
          <Stepper value={servings} onChange={setServings} min={1} max={99} format={(v) => `${v} ${v === 1 ? 'serving' : 'servings'}`} />
        ) : (
          <Stepper value={multiplier} onChange={setMultiplier} min={0.5} max={8} step={0.5} format={(v) => `${formatNumber(v)}×`} />
        )}
      </View>
      <SegmentedControl
        options={[
          { value: 'original', label: 'Original' },
          { value: 'us', label: 'US' },
          { value: 'metric', label: 'Metric' },
        ]}
        value={units}
        onChange={(u) => setUnits(u as UnitPreference)}
        style={{ marginVertical: space.xs }}
      />
      {recipe.ingredients.length === 0 ? (
        <Text variant="subhead" tone="secondary">
          No ingredients yet.
        </Text>
      ) : null}
      {recipe.ingredients.map((section) => (
        <View key={section.id}>
          {section.title ? (
            <Text variant="overline" tone="secondary" style={{ marginTop: space.md, marginBottom: space.xs }}>
              {section.title}
            </Text>
          ) : null}
          {section.items.map((item) => {
            const view = views.get(item.id);
            return view ? (
              <IngredientLine
                key={item.id}
                view={view}
                checked={checked.has(item.id)}
                onToggle={() => {
                  const next = new Set(checked);
                  if (next.has(item.id)) next.delete(item.id);
                  else next.add(item.id);
                  setChecked(next);
                }}
              />
            ) : null;
          })}
        </View>
      ))}
      <Button title="Add to groceries" icon="cart" variant="tinted" onPress={() => setSheet('groceries')} style={{ marginTop: space.sm }} />
    </Card>
  );

  const stepNumbers = useMemo(() => {
    const numbers = new Map<string, number>();
    let n = 0;
    for (const section of recipe.steps) for (const step of section.items) numbers.set(step.id, ++n);
    return numbers;
  }, [recipe.steps]);
  const methodCard = (
    <Card style={{ gap: space.md }}>
      <View style={styles.cardHeader}>
        <Text variant="title2">Method</Text>
        <Button title="Cook" icon="play" size="sm" onPress={() => router.push(`/recipe/${recipe.id}/cook`)} />
      </View>
      {recipe.steps.length === 0 ? (
        <Text variant="subhead" tone="secondary">
          No steps yet.
        </Text>
      ) : null}
      {recipe.steps.map((section) => (
        <View key={section.id} style={{ gap: space.md }}>
          {section.title ? (
            <Text variant="overline" tone="secondary" style={{ marginTop: space.xs }}>
              {section.title}
            </Text>
          ) : null}
          {section.items.map((step) => {
            const stepNumber = stepNumbers.get(step.id);
            return (
              <View key={step.id} style={[styles.step, { gap: space.md }]}>
                <View style={[styles.stepNumber, { backgroundColor: colors.accentSoft }]}>
                  <Text variant="subhead" weight="800" tone="accent">
                    {stepNumber}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <StepText text={step.text} recipe={recipe} views={views} onStartTimer={startTimer} showAmounts={false} />
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );

  const recipeFolders = folders.filter((f) => recipe.folderIds.includes(f.id));

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: Platform.OS !== 'web',
          listener: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
            const next = e.nativeEvent.contentOffset.y > heroHeight - 110;
            if (next !== solid) setSolid(next);
          },
        })}
      >
        {wide ? (
          <View style={{ width: columnWidth, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: insets.top + 64 }}>
            <Photo uri={coverImage(recipe)} style={{ height: heroHeight, borderRadius: radius.xl }} fallbackIcon="restaurant" />
          </View>
        ) : (
          <View style={{ height: heroHeight }}>
            <Photo uri={coverImage(recipe)} style={StyleSheet.absoluteFill} fallbackIcon="restaurant" />
            <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', colors.background]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
          </View>
        )}

        <View style={{ width: columnWidth, alignSelf: 'center', paddingHorizontal: gutter, marginTop: wide ? space.xl : -40, gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            <Text variant="largeTitle" accessibilityRole="header">
              {recipe.name}
            </Text>
            {recipe.sourceName || recipe.sourceUrl ? (
              <Text
                variant="subhead"
                tone={recipe.sourceUrl ? 'accent' : 'secondary'}
                weight="600"
                onPress={recipe.sourceUrl ? () => void WebBrowser.openBrowserAsync(recipe.sourceUrl!) : undefined}
              >
                {recipe.sourceName ?? recipe.sourceUrl}
                {recipe.author ? ` · ${recipe.author}` : ''}
              </Text>
            ) : null}
            {recipe.description ? (
              <Text variant="body" tone="secondary">
                {recipe.description}
              </Text>
            ) : null}
          </View>

          {stats.length ? (
            <View style={[styles.stats, { gap: space.sm }]}>
              {stats.map((s) => (
                <View key={s.label} style={[styles.stat, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md }]}>
                  <Icon name={s.icon} size={18} tone="accent" />
                  <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
                    {s.label}
                  </Text>
                  <Text variant="headline" numberOfLines={1}>
                    {s.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.actions, { gap: space.sm }]}>
            <Button title="Start cooking" icon="play" size="lg" style={styles.flex} onPress={() => router.push(`/recipe/${recipe.id}/cook`)} />
            <IconButton icon="calendar" variant="tinted" size={54} onPress={() => setSheet('plan')} accessibilityLabel="Add to plan" />
            <IconButton icon="cart" variant="tinted" size={54} onPress={() => setSheet('groceries')} accessibilityLabel="Add to groceries" />
          </View>

          {wide ? (
            <View style={[styles.twoColumn, { gap: space.lg }]}>
              <View style={{ flex: 5 }}>{ingredientsCard}</View>
              <View style={{ flex: 7 }}>{methodCard}</View>
            </View>
          ) : (
            <>
              {ingredientsCard}
              {methodCard}
            </>
          )}

          {recipe.notes ? (
            <Card style={{ gap: space.sm }}>
              <Text variant="title3">Notes</Text>
              <Text variant="body">{recipe.notes}</Text>
            </Card>
          ) : null}

          {recipe.nutrition ? (
            <Card style={{ gap: space.sm }}>
              <Text variant="title3">Nutrition</Text>
              <View style={[styles.nutrition, { gap: space.sm }]}>
                {Object.entries(recipe.nutrition).map(([key, value]) => (
                  <View key={key} style={[styles.nutrient, { backgroundColor: colors.fill, borderRadius: radius.md, padding: space.sm }]}>
                    <Text variant="caption" tone="secondary">
                      {NUTRITION_LABELS[key] ?? key}
                    </Text>
                    <Text variant="headline">{value}</Text>
                  </View>
                ))}
              </View>
            </Card>
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

      <Animated.View
        pointerEvents="none"
        style={[
          styles.headerBar,
          {
            height: insets.top + 56,
            paddingTop: insets.top,
            backgroundColor: colors.surface,
            borderBottomColor: colors.separator,
            opacity: scrollY.interpolate({ inputRange: [heroHeight - 140, heroHeight - 80], outputRange: [0, 1], extrapolate: 'clamp' }),
          },
        ]}
      >
        <Text variant="headline" numberOfLines={1} style={[styles.headerTitle, { marginHorizontal: gutter + 52 }]}>
          {recipe.name}
        </Text>
      </Animated.View>

      <View style={[styles.topBar, { top: insets.top + 6, paddingHorizontal: gutter }]} pointerEvents="box-none">
        <IconButton
          icon="back"
          variant={solid ? 'plain' : 'glass'}
          size={38}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityLabel="Back"
        />
        <View style={[styles.topActions, { gap: space.sm }]}>
          {solid ? null : (
            <>
              <IconButton
                icon={recipe.favorite ? 'heart' : 'heartOutline'}
                variant="glass"
                size={38}
                onPress={() => {
                  haptic();
                  db.recipes.toggleFavorite(recipe.id);
                }}
                accessibilityLabel={recipe.favorite ? 'Remove from favorites' : 'Add to favorites'}
              />
              <IconButton icon="share" variant="glass" size={38} onPress={share} accessibilityLabel="Share" />
            </>
          )}
          <IconButton icon="more" variant={solid ? 'plain' : 'glass'} size={38} onPress={() => setSheet('more')} accessibilityLabel="More actions" />
        </View>
      </View>

      <AddToPlanSheet recipe={recipe} visible={sheet === 'plan'} onClose={() => setSheet(null)} />
      {sheet === 'groceries' ? <AddToGroceriesSheet recipe={recipe} scale={scale} visible onClose={() => setSheet(null)} /> : null}

      <Sheet visible={sheet === 'more'} onClose={() => setSheet(null)} title={recipe.name}>
        <ListSection>
          <ListRow icon="edit" title="Edit recipe" onPress={() => { setSheet(null); router.push(`/recipe/${recipe.id}/edit`); }} />
          <ListRow icon="folder" iconColor="#5E8BD6" title="Folders" value={recipeFolders.map((f) => f.name).join(', ') || 'None'} onPress={() => setSheet('folders')} />
          <ListRow icon="checkCircle" iconColor="#2F9E5B" title="Mark as cooked" onPress={() => { db.recipes.markCooked(recipe.id); haptic('success'); setSheet(null); }} />
          <ListRow icon="copy" iconColor="#8A9A5B" title="Duplicate" onPress={() => { const copy = db.recipes.duplicate(recipe.id); setSheet(null); if (copy) router.push(`/recipe/${copy.id}`); }} />
          <ListRow icon="share" iconColor="#7C6FD6" title="Share as text" onPress={() => { setSheet(null); void share(); }} />
        </ListSection>
        <ListSection>
          <ListRow icon="trash" iconColor={colors.danger} title="Delete recipe" destructive onPress={() => { setSheet(null); remove(); }} />
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  twoColumn: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { flexDirection: 'row', alignItems: 'flex-start' },
  stepNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: -2 },
  nutrition: { flexDirection: 'row', flexWrap: 'wrap' },
  nutrient: { minWidth: 96 },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
  topBar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBar: { position: 'absolute', top: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { alignSelf: 'stretch', textAlign: 'center' },
  topActions: { flexDirection: 'row' },
});
