/**
 * Grocery aisles and ingredient-to-aisle lookup. Aisles are ordered the way
 * a typical store is walked; users can reorder them in settings.
 */

export interface Aisle {
  id: string;
  name: string;
  /** Icon name from the app icon set. */
  icon: string;
}

export const AISLES: readonly Aisle[] = [
  { id: 'produce', name: 'Produce', icon: 'leaf' },
  { id: 'bakery', name: 'Bakery', icon: 'baguette' },
  { id: 'meat', name: 'Meat & Seafood', icon: 'fish' },
  { id: 'dairy', name: 'Dairy & Eggs', icon: 'egg' },
  { id: 'pantry', name: 'Pantry', icon: 'jar' },
  { id: 'baking', name: 'Baking', icon: 'whisk' },
  { id: 'spices', name: 'Spices & Seasonings', icon: 'salt' },
  { id: 'international', name: 'International', icon: 'globe' },
  { id: 'frozen', name: 'Frozen', icon: 'snowflake' },
  { id: 'drinks', name: 'Drinks', icon: 'cup' },
  { id: 'household', name: 'Household', icon: 'home' },
  { id: 'other', name: 'Other', icon: 'cart' },
];

export const DEFAULT_AISLE_ORDER: readonly string[] = AISLES.map((a) => a.id);

/**
 * Keyword table. Multi-word keywords are checked before single words, so
 * "coconut milk" lands in international, not dairy, and "garlic powder" in
 * spices, not produce.
 */
const KEYWORDS: Record<string, string[]> = {
  spices: [
    'garlic powder', 'onion powder', 'chili powder', 'chilli powder', 'curry powder', 'smoked paprika', 'black pepper',
    'red pepper flakes', 'chili flakes', 'chilli flakes', 'italian seasoning', 'bay leaf', 'bay leaves', 'kosher salt',
    'sea salt', 'salt', 'pepper', 'peppercorns', 'paprika', 'cumin', 'coriander seed', 'turmeric', 'cinnamon', 'nutmeg',
    'cloves', 'cardamom', 'oregano', 'thyme dried', 'dried thyme', 'dried oregano', 'dried basil', 'cayenne', 'allspice',
    'garam masala', 'fennel seed', 'mustard seed', 'saffron', 'star anise', 'za\'atar', 'sumac', 'five spice', 'seasoning',
  ],
  baking: [
    'baking powder', 'baking soda', 'bicarbonate', 'cornstarch', 'cornflour', 'cocoa powder', 'cocoa', 'chocolate chips',
    'brown sugar', 'powdered sugar', 'icing sugar', 'caster sugar', 'granulated sugar', 'confectioners sugar', 'sugar',
    'flour', 'yeast', 'vanilla', 'gelatin', 'sprinkles', 'food coloring', 'molasses', 'chocolate', 'almond flour',
  ],
  international: [
    'coconut milk', 'coconut cream', 'soy sauce', 'fish sauce', 'oyster sauce', 'hoisin', 'sriracha', 'gochujang', 'miso',
    'mirin', 'sake', 'rice vinegar', 'sesame oil', 'curry paste', 'tahini', 'harissa', 'tortillas', 'tortilla', 'salsa',
    'nori', 'kimchi', 'rice noodles', 'udon', 'ramen', 'tamari', 'chipotle', 'enchilada sauce', 'garam',
  ],
  dairy: [
    'heavy cream', 'whipping cream', 'sour cream', 'cream cheese', 'cottage cheese', 'greek yogurt', 'buttermilk',
    'milk', 'butter', 'cream', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'parmigiano', 'feta', 'ricotta', 'yogurt',
    'yoghurt', 'egg', 'eggs', 'ghee', 'mascarpone', 'brie', 'gruyere', 'goat cheese', 'creme fraiche', 'half-and-half',
  ],
  meat: [
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham', 'prosciutto', 'pancetta', 'chorizo', 'steak',
    'mince', 'ground beef', 'ground pork', 'ground turkey', 'salmon', 'tuna steak', 'cod', 'shrimp', 'prawns', 'prawn',
    'fish', 'scallops', 'mussels', 'clams', 'crab', 'lobster', 'anchovy', 'anchovies', 'duck', 'veal', 'brisket', 'ribs',
  ],
  bakery: ['bread', 'baguette', 'buns', 'bun', 'rolls', 'pita', 'naan', 'croissant', 'brioche', 'bagel', 'sourdough', 'breadcrumbs', 'panko'],
  frozen: ['frozen', 'ice cream', 'puff pastry', 'phyllo', 'filo'],
  drinks: ['wine', 'beer', 'juice', 'soda', 'sparkling water', 'coffee', 'tea', 'espresso', 'vodka', 'rum', 'whiskey', 'bourbon', 'tequila', 'gin', 'brandy'],
  household: ['paper towels', 'foil', 'aluminum foil', 'parchment', 'plastic wrap', 'baking paper', 'zip bags', 'toothpicks', 'skewers'],
  pantry: [
    'olive oil', 'vegetable oil', 'canola oil', 'oil', 'vinegar', 'balsamic', 'stock', 'broth', 'bouillon', 'pasta',
    'spaghetti', 'penne', 'macaroni', 'noodles', 'rice', 'quinoa', 'couscous', 'oats', 'lentils', 'chickpeas', 'beans',
    'tomato paste', 'tomato sauce', 'canned tomatoes', 'crushed tomatoes', 'diced tomatoes', 'passata', 'honey',
    'maple syrup', 'peanut butter', 'jam', 'mustard', 'mayonnaise', 'mayo', 'ketchup', 'worcestershire', 'hot sauce',
    'nuts', 'almonds', 'walnuts', 'pecans', 'cashews', 'peanuts', 'pine nuts', 'raisins', 'dried', 'cereal', 'crackers',
    'capers', 'olives', 'pickles', 'tuna', 'sesame seeds', 'chia', 'flaxseed', 'syrup', 'cornmeal', 'polenta',
  ],
  produce: [
    'garlic', 'onion', 'onions', 'shallot', 'scallion', 'spring onion', 'green onion', 'leek', 'ginger', 'tomato',
    'tomatoes', 'potato', 'potatoes', 'sweet potato', 'carrot', 'carrots', 'celery', 'bell pepper', 'jalapeño', 'jalapeno',
    'chili', 'chilli', 'cucumber', 'zucchini', 'courgette', 'eggplant', 'aubergine', 'squash', 'pumpkin', 'broccoli',
    'cauliflower', 'cabbage', 'kale', 'spinach', 'lettuce', 'arugula', 'rocket', 'mushroom', 'mushrooms', 'corn', 'peas',
    'green beans', 'asparagus', 'avocado', 'lemon', 'lime', 'orange', 'apple', 'banana', 'berries', 'strawberries',
    'blueberries', 'raspberries', 'grapes', 'pear', 'peach', 'mango', 'pineapple', 'cherries', 'basil', 'parsley',
    'cilantro', 'coriander', 'mint', 'dill', 'rosemary', 'thyme', 'sage', 'chives', 'herbs', 'beet', 'radish', 'fennel',
  ],
};

const ENTRIES: Array<[string, string]> = Object.entries(KEYWORDS)
  .flatMap(([aisle, words]) => words.map((w): [string, string] => [w, aisle]))
  .sort((a, b) => b[0].length - a[0].length);

/** The aisle for an ingredient name ("baby spinach" -> produce). */
export function aisleFor(name: string): string {
  const text = ` ${name.toLowerCase().replace(/[^\p{L}\p{N}' -]/gu, ' ').replace(/\s+/g, ' ')} `;
  for (const [keyword, aisle] of ENTRIES) {
    if (text.includes(` ${keyword} `)) return aisle;
  }
  return 'other';
}

export function aisleById(id: string): Aisle {
  return AISLES.find((a) => a.id === id) ?? AISLES[AISLES.length - 1]!;
}
