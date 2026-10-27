'use strict';

const { dish, deal } = require('./_build');

const ROLLS = 'avocado-roll california:200 spicytuna:340 dragon:540 rainbow:640';

module.exports = {
  deals: [
    deal('lunch-box', 'Sushi lunch box', 'A roll, miso soup and a drink.', 1090, [
      ['roll', 'Roll', ROLLS],
      ['soup', 'Side', 'misosoup wakame:100'],
      ['drink', 'Drink', 'water green-tea:80 plum-soda:160']
    ], { pop: true }),
    deal('sushi-for-two', 'Sushi for two', 'A sushi set, two rolls and two miso soups.', 3290, [
      ['set', 'Set', 'veggie-set salmonset:260 kazeset:700'],
      ['roll', 'Roll', ROLLS],
      ['roll2', 'Second roll', ROLLS],
      ['soup', 'Soup', 'misosoup'],
      ['soup2', 'Second soup', 'misosoup']
    ])
  ],
  categories: [
    { category: 'Sets', items: [
      dish('kazeset', 'Kaze set (16 pieces)', 'Chef’s mix of nigiri, maki and one signature roll.', 2190, { pop: true, o: ['sushiExtras'], i: 'Nigiri, Maki, Signature roll, ~Wasabi, ~Pickled ginger, ~Soy sauce', a: 'fish crustaceans soy sesame gluten' }),
      dish('salmonset', 'Salmon lover set (12 pieces)', 'Salmon nigiri, salmon maki and salmon avocado uramaki.', 1750, { o: ['sushiExtras'], i: 'Salmon nigiri, Salmon maki, Salmon avocado uramaki, ~Wasabi, ~Pickled ginger, ~Soy sauce', a: 'fish soy sesame gluten' }),
      dish('veggie-set', 'Veggie set (12 pieces)', 'Avocado and cucumber maki with inari nigiri.', 1490, { o: ['sushiExtras'], i: 'Avocado maki, Cucumber maki, Inari nigiri, ~Wasabi, ~Pickled ginger, ~Soy sauce', t: 've', a: 'soy sesame gluten' })
    ] },
    { category: 'Rolls', items: [
      dish('dragon', 'Dragon roll (8)', 'Prawn tempura, avocado, eel sauce and toasted sesame.', 1290, { pop: true, o: ['sushiExtras'], i: 'Prawn tempura, Sushi rice, ~Avocado, ~Eel sauce, ~Toasted sesame', a: 'crustaceans gluten soy sesame egg' }),
      dish('california', 'California roll (8)', 'Crab, avocado, cucumber and tobiko.', 950, { o: ['sushiExtras'], i: 'Crab, Sushi rice, ~Avocado, ~Cucumber, ~Tobiko', a: 'crustaceans fish egg soy sesame' }),
      dish('spicytuna', 'Spicy tuna roll (8)', 'Tuna, chili mayo, spring onion and tempura flakes.', 1090, { o: ['sushiExtras'], i: 'Tuna, Sushi rice, ~Chili mayo, ~Spring onion, ~Tempura flakes', t: 'sp', a: 'fish egg gluten soy' }),
      dish('rainbow', 'Rainbow roll (8)', 'California roll topped with tuna, salmon and avocado.', 1390, { o: ['sushiExtras'], i: 'Crab, Sushi rice, Tuna, Salmon, ~Avocado', a: 'fish crustaceans soy sesame' }),
      dish('avocado-roll', 'Avocado roll (8)', 'Ripe avocado and toasted sesame.', 750, { o: ['sushiExtras'], i: 'Avocado, Sushi rice, ~Toasted sesame', t: 've', a: 'sesame' })
    ] },
    { category: 'Nigiri and sashimi', items: [
      dish('nigiri', 'Salmon nigiri (2)', 'Norwegian salmon on seasoned rice.', 520, { i: 'Norwegian salmon, Seasoned rice, ~Wasabi', t: 'gf', a: 'fish' }),
      dish('tuna-nigiri', 'Tuna nigiri (2)', 'Yellowfin tuna on seasoned rice.', 590, { i: 'Tuna, Seasoned rice, ~Wasabi', t: 'gf', a: 'fish' }),
      dish('sashimi', 'Salmon and tuna sashimi (10)', 'Thick-cut, with daikon and shiso.', 1490, { i: 'Salmon, Tuna, ~Daikon, ~Shiso', t: 'gf', a: 'fish' })
    ] },
    { category: 'Hot dishes', items: [
      dish('tempura', 'Prawn tempura (6)', 'Light, crisp batter with tentsuyu dipping sauce.', 1190, { k: 'starter', i: 'Prawns, Tempura batter, ~Tentsuyu dip', a: 'crustaceans gluten egg soy' }),
      dish('chicken-teriyaki', 'Chicken teriyaki', 'Grilled chicken thigh, teriyaki glaze, rice and greens.', 1250, { i: 'Chicken thigh, Steamed rice, ~Teriyaki glaze, ~Greens, ~Sesame', a: 'soy gluten sesame' })
    ] },
    { category: 'Sides', items: [
      dish('misosoup', 'Miso soup', 'Tofu, wakame and spring onion.', 350, { k: 'side', i: 'Miso broth, ~Tofu, ~Wakame, ~Spring onion', a: 'soy fish' }),
      dish('wakame', 'Wakame salad', 'Seaweed with sesame dressing.', 450, { k: 'side', i: 'Wakame seaweed, ~Sesame dressing, ~Sesame seeds', t: 've', a: 'sesame soy' }),
      dish('rice', 'Steamed rice', 'A bowl of Japanese short-grain rice.', 300, { k: 'side', i: 'Japanese rice', t: 've gf' })
    ] },
    { category: 'Drinks', items: [
      dish('green-tea', 'Sencha green tea', 'A pot of grassy Japanese green tea.', 300, { k: 'drink', i: 'Sencha', t: 've gf' }),
      dish('plum-soda', 'Plum soda', 'Sparkling ume plum, sweet and sour.', 380, { k: 'drink', i: 'Plum syrup, Sparkling water, ~Ice', t: 've gf' }),
      dish('water', 'Still water 0.5 l', 'Still mineral water.', 220, { k: 'drink', i: 'Still mineral water', t: 've gf' })
    ] },
    { category: 'Desserts', items: [
      dish('matcha-icecream', 'Matcha ice cream', 'Two scoops with sweet red bean.', 450, { k: 'dessert', i: 'Matcha ice cream, ~Red bean', t: 'v gf', a: 'milk' }),
      dish('dorayaki', 'Dorayaki', 'Fluffy pancakes filled with sweet red bean.', 490, { k: 'dessert', i: 'Pancakes, Sweet red bean', t: 'v', a: 'gluten egg milk' })
    ] }
  ]
};
