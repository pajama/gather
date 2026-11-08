import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Recipe, UnitPreference } from '@/core/model/types';
import { findDurations, formatDuration } from '@/core/recipe/durations';
import { useDb, useRecipe, useSettings } from '@/data/react';
import { IngredientCallout, IngredientLine, StepText, useIngredientViews, type IngredientView } from '@/features/recipe';
import { TimerSheet, useTimerActions } from '@/features/timers';
import { Button, haptic, Icon, IconButton, Sheet, Text, useTheme } from '@/ui';

import { speak, stopSpeaking, useVoiceCommands, voiceCommandsSupported, type VoiceCommand } from './voice';

interface FlatStep {
  id: string;
  text: string;
  section?: string;
}

export function CookScreen() {
  const params = useLocalSearchParams<{ id: string; scale?: string; units?: string }>();
  const recipe = useRecipe(params.id);
  const settings = useSettings();
  const scale = Number(params.scale) > 0 ? Number(params.scale) : 1;
  const units: UnitPreference = params.units === 'us' || params.units === 'metric' || params.units === 'original' ? params.units : settings.units;
  if (!recipe) return null;
  return <CookMode recipe={recipe} scale={scale} units={units} />;
}

/** Step-by-step mode, after Crouton's: one step per page, tappable ingredients and timers, arrows and dots. */
function CookMode({ recipe, scale, units }: { recipe: Recipe; scale: number; units: UnitPreference }) {
  const db = useDb();
  const timers = useTimerActions();
  const { colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [sheet, setSheet] = useState<'ingredients' | 'timers' | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [handsFree, setHandsFree] = useState(false);
  const [callout, setCallout] = useState<{ stepId: string; view: IngredientView } | null>(null);
  const views = useIngredientViews(recipe, scale, units);

  const steps: FlatStep[] = useMemo(
    () => recipe.steps.flatMap((s) => s.items.map((item) => ({ id: item.id, text: item.text, ...(s.title ? { section: s.title } : {}) }))),
    [recipe],
  );
  const count = steps.length;
  const stepDurations = useMemo(() => steps.map((step) => findDurations(step.text)), [steps]);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void activateKeepAwakeAsync('cook');
    return () => {
      void deactivateKeepAwake('cook');
    };
  }, []);

  useEffect(() => {
    if (!callout) return;
    const handle = setTimeout(() => setCallout(null), 2600);
    return () => clearTimeout(handle);
  }, [callout]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(count - 1, next));
      setIndex(clamped);
      setCallout(null);
      scroller.current?.scrollTo({ x: clamped * width, animated: true });
      haptic();
    },
    [count, width],
  );

  const finish = useCallback(() => {
    // Keys, voice and buttons can all say "done"; the recipe is cooked once.
    if (finishedRef.current) return;
    finishedRef.current = true;
    db.recipes.markCooked(recipe.id);
    haptic('success');
    stopSpeaking();
    setFinished(true);
  }, [db, recipe.id]);

  // Keyboard control on the web and with hardware keyboards: arrows and space.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || finished) return;
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
  }, [index, count, goTo, finish, finished]);

  const startStepTimer = useCallback(
    (stepIndex: number) => {
      const first = stepDurations[stepIndex]?.[0];
      if (first) timers.start(`${recipe.name}: step ${stepIndex + 1}`, first.maxSeconds ?? first.seconds, recipe.id);
    },
    [stepDurations, timers, recipe.name, recipe.id],
  );

  const onVoice = useCallback(
    (command: VoiceCommand) => {
      if (finishedRef.current) return;
      if (command === 'next') {
        if (index >= count - 1) finish();
        else goTo(index + 1);
      } else if (command === 'back') goTo(index - 1);
      else if (command === 'repeat' && steps[index]) speak(steps[index].text);
      else if (command === 'timer') startStepTimer(index);
      else if (command === 'ingredients') setSheet('ingredients');
      else if (command === 'done') finish();
    },
    [index, count, finish, goTo, steps, startStepTimer],
  );
  const canListen = voiceCommandsSupported();
  const voice = useVoiceCommands(handsFree && canListen && !finished, onVoice);

  // Hands-free reads each step aloud as it appears.
  useEffect(() => {
    if (handsFree && steps[index]) speak(steps[index].text);
  }, [handsFree, index, steps]);
  useEffect(() => () => stopSpeaking(), []);

  // The page follows the scroll position. react-native-web never fires onMomentumScrollEnd, so
  // swiping or trackpad-scrolling in a browser has to be tracked from onScroll.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / width)));
    if (page !== index) {
      setIndex(page);
      setCallout(null);
    }
  };

  if (finished) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.background, padding: space.xxxl, gap: space.lg }]}>
        <View style={[styles.doneBadge, { backgroundColor: colors.greenSoft }]}>
          <Icon name="restaurant" size={44} color={colors.green} />
        </View>
        <Text variant="largeTitle" align="center">
          Enjoy your meal!
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {recipe.name} is marked as cooked.
        </Text>
        <Button title="Back to recipe" variant="tinted" onPress={() => router.back()} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  const textVariant = width >= 700 ? 'title1' : 'step';

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: space.lg, gap: space.md }]}>
        <IconButton icon="close" variant="tinted" size={36} onPress={() => router.back()} accessibilityLabel="Close step by step" />
        <View style={styles.flex} />
        <Button title="Ingredients" variant="tinted" size="sm" onPress={() => setSheet('ingredients')} style={styles.ingredientsPill} />
        <IconButton
          icon={handsFree ? 'volume' : 'hand'}
          variant={handsFree ? 'filled' : 'tinted'}
          size={36}
          onPress={() => {
            if (handsFree) stopSpeaking();
            setHandsFree(!handsFree);
          }}
          accessibilityLabel={handsFree ? 'Turn off hands-free' : 'Turn on hands-free'}
        />
        <IconButton icon="timer" variant="tinted" size={36} badge onPress={() => setSheet('timers')} accessibilityLabel="Timers" />
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

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.flex}
      >
        {steps.map((step, stepIndex) => {
          const durations = stepDurations[stepIndex] ?? [];
          return (
            <ScrollView key={step.id} style={{ width }} contentContainerStyle={[styles.page, { paddingHorizontal: space.xxxl, paddingTop: space.huge, gap: space.lg }]}>
              <Text variant="overline" tone="tertiary">
                Step {stepIndex + 1}
                {step.section ? ` · ${step.section}` : ''}
              </Text>
              {callout?.stepId === step.id ? <IngredientCallout view={callout.view} /> : null}
              <StepText
                text={step.text}
                recipe={recipe}
                views={views}
                units={units}
                variant={textVariant}
                onStartTimer={(seconds, label) => timers.start(label, seconds, recipe.id)}
                onIngredientPress={(view) => {
                  haptic();
                  setCallout({ stepId: step.id, view });
                }}
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
                        variant="yellow"
                        size="sm"
                        onPress={() => timers.start(`${recipe.name}: step ${stepIndex + 1}`, seconds, recipe.id)}
                      />
                    );
                  })}
                </View>
              ) : null}
            </ScrollView>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: space.xxl, paddingBottom: insets.bottom + space.lg }]}>
        <IconButton icon="arrowLeft" variant="filled" size={58} disabled={index === 0} onPress={() => goTo(index - 1)} accessibilityLabel="Previous step" />
        <View style={[styles.dots, { gap: 8 }]}>
          {steps.length <= 14 ? (
            steps.map((s, i) => <View key={s.id} style={[styles.dot, { backgroundColor: i === index ? colors.accent : colors.fillStrong }]} />)
          ) : (
            <Text variant="subhead" tone="secondary">
              {index + 1} / {count}
            </Text>
          )}
        </View>
        {index >= count - 1 ? (
          <IconButton icon="check" variant="filled" tint="green" size={58} onPress={finish} accessibilityLabel="Finish cooking" />
        ) : (
          <IconButton icon="arrowRight" variant="filled" size={58} onPress={() => goTo(index + 1)} accessibilityLabel="Next step" />
        )}
      </View>

      <TimerSheet visible={sheet === 'timers'} onClose={() => setSheet(null)} label={recipe.name} recipeId={recipe.id} />
      <Sheet visible={sheet === 'ingredients'} onClose={() => setSheet(null)} title="Ingredients">
        {recipe.ingredients.map((section) => (
          <View key={section.id}>
            {section.title ? (
              <Text variant="headline" style={{ marginTop: space.md }}>
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
                  showCheckbox
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
  ingredientsPill: { minWidth: 140 },
  handsFree: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  page: { flexGrow: 1, maxWidth: 820, alignSelf: 'center', width: '100%' },
  timerButtons: { flexDirection: 'row', flexWrap: 'wrap' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  doneBadge: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
});
