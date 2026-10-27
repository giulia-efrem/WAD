'use strict';

const { dish, deal } = require('./_build');

const PIZZAS = 'margherita marinara diavola:200 formaggi:250 funghi:300 capricciosa:300 ortolana:200 tartufo:500';

module.exports = {
  deals: [
    deal('pizza-night', 'Pizza night', 'Any pizza, a side or starter and a drink.', 1590, [
      ['pizza', 'Pizza', PIZZAS],
      ['side', 'Side or starter', 'rocket focaccia bruschetta:100'],
      ['drink', 'Drink', 'lemonade pellegrino still']
    ], { pop: true }),
    deal('pasta-lunch', 'Pasta lunch', 'Any pasta, a drink and a dessert.', 1590, [
      ['pasta', 'Pasta', 'arrabbiata pesto:100 carbonara:200 lasagne:300'],
      ['drink', 'Drink', 'espresso pellegrino lemonade:100'],
      ['dessert', 'Dessert', 'pannacotta tiramisu affogato']
    ]),
    deal('date-night', 'Date night for two', 'Two pizzas and a dessert to share.', 2290, [
      ['pizza', 'Pizza', PIZZAS],
      ['pizza2', 'Second pizza', PIZZAS],
      ['dessert', 'Dessert', 'tiramisu pannacotta cannoli:40']
    ])
  ],
  categories: [
    { category: 'Pizza', items: [
      dish('margherita', 'Margherita', 'San Marzano tomato, fior di latte, basil and Ligurian olive oil.', 950, { pop: true, o: ['size', 'pizzaExtras'], i: 'Pizza dough, ~San Marzano tomato, ~Fior di latte, ~Basil, ~Olive oil', t: 'v', a: 'gluten milk' }),
      dish('diavola', 'Diavola', 'Tomato, mozzarella, spicy salami and a drizzle of hot honey.', 1150, { pop: true, o: ['size', 'pizzaExtras'], i: 'Pizza dough, ~Tomato sauce, ~Mozzarella, ~Spicy salami, ~Hot honey', t: 'sp', a: 'gluten milk' }),
      dish('formaggi', 'Quattro formaggi', 'Mozzarella, gorgonzola, taleggio and parmesan on a white base.', 1200, { o: ['size', 'pizzaExtras'], i: 'Pizza dough, ~Mozzarella, ~Gorgonzola, ~Taleggio, ~Parmesan', t: 'v', a: 'gluten milk' }),
      dish('funghi', 'Funghi e salsiccia', 'Roasted mushrooms, fennel sausage, mozzarella and thyme.', 1250, { o: ['size', 'pizzaExtras'], i: 'Pizza dough, ~Roasted mushrooms, ~Fennel sausage, ~Mozzarella, ~Thyme', a: 'gluten milk' }),
      dish('marinara', 'Marinara', 'No cheese. Tomato, garlic, oregano and olive oil. Vegan.', 800, { o: ['size'], i: 'Pizza dough, ~Tomato sauce, ~Garlic, ~Oregano, ~Olive oil', t: 've', a: 'gluten' }),
      dish('capricciosa', 'Capricciosa', 'Tomato, mozzarella, cooked ham, mushrooms, artichokes and black olives.', 1250, { o: ['size', 'pizzaExtras'], i: 'Pizza dough, ~Tomato sauce, ~Mozzarella, ~Cooked ham, ~Mushrooms, ~Artichokes, ~Black olives', a: 'gluten milk' }),
      dish('ortolana', 'Ortolana', 'Grilled courgette, aubergine and roasted peppers on tomato and mozzarella.', 1150, { o: ['size', 'pizzaExtras'], i: 'Pizza dough, ~Tomato sauce, ~Mozzarella, ~Courgette, ~Aubergine, ~Roasted peppers', t: 'v', a: 'gluten milk' }),
      dish('tartufo', 'Tartufo', 'White base with truffle cream, wild mushrooms, fior di latte and parmesan.', 1450, { o: ['size', 'pizzaExtras'], i: 'Pizza dough, ~Truffle cream, ~Wild mushrooms, ~Fior di latte, ~Parmesan', t: 'v', a: 'gluten milk' })
    ] },
    { category: 'Pasta', items: [
      dish('carbonara', 'Rigatoni carbonara', 'Guanciale, egg yolk, pecorino and plenty of black pepper.', 1290, { pop: true, o: ['pastaExtras'], i: 'Rigatoni, Egg yolk, ~Guanciale, ~Pecorino, ~Black pepper', a: 'gluten egg milk' }),
      dish('arrabbiata', 'Penne arrabbiata', 'A fiery tomato sauce with garlic, chili and parsley.', 1090, { o: ['pastaExtras'], i: 'Penne, Tomato sauce, ~Garlic, ~Chili, ~Parsley', t: 've sp', a: 'gluten' }),
      dish('lasagne', 'Beef lasagne', 'Slow-cooked beef ragù, béchamel and parmesan, baked in layers.', 1390, { i: 'Egg pasta, Beef ragù, Béchamel, ~Parmesan', a: 'gluten egg milk celery' }),
      dish('pesto', 'Trofie al pesto', 'Twisted pasta with basil pesto, green beans and potato.', 1190, { o: ['pastaExtras'], i: 'Trofie, Basil pesto, ~Green beans, ~Potato, ~Parmesan', t: 'v n', a: 'gluten milk nuts' })
    ] },
    { category: 'Starters', items: [
      dish('burrata', 'Burrata and tomatoes', 'Creamy burrata, heritage tomatoes, basil oil and sea salt.', 850, { k: 'starter', i: 'Burrata, ~Heritage tomatoes, ~Basil oil, ~Sea salt', t: 'v gf', a: 'milk' }),
      dish('focaccia', 'Garlic focaccia', 'Fresh from the oven with rosemary and garlic butter.', 450, { k: 'starter', i: 'Focaccia, ~Rosemary, ~Garlic butter', t: 'v', a: 'gluten milk' }),
      dish('arancini', 'Arancini (3)', 'Crispy saffron risotto balls with mozzarella and peas, with tomato dip.', 750, { k: 'starter', i: 'Saffron risotto, Mozzarella, ~Peas, ~Tomato dip', t: 'v', a: 'gluten milk egg' }),
      dish('bruschetta', 'Tomato bruschetta', 'Toasted sourdough with tomato, garlic, basil and olive oil.', 650, { k: 'starter', i: 'Sourdough, ~Tomatoes, ~Garlic, ~Basil, ~Olive oil', t: 've', a: 'gluten' })
    ] },
    { category: 'Sides', items: [
      dish('rocket', 'Rocket salad', 'Rocket, cherry tomatoes and shaved parmesan with lemon dressing.', 550, { k: 'side', i: 'Rocket, ~Cherry tomatoes, ~Parmesan, ~Lemon dressing', t: 'v gf', a: 'milk' })
    ] },
    { category: 'Drinks', items: [
      dish('pellegrino', 'Sparkling water 0.5 l', 'Naturally sparkling mineral water.', 250, { k: 'drink', i: 'Sparkling mineral water', t: 've gf' }),
      dish('still', 'Still water 0.5 l', 'Still mineral water.', 220, { k: 'drink', i: 'Still mineral water', t: 've gf' }),
      dish('lemonade', 'Sicilian lemonade', 'Pressed lemons, a little sugar and sparkling water.', 380, { k: 'drink', o: ['sodaSize'], i: 'Lemon juice, Sparkling water, ~Sugar', t: 've gf' }),
      dish('espresso', 'Espresso', 'A short, strong double shot.', 220, { k: 'drink', i: 'Espresso', t: 've gf' })
    ] },
    { category: 'Desserts', items: [
      dish('tiramisu', 'Tiramisu', 'Mascarpone, espresso-soaked savoiardi, cocoa.', 550, { k: 'dessert', pop: true, i: 'Mascarpone, Savoiardi, Espresso, ~Cocoa', t: 'v', a: 'gluten egg milk' }),
      dish('pannacotta', 'Panna cotta', 'Softly set vanilla cream with berry compote.', 550, { k: 'dessert', i: 'Vanilla cream, ~Berry compote', t: 'v gf', a: 'milk' }),
      dish('cannoli', 'Cannoli (2)', 'Crisp shells filled with sweet ricotta and pistachio.', 590, { k: 'dessert', i: 'Pastry shells, Sweet ricotta, ~Pistachio, ~Candied orange', t: 'v n', a: 'gluten milk nuts' }),
      dish('affogato', 'Affogato', 'Fior di latte gelato drowned in hot espresso.', 520, { k: 'dessert', i: 'Fior di latte gelato, Espresso', t: 'v gf', a: 'milk' })
    ] }
  ]
};
