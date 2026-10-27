'use strict';

const { dish, deal } = require('./_build');

module.exports = {
  deals: [
    deal('coffee-cake', 'Coffee and cake', 'Any slice of cake with a hot or iced drink.', 690, [
      ['cake', 'Cake', 'carrot lemon-tart:20 red-velvet:40 vegan-choc:40 lava:70 pistachio:100'],
      ['drink', 'Drink', 'tea latte hot-choc:30 iced-latte:60']
    ], { pop: true }),
    deal('pastry-coffee', 'Pastry and coffee', 'A fresh pastry with a coffee or tea.', 490, [
      ['pastry', 'Pastry', 'croissant pain-choc:40 cinnamon:90 almond-croissant:100'],
      ['drink', 'Drink', 'tea latte iced-latte:60']
    ]),
    deal('party-box', 'Party box', 'A tub of gelato or sorbet, macarons and cookies to share.', 1890, [
      ['tub', 'Gelato or sorbet', 'sorbet gelato:100'],
      ['macarons', 'Macarons', 'macarons'],
      ['cookies', 'Cookies', 'brownie cookie-box:230']
    ])
  ],
  categories: [
    { category: 'Cakes', items: [
      dish('pistachio', 'Pistachio cheesecake', 'Baked cheesecake with a Sicilian pistachio cream top.', 620, { k: 'dessert', pop: true, i: 'Baked cheesecake, ~Pistachio cream', t: 'v n', a: 'milk egg gluten nuts' }),
      dish('lava', 'Chocolate lava cake', 'Warm with a molten centre. Arrives ready to eat.', 590, { k: 'dessert', pop: true, o: ['dessertExtras'], i: 'Chocolate sponge, Molten centre, ~Icing sugar', t: 'v', a: 'gluten egg milk' }),
      dish('carrot', 'Carrot cake', 'Walnuts, warm spices and cream cheese frosting.', 520, { k: 'dessert', i: 'Carrot sponge, ~Walnuts, ~Cream cheese frosting', t: 'v n', a: 'gluten egg milk nuts' }),
      dish('red-velvet', 'Red velvet slice', 'Soft cocoa sponge with cream cheese frosting.', 560, { k: 'dessert', i: 'Red velvet sponge, ~Cream cheese frosting', t: 'v', a: 'gluten egg milk' }),
      dish('lemon-tart', 'Lemon meringue tart', 'Sharp lemon curd under toasted meringue.', 540, { k: 'dessert', i: 'Shortcrust, Lemon curd, ~Toasted meringue', t: 'v', a: 'gluten egg milk' }),
      dish('vegan-choc', 'Vegan chocolate cake', 'Rich, dark and dairy-free with chocolate ganache.', 560, { k: 'dessert', i: 'Chocolate sponge, ~Chocolate ganache', t: 've', a: 'gluten soy' })
    ] },
    { category: 'Pastries', items: [
      dish('cinnamon', 'Cinnamon roll', 'Soft, gooey and glazed.', 380, { k: 'dessert', i: 'Cinnamon roll, ~Glaze', t: 'v', a: 'gluten milk egg' }),
      dish('croissant', 'Butter croissant', 'Flaky, golden and baked this morning.', 290, { k: 'dessert', i: 'Laminated pastry', t: 'v', a: 'gluten milk egg' }),
      dish('pain-choc', 'Chocolate croissant', 'Buttery pastry around two bars of dark chocolate.', 330, { k: 'dessert', i: 'Laminated pastry, Dark chocolate', t: 'v', a: 'gluten milk egg soy' }),
      dish('almond-croissant', 'Almond croissant', 'Filled with almond cream and topped with flaked almonds.', 390, { k: 'dessert', i: 'Laminated pastry, Almond cream, ~Flaked almonds', t: 'v n', a: 'gluten milk egg nuts' })
    ] },
    { category: 'Gelato', items: [
      dish('gelato', 'Gelato tub 500 ml', 'Churned in-house. Pick your flavour.', 850, { k: 'dessert', o: ['gelato'], i: 'Gelato', t: 'v gf', a: 'milk' }),
      dish('sorbet', 'Sorbet tub 500 ml', 'Dairy-free and full of fruit. Pick your flavour.', 750, { k: 'dessert', o: ['sorbetFlavour'], i: 'Sorbet', t: 've gf' })
    ] },
    { category: 'Cookies and treats', items: [
      dish('macarons', 'Macarons (6)', 'Raspberry, pistachio, salted caramel and more.', 900, { k: 'dessert', i: 'Assorted macarons', t: 'v gf n', a: 'egg milk nuts' }),
      dish('cookie-box', 'Cookie box (4)', 'Chocolate chip, oat and raisin, double chocolate and white chocolate.', 650, { k: 'dessert', i: 'Assorted cookies', t: 'v', a: 'gluten egg milk soy' }),
      dish('brownie', 'Salted caramel brownie', 'Fudgy brownie with a ribbon of salted caramel.', 420, { k: 'dessert', i: 'Chocolate brownie, ~Salted caramel', t: 'v', a: 'gluten egg milk' })
    ] },
    { category: 'Hot drinks', items: [
      dish('latte', 'Caffè latte', 'Double espresso with silky steamed milk.', 360, { k: 'drink', o: ['milk', 'coffeeSize'], i: 'Espresso, Milk', t: 'v gf', a: 'milk' }),
      dish('hot-choc', 'Hot chocolate', 'Melted dark chocolate and milk.', 390, { k: 'drink', o: ['milk'], i: 'Dark chocolate, Milk, ~Whipped cream', t: 'v gf', a: 'milk' }),
      dish('tea', 'Earl grey tea', 'Black tea with bergamot.', 280, { k: 'drink', i: 'Black tea, Bergamot', t: 've gf' })
    ] },
    { category: 'Cold drinks', items: [
      dish('iced-latte', 'Iced latte', 'Double espresso and cold milk over ice.', 420, { k: 'drink', o: ['milk', 'coffeeSize'], i: 'Espresso, Milk, ~Ice', t: 'v gf', a: 'milk' }),
      dish('pink-lemonade', 'Pink lemonade', 'Lemon, raspberry and sparkling water.', 350, { k: 'drink', i: 'Lemon, Raspberry, Sparkling water, ~Ice', t: 've gf' })
    ] }
  ]
};
