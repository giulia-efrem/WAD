'use strict';

const { dish, deal } = require('./_build');

const CURRIES = 'dal chana:100 paneer:300 palak:260 korma:360 butterchicken:400 vindaloo:460 roganjosh:560';

module.exports = {
  deals: [
    deal('curry-night', 'Curry night', 'Any curry with rice or naan, a starter and a drink.', 1690, [
      ['curry', 'Curry', CURRIES],
      ['bread', 'Rice or naan', 'rice naan:40 peshwari:100'],
      ['starter', 'Starter', 'onion-bhaji samosa:30'],
      ['drink', 'Drink', 'lime-soda chai lassi:70']
    ], { pop: true }),
    deal('feast-for-two', 'Feast for two', 'Two curries, a biryani, two naan and a starter.', 3590, [
      ['curry', 'Curry', CURRIES],
      ['curry2', 'Second curry', CURRIES],
      ['biryani', 'Biryani', 'veg-biryani biryani:200'],
      ['bread', 'Naan', 'naan peshwari:60'],
      ['bread2', 'Second naan', 'naan peshwari:60'],
      ['starter', 'Starter', 'onion-bhaji samosa:30']
    ])
  ],
  categories: [
    { category: 'Curries', items: [
      dish('butterchicken', 'Butter chicken', 'Tandoori chicken in a silky tomato, butter and cashew sauce.', 1290, { pop: true, o: ['heat', 'side', 'curryExtras'], i: 'Tandoori chicken, Tomato and butter sauce, ~Cream, ~Coriander', t: 'n', a: 'milk nuts' }),
      dish('paneer', 'Paneer tikka masala', 'Charred paneer, peppers and onion in masala sauce.', 1190, { o: ['heat', 'side', 'curryExtras'], i: 'Charred paneer, Masala sauce, ~Peppers, ~Onion, ~Coriander', t: 'v', a: 'milk' }),
      dish('roganjosh', 'Lamb rogan josh', 'Kashmiri chili, slow-braised lamb shoulder.', 1450, { o: ['heat', 'side'], i: 'Lamb shoulder, Kashmiri chili sauce, ~Coriander', t: 'sp', a: 'milk' }),
      dish('chana', 'Chana masala', 'Chickpeas, tomato, ginger and garam masala. Vegan.', 990, { o: ['heat', 'side'], i: 'Chickpeas, Tomato and ginger sauce, ~Onion, ~Coriander', t: 've' }),
      dish('korma', 'Chicken korma', 'Mild and creamy, with almonds and coconut.', 1250, { o: ['heat', 'side', 'curryExtras'], i: 'Chicken, Korma sauce, ~Flaked almonds, ~Coriander', t: 'n', a: 'milk nuts' }),
      dish('vindaloo', 'Lamb vindaloo', 'A fiery Goan curry with vinegar, garlic and chili.', 1350, { o: ['side'], i: 'Lamb, Vindaloo sauce, ~Coriander', t: 'sp gf', a: 'mustard' }),
      dish('dal', 'Dal makhani', 'Black lentils slow-cooked overnight with butter and cream.', 890, { o: ['side'], i: 'Black lentils, ~Butter, ~Cream', t: 'v gf', a: 'milk' }),
      dish('palak', 'Saag paneer', 'Paneer in a garlicky spinach sauce.', 1150, { o: ['heat', 'side'], i: 'Spinach, Paneer, ~Garlic, ~Cream', t: 'v gf', a: 'milk' })
    ] },
    { category: 'From the tandoor', items: [
      dish('tikka', 'Chicken tikka', 'Charcoal-grilled chicken thigh with mint chutney.', 1190, { i: 'Chicken thigh, Yoghurt marinade, ~Mint chutney, ~Red onion', t: 'gf', a: 'milk' }),
      dish('seekh', 'Lamb seekh kebab', 'Spiced minced lamb skewers with mint chutney.', 1250, { i: 'Minced lamb, Spices, ~Mint chutney, ~Red onion', t: 'sp gf', a: 'milk' }),
      dish('paneer-tikka', 'Paneer tikka', 'Charred paneer, peppers and onion from the tandoor.', 1090, { i: 'Paneer, Peppers, Onion, ~Mint chutney', t: 'v gf', a: 'milk' })
    ] },
    { category: 'Biryani', items: [
      dish('biryani', 'Chicken biryani', 'Layered basmati, saffron, fried onion and raita.', 1350, { pop: true, o: ['heat'], i: 'Basmati rice, Chicken, ~Saffron, ~Fried onion, ~Raita', a: 'milk' }),
      dish('veg-biryani', 'Vegetable biryani', 'Seasonal vegetables layered with saffron basmati.', 1150, { o: ['heat'], i: 'Basmati rice, Seasonal vegetables, ~Saffron, ~Fried onion, ~Raita', t: 'v', a: 'milk' })
    ] },
    { category: 'Breads and rice', items: [
      dish('naan', 'Garlic naan', 'From the tandoor, brushed with garlic butter.', 320, { k: 'side', i: 'Naan, ~Garlic butter', t: 'v', a: 'gluten milk' }),
      dish('peshwari', 'Peshwari naan', 'Sweet naan filled with coconut, almonds and sultanas.', 380, { k: 'side', i: 'Naan, Coconut, Almonds, Sultanas', t: 'v n', a: 'gluten milk nuts' }),
      dish('rice', 'Basmati rice', 'Steamed with cumin.', 280, { k: 'side', i: 'Basmati rice, ~Cumin', t: 've gf' })
    ] },
    { category: 'Starters and sides', items: [
      dish('samosa', 'Vegetable samosas (2)', 'Crisp pastry filled with spiced potato and peas, with tamarind chutney.', 550, { k: 'starter', i: 'Pastry, Spiced potato and peas, ~Tamarind chutney', t: 've', a: 'gluten' }),
      dish('onion-bhaji', 'Onion bhajis (3)', 'Crispy onion fritters with mint chutney.', 520, { k: 'starter', i: 'Onion, Gram flour batter, ~Mint chutney', t: 've gf' }),
      dish('raita', 'Cucumber raita', 'Cool yoghurt with cucumber and mint.', 300, { k: 'side', i: 'Yoghurt, Cucumber, ~Mint', t: 'v gf', a: 'milk' })
    ] },
    { category: 'Drinks', items: [
      dish('lassi', 'Mango lassi', 'Alphonso mango and yoghurt.', 390, { k: 'drink', i: 'Alphonso mango, Yoghurt, ~Ice', t: 'v gf', a: 'milk' }),
      dish('chai', 'Masala chai', 'Black tea brewed with spices and milk.', 330, { k: 'drink', o: ['milk', 'sweetness'], i: 'Black tea, Spices, Milk', t: 'v gf', a: 'milk' }),
      dish('lime-soda', 'Fresh lime soda', 'Fresh lime and soda, sweet or salty.', 320, { k: 'drink', o: ['sweetness'], i: 'Lime, Soda water, ~Salt', t: 've gf' })
    ] },
    { category: 'Desserts', items: [
      dish('gulab', 'Gulab jamun (3)', 'Warm milk dumplings in rose syrup with pistachio.', 450, { k: 'dessert', i: 'Milk dumplings, Rose syrup, ~Pistachio', t: 'v n', a: 'gluten milk nuts' }),
      dish('kulfi', 'Pistachio kulfi', 'Dense, creamy frozen dessert with cardamom.', 420, { k: 'dessert', i: 'Kulfi', t: 'v gf n', a: 'milk nuts' })
    ] }
  ]
};
