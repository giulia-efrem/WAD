'use strict';

/* The catalog from reference/morsel.html. Money is in cents, hours in minutes after midnight
   (close may go past 1440 for places open after midnight). Items list option group keys,
   which seed.js expands into full option groups from OPTION_GROUPS. */

const OPTION_GROUPS = {
  size: { key: 'size', name: 'Size', type: 'one', choices: [{ id: '30', name: '30 cm', price: 0 }, { id: '40', name: '40 cm', price: 400 }] },
  pizzaExtras: { key: 'pizzaExtras', name: 'Extras', type: 'many', max: 4, choices: [{ id: 'moz', name: 'Extra mozzarella', price: 150 }, { id: 'burrata', name: 'Burrata', price: 350 }, { id: 'nduja', name: 'Spicy nduja', price: 200 }, { id: 'chili', name: 'Chili oil', price: 50 }] },
  burgerExtras: { key: 'burgerExtras', name: 'Add to your burger', type: 'many', max: 4, choices: [{ id: 'patty', name: 'Extra patty', price: 250 }, { id: 'bacon', name: 'Crispy bacon', price: 180 }, { id: 'cheese', name: 'Extra cheese', price: 100 }, { id: 'jala', name: 'Jalapeños', price: 80 }] },
  sauce: { key: 'sauce', name: 'Sauce', type: 'one', choices: [{ id: 'house', name: 'House sauce', price: 0 }, { id: 'bbq', name: 'Smoky BBQ', price: 0 }, { id: 'garlic', name: 'Garlic mayo', price: 0 }, { id: 'honey', name: 'Hot honey', price: 0 }] },
  fries: { key: 'fries', name: 'Style', type: 'one', choices: [{ id: 'classic', name: 'Classic', price: 0 }, { id: 'truffle', name: 'Truffle and parmesan', price: 150 }, { id: 'cheese', name: 'Cheese sauce', price: 150 }] },
  spice: { key: 'spice', name: 'Spice level', type: 'one', choices: [{ id: 'mild', name: 'Mild', price: 0 }, { id: 'medium', name: 'Medium', price: 0 }, { id: 'hot', name: 'Hot', price: 0 }] },
  ramenExtras: { key: 'ramenExtras', name: 'Extras', type: 'many', max: 4, choices: [{ id: 'egg', name: 'Extra soft egg', price: 150 }, { id: 'noodles', name: 'Extra noodles', price: 200 }, { id: 'chashu', name: 'Chashu pork', price: 300 }, { id: 'corn', name: 'Butter corn', price: 100 }] },
  base: { key: 'base', name: 'Base', type: 'one', choices: [{ id: 'sushi', name: 'Sushi rice', price: 0 }, { id: 'brown', name: 'Brown rice', price: 0 }, { id: 'greens', name: 'Mixed greens', price: 0 }] },
  bowlExtras: { key: 'bowlExtras', name: 'Extras', type: 'many', max: 3, choices: [{ id: 'avo', name: 'Extra avocado', price: 150 }, { id: 'protein', name: 'Double protein', price: 300 }, { id: 'edamame', name: 'Edamame', price: 80 }] },
  tortilla: { key: 'tortilla', name: 'Tortilla', type: 'one', choices: [{ id: 'corn', name: 'Corn', price: 0 }, { id: 'flour', name: 'Flour', price: 0 }] },
  salsa: { key: 'salsa', name: 'Salsa', type: 'one', choices: [{ id: 'verde', name: 'Salsa verde', price: 0 }, { id: 'roja', name: 'Salsa roja', price: 0 }, { id: 'habanero', name: 'Habanero', price: 0 }] },
  gelato: { key: 'gelato', name: 'Flavour', type: 'one', choices: [{ id: 'pistachio', name: 'Pistachio', price: 0 }, { id: 'choc', name: 'Dark chocolate', price: 0 }, { id: 'straw', name: 'Strawberry', price: 0 }, { id: 'fior', name: 'Fior di latte', price: 0 }] },
  eggs: { key: 'eggs', name: 'Topping', type: 'one', choices: [{ id: 'ham', name: 'Smoked ham', price: 0 }, { id: 'salmon', name: 'Smoked salmon', price: 200 }, { id: 'spinach', name: 'Spinach', price: 0 }] },
  pancake: { key: 'pancake', name: 'Topping', type: 'one', choices: [{ id: 'maple', name: 'Maple and butter', price: 0 }, { id: 'berries', name: 'Berries and yoghurt', price: 0 }, { id: 'choc', name: 'Chocolate and banana', price: 100 }] },
  milk: { key: 'milk', name: 'Milk', type: 'one', choices: [{ id: 'whole', name: 'Whole milk', price: 0 }, { id: 'oat', name: 'Oat', price: 40 }, { id: 'almond', name: 'Almond', price: 40 }] },
  heat: { key: 'heat', name: 'Heat', type: 'one', choices: [{ id: 'mild', name: 'Mild', price: 0 }, { id: 'medium', name: 'Medium', price: 0 }, { id: 'hot', name: 'Hot', price: 0 }, { id: 'vhot', name: 'Very hot', price: 0 }] },
  side: { key: 'side', name: 'Served with', type: 'one', choices: [{ id: 'rice', name: 'Basmati rice', price: 0 }, { id: 'naan', name: 'Garlic naan', price: 50 }, { id: 'both', name: 'Rice and naan', price: 250 }] }
};

const RESTAURANTS = [
  {
    slug: 'forno-sette',
    name: 'Forno Sette',
    cuisines: ['pizza'],
    label: 'Pizza',
    tagline: 'Neapolitan pizza, ninety seconds in a wood oven',
    priceLevel: '€€',
    rating: 4.8,
    reviewCount: 2140,
    eta: { min: 25, max: 35 },
    deliveryFee: 149,
    minOrder: 1000,
    hours: [{ open: 660, close: 1500 }],
    color: '#FFE2D1',
    ink: '#8A3413',
    illustration: 'pizza',
    menu: [
      { category: 'Pizza', items: [
        { slug: 'margherita', name: 'Margherita', description: 'San Marzano tomato, fior di latte, basil and Ligurian olive oil.', price: 950, popular: true, options: ['size', 'pizzaExtras'] },
        { slug: 'diavola', name: 'Diavola', description: 'Tomato, mozzarella, spicy salami and a drizzle of hot honey.', price: 1150, popular: true, options: ['size', 'pizzaExtras'] },
        { slug: 'formaggi', name: 'Quattro formaggi', description: 'Mozzarella, gorgonzola, taleggio and parmesan on a white base.', price: 1200, popular: false, options: ['size', 'pizzaExtras'] },
        { slug: 'funghi', name: 'Funghi e salsiccia', description: 'Roasted mushrooms, fennel sausage, mozzarella and thyme.', price: 1250, popular: false, options: ['size', 'pizzaExtras'] },
        { slug: 'marinara', name: 'Marinara', description: 'No cheese. Tomato, garlic, oregano and olive oil. Vegan.', price: 800, popular: false, options: ['size'] }
      ] },
      { category: 'Starters', items: [
        { slug: 'burrata', name: 'Burrata and tomatoes', description: 'Creamy burrata, heritage tomatoes, basil oil and sea salt.', price: 850, popular: false, options: [] },
        { slug: 'focaccia', name: 'Garlic focaccia', description: 'Fresh from the oven with rosemary and garlic butter.', price: 450, popular: false, options: [] }
      ] },
      { category: 'Desserts and drinks', items: [
        { slug: 'tiramisu', name: 'Tiramisu', description: 'Mascarpone, espresso-soaked savoiardi, cocoa.', price: 550, popular: true, options: [] },
        { slug: 'pellegrino', name: 'Sparkling water 0.5 l', description: 'San Pellegrino.', price: 250, popular: false, options: [] }
      ] }
    ]
  },
  {
    slug: 'smash-society',
    name: 'Smash Society',
    cuisines: ['burgers'],
    label: 'Burgers',
    tagline: 'Crispy-edged smash burgers, any hour of the day',
    priceLevel: '€€',
    rating: 4.6,
    reviewCount: 3410,
    eta: { min: 20, max: 30 },
    deliveryFee: 0,
    minOrder: 1200,
    hours: [{ open: 0, close: 1440 }],
    color: '#FFE9B8',
    ink: '#8A5A0B',
    illustration: 'burger',
    menu: [
      { category: 'Burgers', items: [
        { slug: 'classic', name: 'Classic smash', description: 'Two smashed beef patties, American cheese, pickles, onion and house sauce.', price: 990, popular: true, options: ['sauce', 'burgerExtras'] },
        { slug: 'double', name: 'Double trouble', description: 'Four patties, four slices of cheese. Not for the faint-hearted.', price: 1290, popular: false, options: ['sauce', 'burgerExtras'] },
        { slug: 'hothoney', name: 'Hot honey chicken', description: 'Buttermilk fried chicken, hot honey, slaw and pickles.', price: 1090, popular: true, options: ['burgerExtras'] },
        { slug: 'mushroom', name: 'Mushroom melt', description: 'Crispy portobello, Swiss cheese, caramelised onion. Vegetarian.', price: 1050, popular: false, options: ['sauce'] }
      ] },
      { category: 'Sides', items: [
        { slug: 'fries', name: 'Fries', description: 'Skin-on, double-cooked and salted.', price: 350, popular: true, options: ['fries'] },
        { slug: 'rings', name: 'Onion rings', description: 'Beer-battered with chipotle dip.', price: 420, popular: false, options: [] }
      ] },
      { category: 'Shakes', items: [
        { slug: 'vanilla', name: 'Vanilla shake', description: 'Thick, cold and made with real vanilla.', price: 490, popular: false, options: [] },
        { slug: 'caramel', name: 'Salted caramel shake', description: 'With a drizzle of caramel and flaky salt.', price: 540, popular: false, options: [] }
      ] }
    ]
  },
  {
    slug: 'bao-and-broth',
    name: 'Bao & Broth',
    cuisines: ['asian'],
    label: 'Ramen and bao',
    tagline: '18-hour broths and pillowy steamed buns',
    priceLevel: '€€',
    rating: 4.9,
    reviewCount: 1320,
    eta: { min: 30, max: 40 },
    deliveryFee: 199,
    minOrder: 1200,
    hours: [{ open: 720, close: 1410 }],
    color: '#DCE8FB',
    ink: '#24406F',
    illustration: 'ramen',
    menu: [
      { category: 'Ramen', items: [
        { slug: 'tonkotsu', name: 'Tonkotsu ramen', description: 'Rich pork broth, chashu, soft egg, nori and spring onion.', price: 1350, popular: true, options: ['spice', 'ramenExtras'] },
        { slug: 'miso', name: 'Spicy miso ramen', description: 'Miso and chili broth, minced pork, corn, beansprouts.', price: 1390, popular: true, options: ['spice', 'ramenExtras'] },
        { slug: 'shoyu', name: 'Shoyu chicken ramen', description: 'Clear soy broth, chicken thigh, bamboo shoots, egg.', price: 1290, popular: false, options: ['ramenExtras'] },
        { slug: 'tantan', name: 'Vegan tantanmen', description: 'Sesame and soy milk broth, spiced tofu, bok choy.', price: 1250, popular: false, options: ['spice', 'ramenExtras'] }
      ] },
      { category: 'Bao and small plates', items: [
        { slug: 'porkbao', name: 'Pork belly bao (2)', description: 'Braised pork belly, peanut crumb, pickled cucumber, coriander.', price: 750, popular: true, options: [] },
        { slug: 'tofubao', name: 'Crispy tofu bao (2)', description: 'Sticky glazed tofu, kimchi mayo, spring onion.', price: 690, popular: false, options: [] },
        { slug: 'gyoza', name: 'Pork gyoza (6)', description: 'Pan-fried dumplings with black vinegar dip.', price: 650, popular: false, options: [] },
        { slug: 'edamame', name: 'Edamame', description: 'Steamed with sea salt and chili.', price: 400, popular: false, options: [] }
      ] },
      { category: 'Sweet', items: [
        { slug: 'matcha', name: 'Matcha cheesecake', description: 'Light, creamy and not too sweet.', price: 550, popular: false, options: [] }
      ] }
    ]
  },
  {
    slug: 'kaze-sushi',
    name: 'Kaze Sushi',
    cuisines: ['sushi'],
    label: 'Sushi',
    tagline: 'Rolls and nigiri cut to order',
    priceLevel: '€€€',
    rating: 4.9,
    reviewCount: 760,
    eta: { min: 30, max: 40 },
    deliveryFee: 249,
    minOrder: 1500,
    hours: [{ open: 720, close: 1380 }],
    color: '#DDF1EE',
    ink: '#1E5A50',
    illustration: 'sushi',
    menu: [
      { category: 'Sets', items: [
        { slug: 'kazeset', name: 'Kaze set (16 pieces)', description: 'Chef’s mix of nigiri, maki and one signature roll.', price: 2190, popular: true, options: [] },
        { slug: 'salmonset', name: 'Salmon lover set (12 pieces)', description: 'Salmon nigiri, salmon maki and salmon avocado uramaki.', price: 1750, popular: false, options: [] }
      ] },
      { category: 'Rolls', items: [
        { slug: 'dragon', name: 'Dragon roll (8)', description: 'Prawn tempura, avocado, eel sauce and toasted sesame.', price: 1290, popular: true, options: [] },
        { slug: 'california', name: 'California roll (8)', description: 'Crab, avocado, cucumber and tobiko.', price: 950, popular: false, options: [] },
        { slug: 'spicytuna', name: 'Spicy tuna roll (8)', description: 'Tuna, chili mayo, spring onion and tempura flakes.', price: 1090, popular: false, options: [] }
      ] },
      { category: 'Nigiri and more', items: [
        { slug: 'nigiri', name: 'Salmon nigiri (2)', description: 'Norwegian salmon on seasoned rice.', price: 520, popular: false, options: [] },
        { slug: 'misosoup', name: 'Miso soup', description: 'Tofu, wakame and spring onion.', price: 350, popular: false, options: [] },
        { slug: 'wakame', name: 'Wakame salad', description: 'Seaweed with sesame dressing.', price: 450, popular: false, options: [] }
      ] }
    ]
  },
  {
    slug: 'green-theory',
    name: 'Green Theory',
    cuisines: ['healthy'],
    label: 'Healthy bowls',
    tagline: 'Big bowls that actually keep you full',
    priceLevel: '€€',
    rating: 4.7,
    reviewCount: 980,
    eta: { min: 15, max: 25 },
    deliveryFee: 99,
    minOrder: 1000,
    hours: [{ open: 540, close: 1320 }],
    color: '#DDF3E1',
    ink: '#2C6B35',
    illustration: 'bowl',
    menu: [
      { category: 'Bowls', items: [
        { slug: 'poke', name: 'Salmon poke', description: 'Salmon, avocado, edamame, mango, pickled ginger and ponzu.', price: 1290, popular: true, options: ['base', 'bowlExtras'] },
        { slug: 'falafel', name: 'Falafel and hummus', description: 'Baked falafel, hummus, tabbouleh, pickled red onion. Vegan.', price: 1090, popular: false, options: ['base', 'bowlExtras'] },
        { slug: 'teriyaki', name: 'Teriyaki chicken', description: 'Grilled chicken, broccoli, carrot, sesame and teriyaki glaze.', price: 1190, popular: true, options: ['base', 'bowlExtras'] },
        { slug: 'acai', name: 'Açaí bowl', description: 'Açaí, banana, granola, berries and coconut.', price: 890, popular: false, options: [] }
      ] },
      { category: 'Drinks', items: [
        { slug: 'greenjuice', name: 'Green juice', description: 'Apple, cucumber, spinach, lime and ginger. Cold-pressed.', price: 490, popular: false, options: [] },
        { slug: 'shot', name: 'Ginger shot', description: 'Ginger, lemon and a little cayenne.', price: 250, popular: false, options: [] }
      ] }
    ]
  },
  {
    slug: 'taqueria-luna',
    name: 'Taquería Luna',
    cuisines: ['mexican'],
    label: 'Mexican',
    tagline: 'Tacos on handmade tortillas until late',
    priceLevel: '€',
    rating: 4.7,
    reviewCount: 1580,
    eta: { min: 25, max: 35 },
    deliveryFee: 149,
    minOrder: 1000,
    hours: [{ open: 720, close: 1560 }],
    color: '#FFF0C4',
    ink: '#8A6410',
    illustration: 'taco',
    menu: [
      { category: 'Tacos', items: [
        { slug: 'pastor', name: 'Al pastor tacos (3)', description: 'Marinated pork, grilled pineapple, onion and coriander.', price: 950, popular: true, options: ['tortilla', 'salsa'] },
        { slug: 'birria', name: 'Birria tacos (3)', description: 'Slow-braised beef, melted cheese and a cup of consommé for dipping.', price: 1190, popular: true, options: ['tortilla'] },
        { slug: 'baja', name: 'Baja fish tacos (3)', description: 'Crispy fish, cabbage slaw, chipotle crema.', price: 1050, popular: false, options: ['tortilla', 'salsa'] },
        { slug: 'hongos', name: 'Mushroom tacos (3)', description: 'Roasted oyster mushrooms, black beans, salsa macha. Vegan.', price: 890, popular: false, options: ['tortilla', 'salsa'] }
      ] },
      { category: 'More', items: [
        { slug: 'burrito', name: 'Chicken burrito', description: 'Chipotle chicken, rice, beans, cheese and pico de gallo.', price: 1090, popular: false, options: ['salsa'] },
        { slug: 'nachos', name: 'Loaded nachos', description: 'Cheese sauce, jalapeños, guacamole and sour cream.', price: 850, popular: false, options: [] }
      ] },
      { category: 'Sweet and drinks', items: [
        { slug: 'churros', name: 'Churros', description: 'Cinnamon sugar with warm chocolate sauce.', price: 490, popular: false, options: [] },
        { slug: 'horchata', name: 'Horchata', description: 'Rice, cinnamon and vanilla over ice.', price: 350, popular: false, options: [] }
      ] }
    ]
  },
  {
    slug: 'sweet-spot',
    name: 'The Sweet Spot',
    cuisines: ['desserts'],
    label: 'Desserts',
    tagline: 'Cakes, pastries and gelato made each morning',
    priceLevel: '€€',
    rating: 4.8,
    reviewCount: 870,
    eta: { min: 20, max: 30 },
    deliveryFee: 0,
    minOrder: 800,
    hours: [{ open: 600, close: 1440 }],
    color: '#FCE0EC',
    ink: '#8A1F45',
    illustration: 'cupcake',
    menu: [
      { category: 'Cakes', items: [
        { slug: 'pistachio', name: 'Pistachio cheesecake', description: 'Baked cheesecake with a Sicilian pistachio cream top.', price: 620, popular: true, options: [] },
        { slug: 'lava', name: 'Chocolate lava cake', description: 'Warm with a molten centre. Arrives ready to eat.', price: 590, popular: true, options: [] },
        { slug: 'carrot', name: 'Carrot cake', description: 'Walnuts, warm spices and cream cheese frosting.', price: 520, popular: false, options: [] }
      ] },
      { category: 'Bakery', items: [
        { slug: 'cinnamon', name: 'Cinnamon roll', description: 'Soft, gooey and glazed.', price: 380, popular: false, options: [] },
        { slug: 'macarons', name: 'Macarons (6)', description: 'Raspberry, pistachio, salted caramel and more.', price: 900, popular: false, options: [] }
      ] },
      { category: 'Gelato', items: [
        { slug: 'gelato', name: 'Gelato tub 500 ml', description: 'Churned in-house. Pick your flavour.', price: 850, popular: false, options: ['gelato'] }
      ] }
    ]
  },
  {
    slug: 'morning-club',
    name: 'Morning Club',
    cuisines: ['breakfast'],
    label: 'Breakfast and brunch',
    tagline: 'All-day eggs and very good coffee, until 3 pm',
    priceLevel: '€€',
    rating: 4.6,
    reviewCount: 640,
    eta: { min: 20, max: 30 },
    deliveryFee: 99,
    minOrder: 1000,
    hours: [{ open: 420, close: 900 }],
    color: '#FFF4D6',
    ink: '#7A5A12',
    illustration: 'breakfast',
    menu: [
      { category: 'Breakfast', items: [
        { slug: 'benedict', name: 'Eggs Benedict', description: 'Poached eggs, toasted muffin and hollandaise.', price: 1050, popular: true, options: ['eggs'] },
        { slug: 'avotoast', name: 'Avocado toast', description: 'Sourdough, smashed avocado, feta, chili and lime.', price: 920, popular: false, options: [] },
        { slug: 'pancakes', name: 'Pancake stack', description: 'Three fluffy buttermilk pancakes.', price: 890, popular: true, options: ['pancake'] },
        { slug: 'shakshuka', name: 'Shakshuka', description: 'Eggs baked in spiced tomato with bread for dipping.', price: 990, popular: false, options: [] }
      ] },
      { category: 'Coffee and juice', items: [
        { slug: 'flatwhite', name: 'Flat white', description: 'Double shot, silky milk.', price: 340, popular: false, options: ['milk'] },
        { slug: 'oj', name: 'Fresh orange juice', description: 'Squeezed to order.', price: 390, popular: false, options: [] }
      ] }
    ]
  },
  {
    slug: 'spice-route',
    name: 'Spice Route',
    cuisines: ['indian'],
    label: 'Indian',
    tagline: 'Slow-cooked curries and charcoal tandoor',
    priceLevel: '€€',
    rating: 4.7,
    reviewCount: 1120,
    eta: { min: 35, max: 45 },
    deliveryFee: 199,
    minOrder: 1200,
    hours: [{ open: 660, close: 1740 }],
    color: '#FFE4CC',
    ink: '#8A3F10',
    illustration: 'curry',
    menu: [
      { category: 'Curries', items: [
        { slug: 'butterchicken', name: 'Butter chicken', description: 'Tandoori chicken in a silky tomato and butter sauce.', price: 1290, popular: true, options: ['heat', 'side'] },
        { slug: 'paneer', name: 'Paneer tikka masala', description: 'Charred paneer, peppers and onion in masala sauce.', price: 1190, popular: false, options: ['heat', 'side'] },
        { slug: 'roganjosh', name: 'Lamb rogan josh', description: 'Kashmiri chili, slow-braised lamb shoulder.', price: 1450, popular: false, options: ['heat', 'side'] },
        { slug: 'chana', name: 'Chana masala', description: 'Chickpeas, tomato, ginger and garam masala. Vegan.', price: 990, popular: false, options: ['heat', 'side'] }
      ] },
      { category: 'Rice and bread', items: [
        { slug: 'biryani', name: 'Chicken biryani', description: 'Layered basmati, saffron, fried onion and raita.', price: 1350, popular: true, options: ['heat'] },
        { slug: 'naan', name: 'Garlic naan', description: 'From the tandoor, brushed with garlic butter.', price: 320, popular: false, options: [] },
        { slug: 'rice', name: 'Basmati rice', description: 'Steamed with cumin.', price: 280, popular: false, options: [] }
      ] },
      { category: 'Drinks', items: [
        { slug: 'lassi', name: 'Mango lassi', description: 'Alphonso mango and yoghurt.', price: 390, popular: false, options: [] }
      ] }
    ]
  }
];

module.exports = { OPTION_GROUPS, RESTAURANTS };
