'use strict';

const { dish, deal } = require('./_build');

const TACOS = 'hongos pastor:60 carnitas:100 baja:160 shrimp:260 birria:300';
const DRINKS = 'horchata agua-fresca tamarind';

module.exports = {
  deals: [
    deal('taco-feast', 'Taco feast', 'Two portions of tacos, something to share and a drink.', 2390, [
      ['tacos', 'Tacos', TACOS],
      ['tacos2', 'Second tacos', TACOS],
      ['share', 'To share', 'guac nachos:200'],
      ['drink', 'Drink', DRINKS]
    ], { pop: true }),
    deal('burrito-combo', 'Burrito combo', 'Any burrito or bowl, a side and a drink.', 1490, [
      ['burrito', 'Burrito', 'veg-burrito burrito:100 burrito-bowl:100'],
      ['side', 'Side', 'rice-beans elote:50 guac:250'],
      ['drink', 'Drink', DRINKS]
    ])
  ],
  categories: [
    { category: 'Tacos', items: [
      dish('pastor', 'Al pastor tacos (3)', 'Marinated pork, grilled pineapple, onion and coriander.', 950, { pop: true, o: ['tortilla', 'salsa'], i: 'Marinated pork, ~Grilled pineapple, ~Onion, ~Coriander' }),
      dish('birria', 'Birria tacos (3)', 'Slow-braised beef, melted cheese and a cup of consommé for dipping.', 1190, { pop: true, o: ['tortilla'], i: 'Slow-braised beef, Consommé, ~Melted cheese, ~Onion, ~Coriander', a: 'milk celery' }),
      dish('baja', 'Baja fish tacos (3)', 'Crispy fish, cabbage slaw, chipotle crema.', 1050, { o: ['tortilla', 'salsa'], i: 'Crispy fish, ~Cabbage slaw, ~Chipotle crema', a: 'fish gluten milk egg' }),
      dish('hongos', 'Mushroom tacos (3)', 'Roasted oyster mushrooms, black beans, salsa macha. Vegan.', 890, { o: ['tortilla', 'salsa'], i: 'Roasted oyster mushrooms, ~Black beans, ~Salsa macha', t: 've', a: 'peanuts sesame' }),
      dish('carnitas', 'Carnitas tacos (3)', 'Slow-cooked pork, pickled onion and coriander.', 990, { o: ['tortilla', 'salsa'], i: 'Carnitas pork, ~Pickled onion, ~Coriander' }),
      dish('shrimp', 'Chipotle shrimp tacos (3)', 'Chipotle shrimp, avocado crema and red cabbage.', 1150, { o: ['tortilla'], i: 'Chipotle shrimp, ~Avocado crema, ~Red cabbage', t: 'sp', a: 'crustaceans milk' })
    ] },
    { category: 'Burritos and bowls', items: [
      dish('burrito', 'Chicken burrito', 'Chipotle chicken, rice, beans, cheese and pico de gallo.', 1090, { o: ['salsa', 'tacoExtras'], i: 'Chipotle chicken, Flour tortilla, ~Rice, ~Beans, ~Cheese, ~Pico de gallo', a: 'gluten milk' }),
      dish('veg-burrito', 'Black bean burrito', 'Black beans, rice, cheese, pico de gallo and sour cream.', 990, { o: ['salsa', 'tacoExtras'], i: 'Black beans, Flour tortilla, ~Rice, ~Cheese, ~Pico de gallo, ~Sour cream', t: 'v', a: 'gluten milk' }),
      dish('burrito-bowl', 'Burrito bowl', 'Everything in a burrito, without the tortilla.', 1090, { o: ['protein', 'salsa', 'tacoExtras'], i: 'Rice, ~Black beans, ~Pico de gallo, ~Cheese, ~Lettuce', t: 'gf', a: 'milk' })
    ] },
    { category: 'Quesadillas', items: [
      dish('quesadilla', 'Cheese quesadilla', 'Melted Oaxaca cheese in a crisp flour tortilla, with salsa roja.', 890, { o: ['tacoExtras'], i: 'Flour tortilla, Oaxaca cheese, ~Salsa roja', t: 'v', a: 'gluten milk' }),
      dish('chicken-quesadilla', 'Chicken tinga quesadilla', 'Smoky chipotle chicken and Oaxaca cheese.', 990, { o: ['tacoExtras'], i: 'Flour tortilla, Chicken tinga, Oaxaca cheese, ~Salsa roja', t: 'sp', a: 'gluten milk' })
    ] },
    { category: 'To share', items: [
      dish('nachos', 'Loaded nachos', 'Cheese sauce, jalapeños, guacamole and sour cream.', 850, { k: 'starter', o: ['tacoExtras'], i: 'Tortilla chips, ~Cheese sauce, ~Jalapeños, ~Guacamole, ~Sour cream', t: 'v', a: 'milk' }),
      dish('guac', 'Guacamole and chips', 'Made to order with lime, chili and coriander.', 650, { k: 'starter', i: 'Guacamole, Tortilla chips', t: 've gf' }),
      dish('elote', 'Elote', 'Grilled corn with chili mayo, lime and cotija.', 450, { k: 'side', i: 'Corn on the cob, ~Chili mayo, ~Cotija cheese, ~Lime', t: 'v gf sp', a: 'milk egg' }),
      dish('rice-beans', 'Rice and black beans', 'Mexican red rice with seasoned black beans.', 400, { k: 'side', i: 'Mexican rice, Black beans', t: 've gf' })
    ] },
    { category: 'Drinks', items: [
      dish('horchata', 'Horchata', 'Rice, cinnamon and vanilla over ice.', 350, { k: 'drink', i: 'Rice milk, ~Cinnamon, ~Ice', t: 've gf' }),
      dish('agua-fresca', 'Hibiscus agua fresca', 'Hibiscus and lime, lightly sweet.', 350, { k: 'drink', i: 'Hibiscus, Lime, ~Ice', t: 've gf' }),
      dish('tamarind', 'Tamarind soda', 'Sweet, sour and sparkling.', 350, { k: 'drink', o: ['sodaSize'], i: 'Tamarind, Sparkling water, ~Ice', t: 've gf' })
    ] },
    { category: 'Desserts', items: [
      dish('churros', 'Churros', 'Cinnamon sugar with warm chocolate sauce.', 490, { k: 'dessert', i: 'Churros, ~Cinnamon sugar, ~Chocolate sauce', t: 'v', a: 'gluten milk egg' }),
      dish('tres-leches', 'Tres leches cake', 'Sponge soaked in three milks, with cinnamon.', 520, { k: 'dessert', i: 'Sponge cake, Three milks, ~Cinnamon', t: 'v', a: 'gluten milk egg' })
    ] }
  ]
};
