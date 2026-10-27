'use strict';

/* What goes into each dish, keyed like seed/images.json. A leading ~ means the customer can
   leave it out ("No basil"); the rest is the dish itself and can't be removed. Sauces and
   toppings that are already a choice (Sauce, Topping, Milk...) are not listed here. */

module.exports = {
  'forno-sette/margherita': ['Pizza dough', '~San Marzano tomato', '~Fior di latte', '~Basil', '~Olive oil'],
  'forno-sette/diavola': ['Pizza dough', '~Tomato sauce', '~Mozzarella', '~Spicy salami', '~Hot honey'],
  'forno-sette/formaggi': ['Pizza dough', '~Mozzarella', '~Gorgonzola', '~Taleggio', '~Parmesan'],
  'forno-sette/funghi': ['Pizza dough', '~Roasted mushrooms', '~Fennel sausage', '~Mozzarella', '~Thyme'],
  'forno-sette/marinara': ['Pizza dough', '~Tomato sauce', '~Garlic', '~Oregano', '~Olive oil'],
  'forno-sette/burrata': ['Burrata', '~Heritage tomatoes', '~Basil oil', '~Sea salt'],
  'forno-sette/focaccia': ['Focaccia', '~Rosemary', '~Garlic butter'],
  'forno-sette/tiramisu': ['Mascarpone', 'Savoiardi', 'Espresso', '~Cocoa'],
  'forno-sette/pellegrino': ['Sparkling water'],

  'smash-society/classic': ['Two beef patties', 'Brioche bun', '~American cheese', '~Pickles', '~Onion'],
  'smash-society/double': ['Four beef patties', 'Brioche bun', '~American cheese', '~Pickles', '~Onion'],
  'smash-society/hothoney': ['Buttermilk fried chicken', 'Brioche bun', '~Hot honey', '~Slaw', '~Pickles'],
  'smash-society/mushroom': ['Crispy portobello', 'Brioche bun', '~Swiss cheese', '~Caramelised onion'],
  'smash-society/fries': ['Skin-on fries', '~Salt'],
  'smash-society/rings': ['Beer-battered onion rings', '~Chipotle dip'],
  'smash-society/vanilla': ['Vanilla ice cream', 'Milk', '~Whipped cream'],
  'smash-society/caramel': ['Vanilla ice cream', 'Milk', '~Caramel drizzle', '~Flaky salt'],

  'bao-and-broth/tonkotsu': ['Pork broth', 'Ramen noodles', '~Chashu pork', '~Soft egg', '~Nori', '~Spring onion'],
  'bao-and-broth/miso': ['Miso and chili broth', 'Ramen noodles', '~Minced pork', '~Corn', '~Beansprouts', '~Spring onion'],
  'bao-and-broth/shoyu': ['Clear soy broth', 'Ramen noodles', '~Chicken thigh', '~Bamboo shoots', '~Soft egg'],
  'bao-and-broth/tantan': ['Sesame and soy milk broth', 'Ramen noodles', '~Spiced tofu', '~Bok choy', '~Chili oil'],
  'bao-and-broth/porkbao': ['Steamed buns', 'Braised pork belly', '~Peanut crumb', '~Pickled cucumber', '~Coriander'],
  'bao-and-broth/tofubao': ['Steamed buns', 'Glazed tofu', '~Kimchi mayo', '~Spring onion'],
  'bao-and-broth/gyoza': ['Pork dumplings', '~Black vinegar dip'],
  'bao-and-broth/edamame': ['Edamame', '~Sea salt', '~Chili'],
  'bao-and-broth/matcha': ['Matcha cream cheese', 'Biscuit base'],

  'kaze-sushi/kazeset': ['Nigiri', 'Maki', 'Signature roll', '~Wasabi', '~Pickled ginger', '~Soy sauce'],
  'kaze-sushi/salmonset': ['Salmon nigiri', 'Salmon maki', 'Salmon avocado uramaki', '~Wasabi', '~Pickled ginger', '~Soy sauce'],
  'kaze-sushi/dragon': ['Prawn tempura', 'Sushi rice', '~Avocado', '~Eel sauce', '~Toasted sesame'],
  'kaze-sushi/california': ['Crab', 'Sushi rice', '~Avocado', '~Cucumber', '~Tobiko'],
  'kaze-sushi/spicytuna': ['Tuna', 'Sushi rice', '~Chili mayo', '~Spring onion', '~Tempura flakes'],
  'kaze-sushi/nigiri': ['Norwegian salmon', 'Seasoned rice', '~Wasabi'],
  'kaze-sushi/misosoup': ['Miso broth', '~Tofu', '~Wakame', '~Spring onion'],
  'kaze-sushi/wakame': ['Wakame seaweed', '~Sesame dressing', '~Sesame seeds'],

  'green-theory/poke': ['Salmon', '~Avocado', '~Edamame', '~Mango', '~Pickled ginger', '~Ponzu'],
  'green-theory/falafel': ['Baked falafel', '~Hummus', '~Tabbouleh', '~Pickled red onion'],
  'green-theory/teriyaki': ['Grilled chicken', '~Broccoli', '~Carrot', '~Sesame', '~Teriyaki glaze'],
  'green-theory/acai': ['Açaí', '~Banana', '~Granola', '~Berries', '~Coconut'],
  'green-theory/greenjuice': ['Apple', 'Cucumber', 'Spinach', '~Lime', '~Ginger'],
  'green-theory/shot': ['Ginger', 'Lemon', '~Cayenne'],

  'taqueria-luna/pastor': ['Marinated pork', '~Grilled pineapple', '~Onion', '~Coriander'],
  'taqueria-luna/birria': ['Slow-braised beef', 'Consommé', '~Melted cheese', '~Onion', '~Coriander'],
  'taqueria-luna/baja': ['Crispy fish', '~Cabbage slaw', '~Chipotle crema'],
  'taqueria-luna/hongos': ['Roasted oyster mushrooms', '~Black beans', '~Salsa macha'],
  'taqueria-luna/burrito': ['Chipotle chicken', 'Flour tortilla', '~Rice', '~Beans', '~Cheese', '~Pico de gallo'],
  'taqueria-luna/nachos': ['Tortilla chips', '~Cheese sauce', '~Jalapeños', '~Guacamole', '~Sour cream'],
  'taqueria-luna/churros': ['Churros', '~Cinnamon sugar', '~Chocolate sauce'],
  'taqueria-luna/horchata': ['Rice milk', '~Cinnamon', '~Ice'],

  'sweet-spot/pistachio': ['Baked cheesecake', '~Pistachio cream'],
  'sweet-spot/lava': ['Chocolate sponge', 'Molten centre', '~Icing sugar'],
  'sweet-spot/carrot': ['Carrot sponge', '~Walnuts', '~Cream cheese frosting'],
  'sweet-spot/cinnamon': ['Cinnamon roll', '~Glaze'],
  'sweet-spot/macarons': ['Assorted macarons'],
  'sweet-spot/gelato': ['Gelato'],

  'morning-club/benedict': ['Poached eggs', 'Toasted muffin', '~Hollandaise'],
  'morning-club/avotoast': ['Sourdough', 'Smashed avocado', '~Feta', '~Chili', '~Lime'],
  'morning-club/pancakes': ['Buttermilk pancakes'],
  'morning-club/shakshuka': ['Baked eggs', 'Spiced tomato', '~Feta', '~Coriander', '~Bread for dipping'],
  'morning-club/flatwhite': ['Double espresso'],
  'morning-club/oj': ['Fresh oranges', '~Ice'],

  'spice-route/butterchicken': ['Tandoori chicken', 'Tomato and butter sauce', '~Cream', '~Coriander'],
  'spice-route/paneer': ['Charred paneer', 'Masala sauce', '~Peppers', '~Onion', '~Coriander'],
  'spice-route/roganjosh': ['Lamb shoulder', 'Kashmiri chili sauce', '~Coriander'],
  'spice-route/chana': ['Chickpeas', 'Tomato and ginger sauce', '~Onion', '~Coriander'],
  'spice-route/biryani': ['Basmati rice', 'Chicken', '~Saffron', '~Fried onion', '~Raita'],
  'spice-route/naan': ['Naan', '~Garlic butter'],
  'spice-route/rice': ['Basmati rice', '~Cumin'],
  'spice-route/lassi': ['Alphonso mango', 'Yoghurt', '~Ice']
};
