'use strict';

const { dish, deal } = require('./_build');

module.exports = {
  deals: [
    deal('lunch-deal', 'Lunch deal', 'Any bowl or salad, a juice and a sweet bite.', 1390, [
      ['bowl', 'Bowl or salad', 'greek quinoa:40 caesar:100 falafel:140 tofu-bowl:140 teriyaki:240 harissa:240 poke:340'],
      ['drink', 'Drink', 'shot kombucha:100 greenjuice:200 smoothie:250'],
      ['sweet', 'Sweet bite', 'energy-balls']
    ], { pop: true }),
    deal('wrap-soup', 'Wrap and soup', 'A wrap with a bowl of red lentil soup.', 1290, [
      ['wrap', 'Wrap', 'falafel-wrap chicken-wrap:40'],
      ['soup', 'Soup', 'lentil-soup']
    ])
  ],
  categories: [
    { category: 'Bowls', items: [
      dish('poke', 'Salmon poke', 'Salmon, avocado, edamame, mango, pickled ginger and ponzu.', 1290, { pop: true, o: ['base', 'bowlExtras'], i: 'Salmon, ~Avocado, ~Edamame, ~Mango, ~Pickled ginger, ~Ponzu', a: 'fish soy sesame gluten' }),
      dish('falafel', 'Falafel and hummus', 'Baked falafel, hummus, tabbouleh, pickled red onion. Vegan.', 1090, { o: ['base', 'bowlExtras'], i: 'Baked falafel, ~Hummus, ~Tabbouleh, ~Pickled red onion', t: 've', a: 'sesame gluten' }),
      dish('teriyaki', 'Teriyaki chicken', 'Grilled chicken, broccoli, carrot, sesame and teriyaki glaze.', 1190, { pop: true, o: ['base', 'bowlExtras'], i: 'Grilled chicken, ~Broccoli, ~Carrot, ~Sesame, ~Teriyaki glaze', a: 'soy sesame gluten' }),
      dish('tofu-bowl', 'Crispy tofu and peanut', 'Crispy tofu, rice noodles, crunchy veg and peanut dressing.', 1090, { o: ['base', 'bowlExtras'], i: 'Crispy tofu, ~Rice noodles, ~Red cabbage, ~Carrot, ~Peanut dressing', t: 've n', a: 'soy peanuts' }),
      dish('harissa', 'Harissa chicken bowl', 'Harissa chicken, freekeh, roasted vegetables and garlic yoghurt.', 1190, { o: ['base', 'bowlExtras'], i: 'Harissa chicken, ~Freekeh, ~Roasted vegetables, ~Garlic yoghurt', t: 'sp', a: 'gluten milk' })
    ] },
    { category: 'Salads', items: [
      dish('caesar', 'Chicken Caesar salad', 'Grilled chicken, romaine, parmesan, croutons and Caesar dressing.', 1050, { i: 'Grilled chicken, Romaine, ~Parmesan, ~Croutons, ~Caesar dressing', a: 'gluten milk egg fish' }),
      dish('quinoa', 'Quinoa and roasted squash', 'Quinoa, roasted squash, kale, pomegranate and toasted almonds.', 990, { i: 'Quinoa, Roasted squash, ~Kale, ~Pomegranate, ~Toasted almonds', t: 've gf n', a: 'nuts' }),
      dish('greek', 'Greek salad', 'Tomato, cucumber, feta, Kalamata olives and red onion.', 950, { i: 'Tomato, Cucumber, ~Feta, ~Kalamata olives, ~Red onion', t: 'v gf', a: 'milk' })
    ] },
    { category: 'Wraps and soup', items: [
      dish('falafel-wrap', 'Falafel wrap', 'Falafel, hummus, pickled cabbage and chili sauce in a flatbread.', 850, { i: 'Flatbread, Falafel, ~Hummus, ~Pickled cabbage, ~Chili sauce', t: 've', a: 'gluten sesame' }),
      dish('chicken-wrap', 'Chicken pesto wrap', 'Grilled chicken, basil pesto, rocket and sun-dried tomato.', 890, { i: 'Wholewheat wrap, Grilled chicken, ~Basil pesto, ~Rocket, ~Sun-dried tomato', t: 'n', a: 'gluten milk nuts' }),
      dish('lentil-soup', 'Red lentil soup', 'With cumin and lemon, and a slice of sourdough.', 650, { i: 'Red lentil soup, ~Sourdough', t: 've', a: 'gluten celery' })
    ] },
    { category: 'Sides', items: [
      dish('sweet-potato', 'Sweet potato wedges', 'Roasted with smoked paprika.', 450, { k: 'side', i: 'Sweet potato, ~Smoked paprika', t: 've gf' }),
      dish('hummus', 'Hummus and crudités', 'Creamy hummus with carrot, cucumber and peppers.', 450, { k: 'side', i: 'Hummus, ~Carrot, ~Cucumber, ~Peppers', t: 've gf', a: 'sesame' })
    ] },
    { category: 'Juices and drinks', items: [
      dish('greenjuice', 'Green juice', 'Apple, cucumber, spinach, lime and ginger. Cold-pressed.', 490, { k: 'drink', i: 'Apple, Cucumber, Spinach, ~Lime, ~Ginger', t: 've gf' }),
      dish('shot', 'Ginger shot', 'Ginger, lemon and a little cayenne.', 250, { k: 'drink', i: 'Ginger, Lemon, ~Cayenne', t: 've gf' }),
      dish('smoothie', 'Berry smoothie', 'Mixed berries, banana and yoghurt.', 550, { k: 'drink', i: 'Mixed berries, Banana, Yoghurt', t: 'v gf', a: 'milk' }),
      dish('kombucha', 'Ginger kombucha', 'Lightly sparkling fermented tea.', 420, { k: 'drink', i: 'Fermented tea, Ginger', t: 've gf' })
    ] },
    { category: 'Sweet', items: [
      dish('acai', 'Açaí bowl', 'Açaí, banana, granola, berries and coconut.', 890, { k: 'dessert', i: 'Açaí, ~Banana, ~Granola, ~Berries, ~Coconut', t: 've', a: 'gluten' }),
      dish('energy-balls', 'Date and cacao bites (4)', 'Dates, cacao and almonds rolled into bites.', 390, { k: 'dessert', i: 'Dates, Cacao, Almonds', t: 've gf n', a: 'nuts' })
    ] }
  ]
};
