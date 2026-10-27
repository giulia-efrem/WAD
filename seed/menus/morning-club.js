'use strict';

const { dish, deal } = require('./_build');

const COFFEE = 'americano flatwhite:40 cappuccino:60 chai:80';

module.exports = {
  deals: [
    deal('brunch-deal', 'Brunch for one', 'Any breakfast plate, a coffee and a fresh juice.', 1350, [
      ['plate', 'Breakfast', 'pancakes avotoast:30 french-toast:60 shakshuka:100 benedict:160 veggie-breakfast:260 full-breakfast:400'],
      ['coffee', 'Coffee', COFFEE],
      ['juice', 'Juice', 'oj green-smoothie:130']
    ], { pop: true }),
    deal('bun-coffee', 'Bun and coffee', 'A breakfast bun or BLT with any coffee.', 890, [
      ['bun', 'Sandwich', 'breakfast-bun blt:100'],
      ['coffee', 'Coffee', COFFEE]
    ])
  ],
  categories: [
    { category: 'Breakfast', items: [
      dish('benedict', 'Eggs Benedict', 'Poached eggs, toasted muffin and hollandaise.', 1050, { pop: true, o: ['eggs'], i: 'Poached eggs, Toasted muffin, ~Hollandaise', a: 'gluten egg milk' }),
      dish('avotoast', 'Avocado toast', 'Sourdough, smashed avocado, feta, chili and lime.', 920, { o: ['toastBread'], i: 'Sourdough, Smashed avocado, ~Feta, ~Chili, ~Lime', t: 'v', a: 'gluten milk' }),
      dish('pancakes', 'Pancake stack', 'Three fluffy buttermilk pancakes.', 890, { pop: true, o: ['pancake'], i: 'Buttermilk pancakes', t: 'v', a: 'gluten egg milk' }),
      dish('shakshuka', 'Shakshuka', 'Eggs baked in spiced tomato with bread for dipping.', 990, { i: 'Baked eggs, Spiced tomato, ~Feta, ~Coriander, ~Bread for dipping', t: 'v sp', a: 'egg milk gluten' }),
      dish('full-breakfast', 'Full breakfast', 'Eggs, bacon, sausage, beans, mushrooms, grilled tomato and toast.', 1290, { o: ['eggsWay'], i: 'Eggs, ~Bacon, ~Sausage, ~Baked beans, ~Mushrooms, ~Grilled tomato, ~Toast', a: 'gluten egg celery mustard' }),
      dish('veggie-breakfast', 'Veggie breakfast', 'Eggs, halloumi, avocado, mushrooms, beans and toast.', 1150, { o: ['eggsWay'], i: 'Eggs, ~Halloumi, ~Avocado, ~Mushrooms, ~Baked beans, ~Toast', t: 'v', a: 'gluten egg milk' }),
      dish('french-toast', 'Brioche French toast', 'With berries, mascarpone and maple syrup.', 950, { i: 'Brioche, ~Berries, ~Mascarpone, ~Maple syrup', t: 'v', a: 'gluten egg milk' }),
      dish('granola', 'Granola bowl', 'Toasted granola, Greek yoghurt, berries and honey.', 690, { i: 'Granola, Greek yoghurt, ~Berries, ~Honey', t: 'v n', a: 'gluten milk nuts' })
    ] },
    { category: 'Sandwiches', items: [
      dish('blt', 'BLT on sourdough', 'Crispy bacon, lettuce, tomato and mayo.', 890, { i: 'Sourdough, ~Bacon, ~Lettuce, ~Tomato, ~Mayo', a: 'gluten egg' }),
      dish('breakfast-bun', 'Bacon and egg bun', 'Fried egg, bacon, cheese and brown sauce in a brioche bun.', 790, { i: 'Brioche bun, Fried egg, ~Bacon, ~Cheese, ~Brown sauce', a: 'gluten egg milk' })
    ] },
    { category: 'Sides', items: [
      dish('hash-browns', 'Hash browns (3)', 'Golden potato rösti.', 350, { k: 'side', i: 'Potato rösti', t: 've' }),
      dish('toast', 'Toast and butter', 'Two slices with salted butter.', 250, { k: 'side', o: ['toastBread'], i: 'Bread, ~Butter', t: 'v', a: 'gluten milk' })
    ] },
    { category: 'Coffee', items: [
      dish('flatwhite', 'Flat white', 'Double shot, silky milk.', 340, { k: 'drink', o: ['milk'], i: 'Double espresso', t: 'v gf', a: 'milk' }),
      dish('cappuccino', 'Cappuccino', 'Espresso, steamed milk and foam with a dusting of cocoa.', 360, { k: 'drink', o: ['milk', 'coffeeSize'], i: 'Espresso, Steamed milk, ~Cocoa', t: 'v gf', a: 'milk' }),
      dish('americano', 'Americano', 'Double espresso topped with hot water.', 300, { k: 'drink', o: ['coffeeSize'], i: 'Espresso, Hot water', t: 've gf' }),
      dish('chai', 'Chai latte', 'Spiced chai with steamed milk.', 380, { k: 'drink', o: ['milk'], i: 'Spiced chai, Milk', t: 'v gf', a: 'milk' })
    ] },
    { category: 'Juices and smoothies', items: [
      dish('oj', 'Fresh orange juice', 'Squeezed to order.', 390, { k: 'drink', i: 'Fresh oranges, ~Ice', t: 've gf' }),
      dish('green-smoothie', 'Green smoothie', 'Spinach, banana, mango and oat milk.', 520, { k: 'drink', i: 'Spinach, Banana, Mango, Oat milk', t: 've gf' })
    ] },
    { category: 'Sweet', items: [
      dish('banana-bread', 'Banana bread', 'A thick slice with walnuts, toasted and buttered.', 380, { k: 'dessert', i: 'Banana bread, ~Butter', t: 'v n', a: 'gluten egg milk nuts' })
    ] }
  ]
};
