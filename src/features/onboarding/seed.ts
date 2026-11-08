/**
 * First-launch content: a handful of original sample recipes so the app is
 * never empty on first open. Images ship with the app and are referenced as
 * `asset://seed/<name>` URIs (resolved by the image component).
 */

import type { Difficulty } from '@/core/model/types';
import { parseRecipeText } from '@/core/import/text';
import { addDays, dayKey } from '@/core/planner/planner';
import type { Database } from '@/data/database';

interface SeedRecipe {
  text: string;
  image?: string;
  tags: string[];
  folders: string[];
  sourceName?: string;
  favorite?: boolean;
  prep?: number;
  cook?: number;
  rating?: number;
  difficulty?: Difficulty;
}

const m = (minutes: number) => minutes * 60;

export const SEED_RECIPES: SeedRecipe[] = [
  {
    image: 'roast-chicken',
    rating: 5,
    difficulty: 'medium',
    tags: ['Dinner', 'Chicken'],
    folders: ['Dinners', 'Sunday Cooking'],
    favorite: true,
    prep: m(20),
    cook: m(75),
    text: `Lemon Herb Roast Chicken
A golden, juicy bird roasted over potatoes that soak up every drop of the pan juices.
Serves 4

Ingredients
1 whole chicken (about 4 lb)
2 lemons
4 tbsp butter, softened
4 cloves garlic, minced
1 tbsp fresh thyme leaves
1 tbsp chopped rosemary
1½ lb baby potatoes, halved
2 tbsp olive oil
2 tsp kosher salt
1 tsp black pepper

Method
1. Heat the oven to 425°F. Pat the chicken dry and let it sit at room temperature for 20 minutes.
2. Zest one lemon and mix the zest with the butter, garlic, thyme, rosemary, half the salt and the pepper.
3. Loosen the skin over the breast and rub half of the herb butter underneath. Rub the rest over the outside.
4. Toss the potatoes with the olive oil and remaining salt and spread them in a large skillet. Halve both lemons, tuck two halves inside the chicken and set the bird on the potatoes.
5. Roast for 1 hour 15 minutes, until the thickest part of the thigh reaches 165°F.
6. Rest the chicken for 10 minutes before carving. Squeeze the roasted lemons over the potatoes and serve.`,
  },
  {
    image: 'tomato-pasta',
    rating: 4,
    difficulty: 'easy',
    tags: ['Dinner', 'Pasta', 'Vegetarian'],
    folders: ['Dinners', 'Weeknight'],
    prep: m(10),
    cook: m(20),
    text: `Weeknight Tomato Basil Spaghetti
Bright, fresh and on the table in half an hour. Use the ripest tomatoes you can find.
Serves 4

Ingredients
1 lb spaghetti
3 tbsp olive oil
4 cloves garlic, thinly sliced
¼ tsp red pepper flakes
2 lb ripe tomatoes, chopped
1 tsp sugar
1 large handful basil leaves
½ cup grated parmesan, plus more to serve
Salt, to taste

Method
1. Bring a large pot of salted water to a boil and cook the spaghetti until al dente, about 9 minutes. Save 1 cup of pasta water before draining.
2. Meanwhile, warm the olive oil in a wide pan over medium heat. Add the garlic and red pepper flakes and cook for 1 minute, until fragrant.
3. Add the tomatoes, sugar and a big pinch of salt. Simmer for 10 minutes, crushing the tomatoes as they soften.
4. Toss the spaghetti into the sauce with a splash of pasta water and the parmesan until glossy.
5. Tear in the basil and serve with more parmesan.`,
  },
  {
    image: 'pancakes',
    rating: 5,
    difficulty: 'easy',
    tags: ['Breakfast'],
    folders: ['Breakfast & Brunch'],
    favorite: true,
    prep: m(10),
    cook: m(20),
    text: `Fluffy Buttermilk Pancakes
Tall, tender pancakes with crisp edges. The batter should be lumpy; don't overmix.
Serves 4

Ingredients
2 cups all-purpose flour
2 tbsp sugar
2 tsp baking powder
½ tsp baking soda
½ tsp salt
2 cups buttermilk
2 large eggs
3 tbsp melted butter, plus more for the pan
1 tsp vanilla extract
Maple syrup and blueberries, to serve

Method
1. Whisk the flour, sugar, baking powder, baking soda and salt in a large bowl.
2. In another bowl, whisk the buttermilk, eggs, melted butter and vanilla.
3. Pour the wet ingredients into the dry and fold gently until just combined. Rest the batter for 5 minutes.
4. Heat a lightly buttered skillet over medium heat. Pour in ⅓ cup of batter per pancake.
5. Cook for 2 to 3 minutes, until bubbles form on top, then flip and cook 1 to 2 minutes more.
6. Serve warm with maple syrup and blueberries.`,
  },
  {
    image: 'green-curry',
    rating: 4,
    difficulty: 'medium',
    tags: ['Dinner', 'Thai', 'Vegetarian'],
    folders: ['Dinners', 'Weeknight'],
    prep: m(15),
    cook: m(25),
    text: `Thai Green Curry with Vegetables
Creamy, fragrant and endlessly adaptable. Add tofu or chicken if you like.
Serves 4

Ingredients
1 tbsp coconut oil
3 tbsp green curry paste
2 (13.5 oz) cans coconut milk
1 cup vegetable broth
1 tbsp fish sauce
1 tbsp brown sugar
1 red bell pepper, sliced
1 small eggplant, cubed
1 cup green beans, trimmed
1 cup snap peas
1 lime, juiced
1 handful thai basil
Jasmine rice, to serve

Method
1. Warm the coconut oil in a large pot over medium heat. Fry the curry paste for 2 minutes, stirring, until fragrant.
2. Stir in the coconut milk, broth, fish sauce and brown sugar and bring to a gentle simmer.
3. Add the eggplant and simmer for 8 minutes.
4. Add the bell pepper, green beans and snap peas and cook for 5 minutes, until just tender.
5. Stir in the lime juice and thai basil. Taste and adjust with more fish sauce or sugar.
6. Serve over jasmine rice.`,
  },
  {
    image: 'cookies',
    rating: 5,
    difficulty: 'easy',
    tags: ['Dessert', 'Baking'],
    folders: ['Baking'],
    favorite: true,
    prep: m(20),
    cook: m(12),
    text: `Brown Butter Chocolate Chip Cookies
Nutty brown butter and a pinch of flaky salt make these the cookies everyone asks for.
Makes 24 cookies

Ingredients
1 cup unsalted butter
1 cup brown sugar
½ cup granulated sugar
2 large eggs
2 tsp vanilla extract
2¼ cups all-purpose flour
1 tsp baking soda
1 tsp salt
2 cups chocolate chips
Flaky sea salt, for topping

Method
1. Melt the butter in a light-colored pan over medium heat. Keep cooking, swirling often, for 5 to 7 minutes until it smells nutty and turns golden brown. Cool for 15 minutes.
2. Whisk the brown butter with both sugars, then beat in the eggs and vanilla until glossy.
3. Stir in the flour, baking soda and salt, then fold in the chocolate chips.
4. Chill the dough for 30 minutes. Heat the oven to 350°F.
5. Scoop 2-tablespoon balls onto lined baking sheets, 2 inches apart.
6. Bake for 10 to 12 minutes, until the edges are set. Sprinkle with flaky salt and cool on the sheet for 5 minutes.`,
  },
  {
    image: 'shakshuka',
    rating: 4,
    difficulty: 'easy',
    tags: ['Breakfast', 'Vegetarian'],
    folders: ['Breakfast & Brunch', 'Weeknight'],
    prep: m(10),
    cook: m(25),
    text: `Smoky Shakshuka
Eggs gently poached in a spiced tomato and pepper sauce. Bring the pan to the table with plenty of bread.
Serves 3

Ingredients
2 tbsp olive oil
1 onion, diced
1 red bell pepper, diced
3 cloves garlic, minced
1 tsp smoked paprika
1 tsp ground cumin
¼ tsp cayenne
1 (28 oz) can crushed tomatoes
6 large eggs
½ cup crumbled feta
2 tbsp chopped parsley
Crusty bread, to serve

Method
1. Warm the olive oil in a large skillet over medium heat. Cook the onion and pepper for 8 minutes, until soft.
2. Add the garlic, smoked paprika, cumin and cayenne and cook for 1 minute.
3. Pour in the tomatoes, season with salt and simmer for 10 minutes, until thickened.
4. Make six wells in the sauce and crack an egg into each. Cover and cook for 6 to 8 minutes, until the whites are set.
5. Scatter with feta and parsley and serve straight from the pan with bread.`,
  },
  {
    image: 'miso-salmon',
    rating: 4,
    difficulty: 'easy',
    tags: ['Dinner', 'Fish'],
    folders: ['Dinners', 'Weeknight'],
    prep: m(10),
    cook: m(12),
    text: `Miso Glazed Salmon
Sweet, salty and caramelized under the broiler in minutes.
Serves 2

Ingredients
2 salmon fillets
2 tbsp white miso
1 tbsp maple syrup
1 tbsp soy sauce
1 tsp rice vinegar
1 tsp grated ginger
1 tsp sesame oil
1 green onion, sliced
1 tsp sesame seeds

Method
1. Heat the broiler with a rack about 6 inches from the heat. Line a baking sheet with foil.
2. Whisk the miso, maple syrup, soy sauce, rice vinegar, ginger and sesame oil.
3. Pat the salmon dry, set it on the sheet and brush generously with the glaze.
4. Broil for 8 to 10 minutes, until the glaze is caramelized and the fish flakes easily.
5. Top with the green onion and sesame seeds.`,
  },
  {
    image: 'panzanella',
    rating: 3,
    difficulty: 'easy',
    tags: ['Lunch', 'Salad', 'Vegetarian'],
    folders: ['Summer'],
    prep: m(20),
    cook: m(10),
    text: `Summer Panzanella
A Tuscan bread salad that turns day-old bread and peak-season tomatoes into lunch.
Serves 4

Ingredients
4 cups day-old bread, torn into pieces
4 tbsp olive oil
1½ lb ripe tomatoes, cut into chunks
1 cucumber, sliced
½ red onion, thinly sliced
1 tbsp capers
2 tbsp red wine vinegar
1 clove garlic, grated
1 handful basil leaves
Salt and pepper, to taste

Method
1. Toss the bread with 2 tablespoons of olive oil and toast in a skillet over medium heat for 8 to 10 minutes, until golden.
2. Combine the tomatoes, cucumber, onion and capers in a large bowl with a big pinch of salt. Let stand for 10 minutes to release their juices.
3. Whisk the vinegar, garlic and remaining olive oil, then pour over the tomatoes.
4. Fold in the toasted bread and basil. Rest for 15 minutes so the bread soaks up the dressing, then serve.`,
  },
];

export const SEED_FOLDERS = ['Dinners', 'Weeknight', 'Breakfast & Brunch', 'Baking', 'Sunday Cooking', 'Summer'];

export function seedDatabase(db: Database): void {
  const folderIds = new Map<string, string>();
  for (const name of SEED_FOLDERS) folderIds.set(name, db.folders.create(name).id);
  const created = SEED_RECIPES.map((seed, index) => {
    const draft = parseRecipeText(seed.text);
    const recipe = db.recipes.createFromDraft(draft, {
      tags: seed.tags,
      folderIds: seed.folders.map((f) => folderIds.get(f)!).filter(Boolean),
      favorite: !!seed.favorite,
      sourceName: seed.sourceName ?? 'Gather Kitchen',
      ...(seed.prep ? { prepSeconds: seed.prep } : {}),
      ...(seed.cook ? { cookSeconds: seed.cook } : {}),
      ...(seed.rating ? { rating: seed.rating } : {}),
      ...(seed.difficulty ? { difficulty: seed.difficulty } : {}),
      images: seed.image ? [{ id: `seed-${seed.image}`, uri: `asset://seed/${seed.image}` }] : [],
      // Stagger creation times so "Recently added" has a stable order.
      createdAt: new Date(Date.now() - index * 3_600_000).toISOString(),
    });
    return recipe;
  });
  // A few dinners on the plan this week so the planner has something to show.
  const today = dayKey(new Date());
  const dinners = created.filter((r) => r.tags.includes('Dinner'));
  dinners.slice(0, 3).forEach((recipe, i) => db.planner.add(addDays(today, i), 'dinner', { recipeId: recipe.id }));
  const breakfast = created.find((r) => r.tags.includes('Breakfast'));
  if (breakfast) db.planner.add(addDays(today, 1), 'breakfast', { recipeId: breakfast.id });
}
