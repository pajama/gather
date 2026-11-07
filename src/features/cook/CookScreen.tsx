import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Recipe } from '@/core/model/types';
import { findDurations, formatDuration } from '@/core/recipe/durations';
import { findIngredientMentions } from '@/core/recipe/mentions';
import { useDb, useRecipe } from '@/data/react';
import { IngredientLine, StepText, useIngredientViews } from '@/features/recipe/RecipeText';
import { Button, haptic, Icon, IconButton, Sheet, Text, useTheme } from '@/ui';

import { useTimerHudOffset, useTimers } from './timers';
import { speak, stopSpeaking, useVoiceCommands, voiceCommandsSupported, type VoiceCommand } from './voice';

interface FlatStep {
  id: string;
  text: string;
  section?: string;
}

export function CookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipe(id);
  if (!recipe) return null;
  return <CookMode recipe={recipe} />;
}

function CookMode({ recipe }: { recipe: Recipe }) {
  const db = useDb();
  const timers = useTimers();
  const { colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [handsFree, setHandsFree] = useState(false);
  const views = useIngredientViews(recipe, 1, 'original');
  useTimerHudOffset(insets.bottom + 96);
  const targets = useMemo(() => [...views.values()].map((v) => ({ id: v.ingredient.id, name: v.parsedName })), [views]);

  const steps: FlatStep[] = useMemo(
    () => recipe.steps.flatMap((s) => s.items.map((item) => ({ id: item.id, text: item.text, ...(s.title ? { section: s.title } : {}) }))),
    [recipe],
  );
  const count = steps.length;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void activateKeepAwakeAsync('cook');
    return () => {
      void deactivateKeepAwake('cook');
    };
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(count - 1, next));
      setIndex(clamped);
      scroller.current?.scrollTo({ x: clamped * width, animated: true });
      haptic();
    },
    [count, width],
  );

  const finish = useCallback(() => {
    db.recipes.markCooked(recipe.id);
    haptic('success');
    setFinished(true);
  }, [db, recipe.id]);

  // Keyboard control on the web and with hardware keyboards: arrows and space.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (index >= count - 1) finish();
        else goTo(index + 1);
      } else if (e.key === 'ArrowLeft') goTo(index - 1);
      else if (e.key === 'Escape') router.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, goTo, finish]);

  const startStepTimer = useCallback(
    (stepIndex: number) => {
      const step = steps[stepIndex];
      const first = step ? findDurations(step.text)[0] : undefined;
      if (first) timers.start(`${recipe.name}: step ${stepIndex + 1}`, first.maxSeconds ?? first.seconds, recipe.id);
    },
    [steps, timers, recipe.name, recipe.id],
  );

  const onVoice = useCallback(
    (command: VoiceCommand) => {
      if (command === 'next') {
        if (index >= count - 1) finish();
        else goTo(index + 1);
      } else if (command === 'back') goTo(index - 1);
      else if (command === 'repeat' && steps[index]) speak(steps[index].text);
      else if (command === 'timer') startStepTimer(index);
      else if (command === 'ingredients') setShowIngredients(true);
      else if (command === 'done') finish();
    },
    [index, count, finish, goTo, steps, startStepTimer],
  );
  const canListen = voiceCommandsSupported();
  const voice = useVoiceCommands(handsFree && canListen, onVoice);

  // Hands-free reads each step aloud as it appears.
  useEffect(() => {
    if (handsFree && steps[index]) speak(steps[index].text);
  }, [handsFree, index, steps]);
  useEffect(() => () => stopSpeaking(), []);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    if (page !== index) setIndex(page);
  };

  if (finished) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.background, padding: space.xxxl, gap: space.lg }]}>
        <View style={[styles.doneBadge, { backgroundColor: colors.accentSoft }]}>
          <Icon name="restaurant" size={44} tone="accent" />
        </View>
        <Text variant="largeTitle" align="center">
          Enjoy your meal!
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {recipe.name} is marked as cooked.
        </Text>
        <Button title="Back to recipe" onPress={() => router.back()} style={{ marginTop: space.lg }} />
      </View>
    );
  }


  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: space.lg, gap: space.md }]}>
        <IconButton icon="close" variant="fill" onPress={() => router.back()} accessibilityLabel="Close cook mode" />
        <View style={[styles.flex, styles.center]}>
          <Text variant="footnote" tone="secondary" numberOfLines={1}>
            {recipe.name}
          </Text>
          <Text variant="headline">{count ? `Step ${index + 1} of ${count}` : 'No steps'}</Text>
        </View>
        <IconButton
          icon={handsFree ? 'volume' : 'hand'}
          variant={handsFree ? 'filled' : 'fill'}
          onPress={() => {
            if (handsFree) stopSpeaking();
            setHandsFree(!handsFree);
          }}
          accessibilityLabel={handsFree ? 'Turn off hands-free' : 'Turn on hands-free'}
        />
        <IconButton icon="list" variant="fill" onPress={() => setShowIngredients(true)} accessibilityLabel="Show ingredients" />
      </View>
      {handsFree ? (
        <View style={[styles.handsFree, { marginHorizontal: space.lg, backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space.sm, gap: space.sm }]}>
          <Icon name={canListen ? 'mic' : 'volume'} size={18} tone="accent" />
          <Text variant="footnote" style={styles.flex}>
            {voice.error ??
              (canListen
                ? voice.listening
                  ? 'Listening. Say “next”, “back”, “repeat”, “timer” or “ingredients”.'
                  : 'Starting the microphone…'
                : 'Reading each step aloud. Voice commands need a browser with speech recognition.')}
          </Text>
        </View>
      ) : null}

      <View style={[styles.progress, { marginHorizontal: space.lg, gap: 4 }]}>
        {steps.map((s, i) => (
          <View key={s.id} style={[styles.progressSegment, { backgroundColor: i <= index ? colors.accent : colors.fillStrong, borderRadius: radius.pill }]} />
        ))}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        style={styles.flex}
      >
        {steps.map((step) => {
          const durations = findDurations(step.text);
          const used = [...new Set(findIngredientMentions(step.text, targets).map((m) => m.ingredientId))]
            .map((ingredientId) => views.get(ingredientId))
            .filter((v): v is NonNullable<typeof v> => !!v);
          return (
            <ScrollView key={step.id} style={{ width }} contentContainerStyle={[styles.page, { padding: space.xxl, gap: space.xl }]}>
              {step.section ? (
                <Text variant="overline" tone="accent">
                  {step.section}
                </Text>
              ) : null}
              <StepText
                text={step.text}
                recipe={recipe}
                views={views}
                variant={width >= 700 ? 'title1' : 'title2'}
                showAmounts={false}
                onStartTimer={(seconds, label) => timers.start(label, seconds, recipe.id)}
              />
              {durations.length ? (
                <View style={[styles.timerButtons, { gap: space.sm }]}>
                  {durations.map((d, i) => {
                    const seconds = d.maxSeconds ?? d.seconds;
                    return (
                      <Button
                        key={i}
                        title={`Start ${formatDuration(seconds)} timer`}
                        icon="timer"
                        variant="tinted"
                        onPress={() => timers.start(`${recipe.name}: step ${steps.indexOf(step) + 1}`, seconds, recipe.id)}
                      />
                    );
                  })}
                </View>
              ) : null}
              {used.length ? (
                <View style={[styles.used, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.xs }]}>
                  <Text variant="overline" tone="secondary" style={{ marginBottom: space.xs }}>
                    In this step
                  </Text>
                  {used.map((view) => (
                    <IngredientLine key={view.ingredient.id} view={view} />
                  ))}
                </View>
              ) : null}
            </ScrollView>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.md, gap: space.md }]}>
        <Button title="Back" icon="arrowLeft" variant="tinted" size="lg" disabled={index === 0} onPress={() => goTo(index - 1)} style={styles.flex} />
        {index >= count - 1 ? (
          <Button title="Finish" icon="check" size="lg" onPress={finish} style={styles.flex} />
        ) : (
          <Button title="Next" icon="arrowRight" size="lg" onPress={() => goTo(index + 1)} style={styles.flex} />
        )}
      </View>

      <Sheet visible={showIngredients} onClose={() => setShowIngredients(false)} title="Ingredients">
        {recipe.ingredients.map((section) => (
          <View key={section.id}>
            {section.title ? (
              <Text variant="overline" tone="secondary" style={{ marginTop: space.md }}>
                {section.title}
              </Text>
            ) : null}
            {section.items.map((item) => {
              const view = views.get(item.id);
              if (!view) return null;
              return (
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
              );
            })}
          </View>
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  progress: { flexDirection: 'row', height: 4, marginTop: 4 },
  progressSegment: { flex: 1, height: 4 },
  page: { flexGrow: 1, justifyContent: 'center', maxWidth: 820, alignSelf: 'center', width: '100%' },
  timerButtons: { flexDirection: 'row', flexWrap: 'wrap' },
  used: { alignSelf: 'stretch' },
  handsFree: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  footer: { flexDirection: 'row', paddingTop: 8 },
  doneBadge: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
});
