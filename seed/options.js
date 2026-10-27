'use strict';

/* Option groups shared by the menus. 'one' groups are required and take one choice (the first
   is not pre-selected in the dish window); 'many' groups are optional, up to max. Prices in cents. */

module.exports = {
  size: {key: 'size', name: 'Size', type: 'one', choices: [{id: '30', name: '30 cm', price: 0}, {id: '40', name: '40 cm', price: 400}]},
  pizzaExtras: {key: 'pizzaExtras', name: 'Extras', type: 'many', max: 4, choices: [{id: 'moz', name: 'Extra mozzarella', price: 150}, {id: 'burrata', name: 'Burrata', price: 350}, {id: 'nduja', name: 'Spicy nduja', price: 200}, {id: 'chili', name: 'Chili oil', price: 50}]},
  burgerExtras: {key: 'burgerExtras', name: 'Add to your burger', type: 'many', max: 4, choices: [{id: 'patty', name: 'Extra patty', price: 250}, {id: 'bacon', name: 'Crispy bacon', price: 180}, {id: 'cheese', name: 'Extra cheese', price: 100}, {id: 'jala', name: 'Jalapeños', price: 80}]},
  sauce: {key: 'sauce', name: 'Sauce', type: 'one', choices: [{id: 'house', name: 'House sauce', price: 0}, {id: 'bbq', name: 'Smoky BBQ', price: 0}, {id: 'garlic', name: 'Garlic mayo', price: 0}, {id: 'honey', name: 'Hot honey', price: 0}]},
  fries: {key: 'fries', name: 'Style', type: 'one', choices: [{id: 'classic', name: 'Classic', price: 0}, {id: 'truffle', name: 'Truffle and parmesan', price: 150}, {id: 'cheese', name: 'Cheese sauce', price: 150}]},
  spice: {key: 'spice', name: 'Spice level', type: 'one', choices: [{id: 'mild', name: 'Mild', price: 0}, {id: 'medium', name: 'Medium', price: 0}, {id: 'hot', name: 'Hot', price: 0}]},
  ramenExtras: {key: 'ramenExtras', name: 'Extras', type: 'many', max: 4, choices: [{id: 'egg', name: 'Extra soft egg', price: 150}, {id: 'noodles', name: 'Extra noodles', price: 200}, {id: 'chashu', name: 'Chashu pork', price: 300}, {id: 'corn', name: 'Butter corn', price: 100}]},
  base: {key: 'base', name: 'Base', type: 'one', choices: [{id: 'sushi', name: 'Sushi rice', price: 0}, {id: 'brown', name: 'Brown rice', price: 0}, {id: 'greens', name: 'Mixed greens', price: 0}]},
  bowlExtras: {key: 'bowlExtras', name: 'Extras', type: 'many', max: 3, choices: [{id: 'avo', name: 'Extra avocado', price: 150}, {id: 'protein', name: 'Double protein', price: 300}, {id: 'edamame', name: 'Edamame', price: 80}]},
  tortilla: {key: 'tortilla', name: 'Tortilla', type: 'one', choices: [{id: 'corn', name: 'Corn', price: 0}, {id: 'flour', name: 'Flour', price: 0}]},
  salsa: {key: 'salsa', name: 'Salsa', type: 'one', choices: [{id: 'verde', name: 'Salsa verde', price: 0}, {id: 'roja', name: 'Salsa roja', price: 0}, {id: 'habanero', name: 'Habanero', price: 0}]},
  gelato: {key: 'gelato', name: 'Flavour', type: 'one', choices: [{id: 'pistachio', name: 'Pistachio', price: 0}, {id: 'choc', name: 'Dark chocolate', price: 0}, {id: 'straw', name: 'Strawberry', price: 0}, {id: 'fior', name: 'Fior di latte', price: 0}]},
  eggs: {key: 'eggs', name: 'Topping', type: 'one', choices: [{id: 'ham', name: 'Smoked ham', price: 0}, {id: 'salmon', name: 'Smoked salmon', price: 200}, {id: 'spinach', name: 'Spinach', price: 0}]},
  pancake: {key: 'pancake', name: 'Topping', type: 'one', choices: [{id: 'maple', name: 'Maple and butter', price: 0}, {id: 'berries', name: 'Berries and yoghurt', price: 0}, {id: 'choc', name: 'Chocolate and banana', price: 100}]},
  milk: {key: 'milk', name: 'Milk', type: 'one', choices: [{id: 'whole', name: 'Whole milk', price: 0}, {id: 'oat', name: 'Oat', price: 40}, {id: 'almond', name: 'Almond', price: 40}]},
  heat: {key: 'heat', name: 'Heat', type: 'one', choices: [{id: 'mild', name: 'Mild', price: 0}, {id: 'medium', name: 'Medium', price: 0}, {id: 'hot', name: 'Hot', price: 0}, {id: 'vhot', name: 'Very hot', price: 0}]},
  side: {key: 'side', name: 'Served with', type: 'one', choices: [{id: 'rice', name: 'Basmati rice', price: 0}, {id: 'naan', name: 'Garlic naan', price: 50}, {id: 'both', name: 'Rice and naan', price: 250}]},

  /* Added with the fuller menus */
  sodaSize: { key: 'sodaSize', name: 'Size', type: 'one', choices: [{ id: 'small', name: '330 ml', price: 0 }, { id: 'large', name: '500 ml', price: 100 }] },
  coffeeSize: { key: 'coffeeSize', name: 'Size', type: 'one', choices: [{ id: 'regular', name: 'Regular', price: 0 }, { id: 'large', name: 'Large', price: 60 }] },
  dip: { key: 'dip', name: 'Dip', type: 'one', choices: [{ id: 'aioli', name: 'Garlic aioli', price: 0 }, { id: 'chilimayo', name: 'Chili mayo', price: 0 }, { id: 'ketchup', name: 'Tomato ketchup', price: 0 }, { id: 'bbq', name: 'Smoky BBQ', price: 0 }] },
  pastaExtras: { key: 'pastaExtras', name: 'Extras', type: 'many', max: 3, choices: [{ id: 'parmesan', name: 'Extra parmesan', price: 100 }, { id: 'burrata', name: 'Burrata', price: 350 }, { id: 'guanciale', name: 'Crispy guanciale', price: 250 }, { id: 'chili', name: 'Chili flakes', price: 0 }] },
  sushiExtras: { key: 'sushiExtras', name: 'Extras', type: 'many', max: 3, choices: [{ id: 'ginger', name: 'Extra pickled ginger', price: 50 }, { id: 'wasabi', name: 'Extra wasabi', price: 50 }, { id: 'spicymayo', name: 'Spicy mayo', price: 80 }, { id: 'eel', name: 'Eel sauce', price: 80 }] },
  tacoExtras: { key: 'tacoExtras', name: 'Extras', type: 'many', max: 3, choices: [{ id: 'guac', name: 'Guacamole', price: 150 }, { id: 'cheese', name: 'Extra cheese', price: 100 }, { id: 'jalapenos', name: 'Pickled jalapeños', price: 50 }, { id: 'sourcream', name: 'Sour cream', price: 80 }] },
  curryExtras: { key: 'curryExtras', name: 'Extras', type: 'many', max: 2, choices: [{ id: 'paneer', name: 'Extra paneer', price: 200 }, { id: 'chicken', name: 'Extra chicken', price: 250 }, { id: 'raita', name: 'Side of raita', price: 150 }] },
  dessertExtras: { key: 'dessertExtras', name: 'Add', type: 'many', max: 2, choices: [{ id: 'gelato', name: 'Scoop of fior di latte gelato', price: 200 }, { id: 'cream', name: 'Whipped cream', price: 80 }, { id: 'sauce', name: 'Extra chocolate sauce', price: 80 }] },
  protein: { key: 'protein', name: 'Protein', type: 'one', choices: [{ id: 'chicken', name: 'Chipotle chicken', price: 0 }, { id: 'beef', name: 'Barbacoa beef', price: 100 }, { id: 'veg', name: 'Fajita vegetables', price: 0 }] },
  toastBread: { key: 'toastBread', name: 'Bread', type: 'one', choices: [{ id: 'sourdough', name: 'Sourdough', price: 0 }, { id: 'rye', name: 'Rye', price: 0 }, { id: 'gf', name: 'Gluten-free bread', price: 100 }] },
  eggsWay: { key: 'eggsWay', name: 'Eggs', type: 'one', choices: [{ id: 'fried', name: 'Fried eggs', price: 0 }, { id: 'scrambled', name: 'Scrambled eggs', price: 0 }, { id: 'poached', name: 'Poached eggs', price: 0 }] },
  sweetness: { key: 'sweetness', name: 'Sweetness', type: 'one', choices: [{ id: 'regular', name: 'Regular', price: 0 }, { id: 'less', name: 'Less sweet', price: 0 }, { id: 'none', name: 'No sugar', price: 0 }] },
  sorbetFlavour: { key: 'sorbetFlavour', name: 'Flavour', type: 'one', choices: [{ id: 'mango', name: 'Mango', price: 0 }, { id: 'raspberry', name: 'Raspberry', price: 0 }, { id: 'lemon', name: 'Lemon', price: 0 }] }
};
