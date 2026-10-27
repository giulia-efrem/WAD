'use strict';

const { dish, deal } = require('./_build');

const BURGERS = 'classic mushroom:50 vegan-smash:100 hothoney:100 jalapeno:150 bacon-jam:200 double:300';
const SIDES = 'fries slaw rings:50 sweet-fries:100';
const DRINKS = 'cola lemonade iced-tea:20 vanilla:150 caramel:200';

module.exports = {
  deals: [
    deal('smash-menu', 'Smash menu', 'Any burger, fries or a side, and a drink.', 1390, [
      ['burger', 'Burger', BURGERS],
      ['side', 'Side', SIDES],
      ['drink', 'Drink', DRINKS]
    ], { pop: true }),
    deal('burgers-for-two', 'Burgers for two', 'Two burgers, two sides and two drinks.', 2690, [
      ['burger', 'Burger', BURGERS],
      ['burger2', 'Second burger', BURGERS],
      ['side', 'Side', SIDES],
      ['side2', 'Second side', SIDES],
      ['drink', 'Drink', DRINKS],
      ['drink2', 'Second drink', DRINKS]
    ]),
    deal('tenders-box', 'Tenders box', 'Chicken tenders or wings, two sides and a drink.', 1490, [
      ['chicken', 'Chicken', 'tenders wings:60'],
      ['side', 'Side', 'fries sweet-fries:100 mac:240'],
      ['side2', 'Second side', 'slaw rings:70'],
      ['drink', 'Drink', 'cola lemonade iced-tea:20']
    ])
  ],
  categories: [
    { category: 'Burgers', items: [
      dish('classic', 'Classic smash', 'Two smashed beef patties, American cheese, pickles, onion and house sauce.', 990, { pop: true, o: ['sauce', 'burgerExtras'], i: 'Two beef patties, Brioche bun, ~American cheese, ~Pickles, ~Onion', a: 'gluten milk egg mustard sesame' }),
      dish('double', 'Double trouble', 'Four patties, four slices of cheese. Not for the faint-hearted.', 1290, { o: ['sauce', 'burgerExtras'], i: 'Four beef patties, Brioche bun, ~American cheese, ~Pickles, ~Onion', a: 'gluten milk egg mustard sesame' }),
      dish('bacon-jam', 'Bacon jam smash', 'Two patties, smoky bacon jam, aged cheddar and crispy onions.', 1190, { o: ['sauce', 'burgerExtras'], i: 'Two beef patties, Brioche bun, ~Bacon jam, ~Aged cheddar, ~Crispy onions', a: 'gluten milk egg sesame' }),
      dish('jalapeno', 'Jalapeño popper smash', 'Two patties, cream cheese, pickled jalapeños and chili mayo.', 1140, { o: ['burgerExtras'], i: 'Two beef patties, Brioche bun, ~Cream cheese, ~Pickled jalapeños, ~Chili mayo', t: 'sp', a: 'gluten milk egg sesame' }),
      dish('mushroom', 'Mushroom melt', 'Crispy portobello, Swiss cheese, caramelised onion. Vegetarian.', 1050, { o: ['sauce'], i: 'Crispy portobello, Brioche bun, ~Swiss cheese, ~Caramelised onion', t: 'v', a: 'gluten milk egg' }),
      dish('vegan-smash', 'Plant smash', 'Two plant-based patties, vegan cheese, pickles and onion on a vegan bun.', 1090, { o: ['sauce'], i: 'Plant-based patties, Vegan bun, ~Vegan cheese, ~Pickles, ~Onion', t: 've', a: 'gluten soy mustard' })
    ] },
    { category: 'Chicken', items: [
      dish('hothoney', 'Hot honey chicken', 'Buttermilk fried chicken, hot honey, slaw and pickles.', 1090, { pop: true, o: ['burgerExtras'], i: 'Buttermilk fried chicken, Brioche bun, ~Hot honey, ~Slaw, ~Pickles', t: 'sp', a: 'gluten milk egg' }),
      dish('tenders', 'Chicken tenders (5)', 'Crispy buttermilk tenders with your choice of dip.', 890, { o: ['dip'], i: 'Buttermilk chicken tenders', a: 'gluten milk egg' }),
      dish('wings', 'Buffalo wings (8)', 'Crispy wings tossed in buffalo sauce, with blue cheese dip and celery.', 950, { i: 'Chicken wings, ~Buffalo sauce, ~Blue cheese dip, ~Celery sticks', t: 'sp gf', a: 'milk celery' })
    ] },
    { category: 'Sides', items: [
      dish('fries', 'Fries', 'Skin-on, double-cooked and salted.', 350, { k: 'side', pop: true, o: ['fries'], i: 'Skin-on fries, ~Salt', t: 'v gf' }),
      dish('rings', 'Onion rings', 'Beer-battered with chipotle dip.', 420, { k: 'side', i: 'Beer-battered onion rings, ~Chipotle dip', t: 'v', a: 'gluten egg' }),
      dish('sweet-fries', 'Sweet potato fries', 'With smoked salt and chipotle mayo.', 450, { k: 'side', i: 'Sweet potato fries, ~Smoked salt, ~Chipotle mayo', t: 'v gf', a: 'egg' }),
      dish('slaw', 'Coleslaw', 'Crunchy cabbage and carrot in a light mayo.', 350, { k: 'side', i: 'Cabbage, Carrot, ~Mayo dressing', t: 'v gf', a: 'egg mustard' }),
      dish('mac', 'Mac and cheese', 'Baked macaroni with three cheeses and a crunchy top.', 590, { k: 'side', i: 'Macaroni, Cheese sauce, ~Crispy crumb', t: 'v', a: 'gluten milk' })
    ] },
    { category: 'Shakes and drinks', items: [
      dish('vanilla', 'Vanilla shake', 'Thick, cold and made with real vanilla.', 490, { k: 'drink', i: 'Vanilla ice cream, Milk, ~Whipped cream', t: 'v gf', a: 'milk' }),
      dish('caramel', 'Salted caramel shake', 'With a drizzle of caramel and flaky salt.', 540, { k: 'drink', i: 'Vanilla ice cream, Milk, ~Caramel drizzle, ~Flaky salt', t: 'v gf', a: 'milk' }),
      dish('cookies-shake', 'Cookies and cream shake', 'Vanilla shake blended with chocolate cookies.', 540, { k: 'drink', i: 'Vanilla ice cream, Milk, Chocolate cookies, ~Whipped cream', t: 'v', a: 'gluten milk soy' }),
      dish('cola', 'House cola', 'Our own cola, served ice cold.', 300, { k: 'drink', o: ['sodaSize'], i: 'House cola, ~Ice', t: 've gf' }),
      dish('lemonade', 'Cloudy lemonade', 'Freshly squeezed and lightly sweet.', 300, { k: 'drink', o: ['sodaSize'], i: 'Lemonade, ~Ice', t: 've gf' }),
      dish('iced-tea', 'Peach iced tea', 'Brewed black tea with peach.', 320, { k: 'drink', o: ['sodaSize'], i: 'Black tea, Peach, ~Ice', t: 've gf' })
    ] },
    { category: 'Desserts', items: [
      dish('brownie', 'Fudge brownie', 'Warm, gooey and topped with chocolate sauce.', 450, { k: 'dessert', o: ['dessertExtras'], i: 'Chocolate brownie, ~Chocolate sauce, ~Walnuts', t: 'v n', a: 'gluten egg milk nuts' }),
      dish('cookie', 'Skillet cookie', 'A warm chocolate chip cookie, crisp at the edges and soft in the middle.', 290, { k: 'dessert', o: ['dessertExtras'], i: 'Chocolate chip cookie', t: 'v', a: 'gluten egg milk' })
    ] }
  ]
};
