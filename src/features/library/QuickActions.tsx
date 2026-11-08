import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import type { Recipe } from '@/core/model/types';
import { useDb } from '@/data/react';
import { AddToGroceriesSheet, AddToPlanSheet } from '@/features/recipe';
import { haptic, ListRow, ListSection, Sheet, useTheme } from '@/ui';

/** Long-press a recipe card: the common actions without opening the recipe. */
export function QuickActions({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  const db = useDb();
  const { colors } = useTheme();
  const [next, setNext] = useState<'plan' | 'groceries' | null>(null);
  const [target, setTarget] = useState<Recipe | null>(null);

  const remove = (r: Recipe) => {
    const doDelete = () => db.recipes.delete(r.id);
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`Delete “${r.name}”? This can’t be undone.`) ?? true) doDelete();
      return;
    }
    Alert.alert('Delete recipe?', `“${r.name}” will be removed from your library, plan and groceries.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const open = (kind: 'plan' | 'groceries') => {
    if (!recipe) return;
    setTarget(recipe);
    setNext(kind);
    onClose();
  };

  return (
    <>
      <Sheet visible={!!recipe} onClose={onClose} title={recipe?.name ?? ''}>
        {recipe ? (
          <>
            <ListSection>
              <ListRow icon="play" iconColor="#34C759" title="Start cooking" onPress={() => { onClose(); router.push(`/recipe/${recipe.id}/cook`); }} />
              <ListRow icon="calendar" iconColor="#FF3B30" title="Add to meal plan" onPress={() => open('plan')} />
              <ListRow icon="basket" iconColor="#F5A623" title="Add to groceries" onPress={() => open('groceries')} />
              <ListRow
                icon={recipe.favorite ? 'heart' : 'heartOutline'}
                iconColor="#FF2D55"
                title={recipe.favorite ? 'Remove from favorites' : 'Add to favorites'}
                onPress={() => {
                  db.recipes.toggleFavorite(recipe.id);
                  haptic();
                  onClose();
                }}
              />
            </ListSection>
            <ListSection>
              <ListRow icon="trash" iconColor={colors.danger} title="Delete recipe" destructive onPress={() => { onClose(); remove(recipe); }} />
            </ListSection>
          </>
        ) : null}
      </Sheet>
      {target ? <AddToPlanSheet recipe={target} visible={next === 'plan'} onClose={() => setNext(null)} /> : null}
      {target && next === 'groceries' ? <AddToGroceriesSheet recipe={target} scale={1} visible onClose={() => setNext(null)} /> : null}
    </>
  );
}
