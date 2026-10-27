'use strict';

const { dish, deal } = require('./_build');

const BAO = 'tofubao chickenbao:30 porkbao:60';

module.exports = {
  deals: [
    deal('ramen-set', 'Ramen set', 'Any ramen, a small plate and a drink.', 1690, [
      ['ramen', 'Ramen', 'tantan shoyu:40 tonkotsu:100 miso:140 curry-ramen:140'],
      ['plate', 'Small plate', 'edamame cucumber veg-gyoza:220 gyoza:250 tofubao:290'],
      ['drink', 'Drink', 'jasmine yuzu-soda:80 matcha-latte:120']
    ], { pop: true }),
    deal('bao-feast', 'Bao feast', 'Three portions of bao and a side of edamame.', 2190, [
      ['bao', 'Bao', BAO],
      ['bao2', 'Second bao', BAO],
      ['bao3', 'Third bao', BAO],
      ['side', 'Side', 'edamame cucumber']
    ])
  ],
  categories: [
    { category: 'Ramen', items: [
      dish('tonkotsu', 'Tonkotsu ramen', 'Rich pork broth, chashu, soft egg, nori and spring onion.', 1350, { pop: true, o: ['spice', 'ramenExtras'], i: 'Pork broth, Ramen noodles, ~Chashu pork, ~Soft egg, ~Nori, ~Spring onion', a: 'gluten egg soy sesame' }),
      dish('miso', 'Spicy miso ramen', 'Miso and chili broth, minced pork, corn, beansprouts.', 1390, { pop: true, o: ['spice', 'ramenExtras'], i: 'Miso and chili broth, Ramen noodles, ~Minced pork, ~Corn, ~Beansprouts, ~Spring onion', t: 'sp', a: 'gluten soy sesame' }),
      dish('shoyu', 'Shoyu chicken ramen', 'Clear soy broth, chicken thigh, bamboo shoots, egg.', 1290, { o: ['ramenExtras'], i: 'Clear soy broth, Ramen noodles, ~Chicken thigh, ~Bamboo shoots, ~Soft egg', a: 'gluten egg soy' }),
      dish('tantan', 'Vegan tantanmen', 'Sesame and soy milk broth, spiced tofu, bok choy.', 1250, { o: ['spice', 'ramenExtras'], i: 'Sesame and soy milk broth, Ramen noodles, ~Spiced tofu, ~Bok choy, ~Chili oil', t: 've sp', a: 'gluten soy sesame' }),
      dish('curry-ramen', 'Black garlic curry ramen', 'Curry broth, black garlic oil, crispy chicken and a soft egg.', 1390, { o: ['spice', 'ramenExtras'], i: 'Curry broth, Ramen noodles, ~Crispy chicken, ~Black garlic oil, ~Soft egg', a: 'gluten egg soy celery' })
    ] },
    { category: 'Bao', items: [
      dish('porkbao', 'Pork belly bao (2)', 'Braised pork belly, peanut crumb, pickled cucumber, coriander.', 750, { pop: true, i: 'Steamed buns, Braised pork belly, ~Peanut crumb, ~Pickled cucumber, ~Coriander', t: 'n', a: 'gluten soy peanuts' }),
      dish('tofubao', 'Crispy tofu bao (2)', 'Sticky glazed tofu, kimchi mayo, spring onion.', 690, { i: 'Steamed buns, Glazed tofu, ~Kimchi mayo, ~Spring onion', t: 'v', a: 'gluten soy egg' }),
      dish('chickenbao', 'Fried chicken bao (2)', 'Crispy chicken thigh, sriracha mayo and pickled carrot.', 720, { i: 'Steamed buns, Fried chicken thigh, ~Sriracha mayo, ~Pickled carrot', t: 'sp', a: 'gluten egg soy' })
    ] },
    { category: 'Small plates', items: [
      dish('gyoza', 'Pork gyoza (6)', 'Pan-fried dumplings with black vinegar dip.', 650, { k: 'starter', i: 'Pork dumplings, ~Black vinegar dip', a: 'gluten soy sesame' }),
      dish('veg-gyoza', 'Vegetable gyoza (6)', 'Cabbage, shiitake and carrot dumplings with black vinegar dip.', 620, { k: 'starter', i: 'Vegetable dumplings, ~Black vinegar dip', t: 've', a: 'gluten soy sesame' }),
      dish('karaage', 'Chicken karaage', 'Ginger and soy fried chicken with Japanese mayo and lemon.', 750, { k: 'starter', i: 'Fried chicken thigh, ~Japanese mayo, ~Lemon', a: 'gluten soy egg' }),
      dish('edamame', 'Edamame', 'Steamed with sea salt and chili.', 400, { k: 'side', i: 'Edamame, ~Sea salt, ~Chili', t: 've gf', a: 'soy' }),
      dish('cucumber', 'Smacked cucumber', 'With garlic, chili oil and toasted sesame.', 380, { k: 'side', i: 'Cucumber, ~Garlic, ~Chili oil, ~Sesame seeds', t: 've sp', a: 'sesame soy' })
    ] },
    { category: 'Rice bowls', items: [
      dish('katsu', 'Chicken katsu curry', 'Panko chicken, Japanese curry sauce, steamed rice and pickles.', 1250, { i: 'Panko chicken, Steamed rice, Curry sauce, ~Pickles', a: 'gluten egg soy celery' }),
      dish('salmon-don', 'Teriyaki salmon don', 'Glazed salmon over rice with pickled ginger and spring onion.', 1390, { i: 'Salmon, Steamed rice, ~Teriyaki glaze, ~Pickled ginger, ~Spring onion', a: 'fish soy gluten sesame' })
    ] },
    { category: 'Drinks', items: [
      dish('matcha-latte', 'Iced matcha latte', 'Stone-ground matcha with milk over ice.', 420, { k: 'drink', o: ['milk'], i: 'Matcha, Milk, ~Ice', t: 'v gf', a: 'milk' }),
      dish('yuzu-soda', 'Yuzu soda', 'Sparkling yuzu citrus, lightly sweet.', 380, { k: 'drink', i: 'Yuzu juice, Sparkling water, ~Ice', t: 've gf' }),
      dish('jasmine', 'Hot jasmine tea', 'A pot of fragrant jasmine green tea.', 300, { k: 'drink', i: 'Jasmine tea', t: 've gf' })
    ] },
    { category: 'Desserts', items: [
      dish('matcha', 'Matcha cheesecake', 'Light, creamy and not too sweet.', 550, { k: 'dessert', i: 'Matcha cream cheese, Biscuit base', t: 'v', a: 'gluten milk egg' }),
      dish('mochi', 'Mochi ice cream (3)', 'Mango, matcha and black sesame.', 520, { k: 'dessert', i: 'Mochi, Ice cream', t: 'v gf', a: 'milk sesame' })
    ] }
  ]
};
