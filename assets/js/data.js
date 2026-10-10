/* =============================================================
   Stock Manager — warehouse data
   A shop floor modelled as locations (rows/aisles) + shelves.
   Nothing here is sold online: the boss uses it to find stock
   and to know what needs reordering.
   ============================================================= */

/* ---------- locations: one per row / aisle ---------- */
const LOCATIONS = [
  { id:'L01', row:1,  name:'Row 1 — Fresh Produce',   zone:'Entrance, left end',      contact:'Marta Kowalska',   email:'marta@store.example',   phone:'+1 (555) 201-4471', capacity:1200, created:'3/2/2024' },
  { id:'L02', row:2,  name:'Row 2 — Bakery',          zone:'Entrance, left',          contact:'Tomas Brandt',     email:'tomas@store.example',   phone:'+1 (555) 201-4472', capacity:1000, created:'3/2/2024' },
  { id:'L03', row:3,  name:'Row 3 — Dairy & Chilled', zone:'Left wall',               contact:'Anya Petrova',    email:'anya@store.example',    phone:'+1 (555) 201-4473', capacity:1000, created:'3/10/2024' },
  { id:'L04', row:4,  name:'Row 4 — Meat & Fish',    zone:'Left wall, back',         contact:'Joe Ramirez',     email:'joe@store.example',     phone:'+1 (555) 201-4474', capacity:900,  created:'3/10/2024' },
  { id:'L05', row:5,  name:'Row 5 — Frozen',         zone:'Back wall',               contact:'Sara Lindqvist',  email:'sara@store.example',    phone:'+1 (555) 201-4475', capacity:900,  created:'4/1/2024' },
  { id:'L06', row:6,  name:'Row 6 — Grocery & Food', zone:'Centre',                  contact:'Dev Patel',       email:'dev@store.example',     phone:'+1 (555) 201-4476', capacity:1500, created:'4/1/2024' },
  { id:'L07', row:7,  name:'Row 7 — Beverages',      zone:'Centre, back',            contact:'Nina Okafor',     email:'nina@store.example',    phone:'+1 (555) 201-4477', capacity:1000, created:'4/18/2024' },
  { id:'L08', row:8,  name:'Row 8 — Snacks & Sweets',zone:'Right wall',              contact:'Luis Moreno',     email:'luis@store.example',    phone:'+1 (555) 201-4478', capacity:1100, created:'4/18/2024' },
  { id:'L09', row:9,  name:'Row 9 — Household',      zone:'Right wall, middle',     contact:'Emma Clarke',     email:'emma@store.example',    phone:'+1 (555) 201-4479', capacity:1200, created:'5/6/2024' },
  { id:'L10', row:10, name:'Row 10 — Personal Care', zone:'Right wall, back',       contact:'Hannah Weiss',    email:'hannah@store.example',  phone:'+1 (555) 201-4480', capacity:1300, created:'5/6/2024' },
  { id:'L11', row:11, name:'Row 11 — Pet Care',      zone:'Back right',              contact:'Omar Haddad',     email:'omar@store.example',    phone:'+1 (555) 201-4481', capacity:800,  created:'5/22/2024' },
  { id:'L12', row:12, name:'Row 12 — Baby & Child',  zone:'Back right, far end',    contact:'Grace Miller',    email:'grace@store.example',   phone:'+1 (555) 201-4482', capacity:1000, created:'5/22/2024' },
  { id:'L13', row:0,  name:'Back Room — Bulk Bay',   zone:'Staff only, key access', contact:'Omar Haddad',     email:'omar@store.example',    phone:'+1 (555) 201-4481', capacity:2000, created:'6/3/2024', reserve:true },
  { id:'L14', row:13, name:'Row 13 — Electrical & Lighting', zone:'Annex hall',  contact:'',                 email:'',                    phone:'',                  capacity:20000, created:'2/10/2026' }
];

/* ---------- categories ---------- */
const CATEGORIES = [
  { id:'produce',   name:'Fresh Produce',    hue:128 },
  { id:'bakery',    name:'Bakery',           hue:32  },
  { id:'dairy',     name:'Dairy & Chilled',  hue:205 },
  { id:'meat',      name:'Meat & Fish',      hue:355 },
  { id:'frozen',    name:'Frozen',           hue:190 },
  { id:'grocery',   name:'Grocery & Food',   hue:44  },
  { id:'beverages', name:'Beverages',        hue:12  },
  { id:'snacks',    name:'Snacks & Sweets',  hue:288 },
  { id:'household', name:'Household',        hue:165 },
  { id:'personal',  name:'Personal Care',    hue:320 },
  { id:'pet',       name:'Pet Care',         hue:24  },
  { id:'baby',      name:'Baby & Child',     hue:262 },
  { id:'electrical', name:'Electrical & Lighting', hue:230 }
];

/* ---------- products ----------
   p(name, brand, cat, desc, row, shelf, stock, cap, reorder, cost, price, sup, sd) */
let _pid = 0;
function p(name, brand, cat, desc, row, shelf, stock, cap, reorder, cost, price, sup, sd) {
  _pid++;
  return {
    id: 'SKU-' + String(_pid).padStart(4, '0'),
    barcode: '880' + String(_pid).padStart(10, '0'),
    name, brand, cat, desc, row, shelf,
    stock, cap, reorder, cost, price, sup, sd: sd || 0
  };
}

const PRODUCTS = [
  /* ---- Row 1 · Fresh Produce ---- */
  p('Bananas Loose (per kg)','Freshline','produce','Yellow Cavendish, sold loose',1,1,45,60,20,0.62,1.09,'FR',5),
  p('Red Apples Loose (per kg)','Freshline','produce','Cox & Gala, sold loose',1,1,30,50,15,0.85,1.49,'FR',14),
  p('Gala Apples 1kg Bag','Freshline','produce','Single layer bag',1,1,18,40,10,1.10,1.99,'FR',14),
  p('Oranges Loose (per kg)','Freshline','produce','Navel oranges, sold loose',1,1,22,45,12,0.78,1.35,'FR',14),
  p('Lemons 4pk Bag','Freshline','produce','Unwaxed, bagged',1,2,14,30,8,0.95,1.79,'FR',14),
  p('Avocado Each','Freshline','produce','Ready to eat, checked daily',1,2,5,25,12,0.85,1.50,'FR',6),
  p('Red Grapes 500g','Freshline','produce','Seedless, punnet',1,2,9,20,6,1.65,2.99,'FR',7),
  p('Tomatoes Loose (per kg)','Freshline','produce','Vine ripened, sold loose',1,2,12,25,8,1.25,2.29,'FR',8),
  p('Cucumber Each','Freshline','produce','Gherkin size',1,3,24,40,12,0.42,0.79,'FR',9),
  p('Bell Peppers Each','Freshline','produce','Mixed red, yellow, green',1,3,16,36,12,0.55,0.99,'FR',9),
  p('Broccoli Each','Freshline','produce','Whole head, British',1,3,0,18,8,0.65,1.19,'FR',6),
  p('Carrots 1kg Bag','Freshline','produce','Washed, bagged',1,3,20,35,10,0.55,0.99,'FR',16),
  p('Potatoes 2.5kg Bag','Freshline','produce','Maris Piper',1,4,22,30,10,1.45,2.79,'FR',25),
  p('Red Onions 1kg','Freshline','produce','Medium size',1,4,25,35,10,0.70,1.25,'FR',25),
  p('Garlic 3 Bulbs','Freshline','produce','Jumbo bulbs',1,4,11,20,6,0.80,1.45,'FR',30),
  p('Mushrooms 250g','Freshline','produce','White, punnet',1,4,8,18,6,0.90,1.65,'FR',5),
  p('Iceberg Lettuce Each','Freshline','produce','Whole iceberg',1,5,15,24,8,0.55,0.99,'FR',7),
  p('Salad Leaves 200g','Freshline','produce','Triple washed',1,5,10,20,6,1.05,1.95,'FR',6),
  p('Spring Onions Bunch','Freshline','produce','Per bunch',1,5,9,18,6,0.50,0.95,'FR',8),
  p('Coriander Bunch','Freshline','produce','Fresh herb',1,5,4,12,4,0.45,0.89,'FR',4),

  /* ---- Row 2 · Bakery ---- */
  p('White Sliced Loaf 800g','Mill Rise','bakery','Soft white, 28 slices',2,1,26,40,15,0.75,1.35,'NF',3),
  p('Wholemeal Sliced Loaf 800g','Mill Rise','bakery','Seeded-free wholemeal',2,1,24,40,15,0.85,1.49,'NF',3),
  p('Seeded Farmhouse Loaf','Mill Rise','bakery','Five seed, thick cut',2,1,12,24,8,1.10,1.99,'NF',3),
  p('Sourdough Loaf','Mill Rise','bakery','Slow fermented, 24h',2,1,7,16,6,1.45,2.75,'NF',2),
  p('Bagels 6pk','Mill Rise','bakery','Plain, bakery fresh',2,2,18,28,10,0.95,1.79,'NF',4),
  p('Burger Buns 8pk','Mill Rise','bakery','Sesame topped',2,2,10,20,8,1.15,2.09,'NF',3),
  p('Soft White Rolls 8pk','Mill Rise','bakery','Sponge rolls',2,2,16,26,10,0.85,1.55,'NF',3),
  p('Croissants 4pk','Mill Rise','bakery','All butter',2,3,9,18,6,1.35,2.49,'NF',2),
  p('Pain au Chocolat 2pk','Mill Rise','bakery','Two per pack',2,3,11,18,6,1.25,2.35,'NF',2),
  p('Cinnamon Swirls 4pk','Mill Rise','bakery','Iced swirls',2,3,6,16,6,1.30,2.45,'NF',2),
  p('Chocolate Gateau 12in','Mill Rise','bakery','Whole cake, serves 10',2,4,4,10,3,2.95,5.49,'NF',6),
  p('Victoria Sponge 10in','Mill Rise','bakery','Sandwich sponge, jam & cream',2,4,5,10,3,2.20,4.25,'NF',5),
  p('Banana Bread Slices 5pk','Mill Rise','bakery','Sliced loaf cake',2,4,8,14,5,1.20,2.35,'NF',4),
  p('Muffins 6pk','Mill Rise','bakery','Blueberry tops',2,5,12,18,6,1.05,1.99,'NF',5),
  p('Mini Cakes 12pk','Mill Rise','bakery','Bitesize, party tray',2,5,7,14,5,1.60,3.25,'NF',8),

  /* ---- Row 3 · Dairy & Chilled ---- */
  p('Whole Milk 2L','Brighton Dairy','dairy','Pasteurised, red top',3,1,30,48,20,0.68,1.15,'BD',10),
  p('Semi Skimmed Milk 2L','Brighton Dairy','dairy','Blue top',3,1,34,48,20,0.68,1.15,'BD',10),
  p('Skimmed Milk 2L','Brighton Dairy','dairy','Green top',3,1,12,30,12,0.70,1.15,'BD',10),
  p('Goat Milk 1L','Brighton Dairy','dairy','Whole, glass bottle',3,1,6,14,5,1.25,2.35,'BD',12),
  p('Mature Cheddar 400g','Brighton Dairy','dairy','12 month mature block',3,2,20,30,10,2.10,3.75,'BD',30),
  p('Mozzarella 125g','Brighton Dairy','dairy','Fior di latte, drained',3,2,14,24,8,0.95,1.79,'BD',21),
  p('Cream Cheese 200g','Brighton Dairy','dairy','Full fat spreadable',3,2,9,18,6,1.15,2.05,'BD',21),
  p('Grated Cheese 200g','Brighton Dairy','dairy','Mature cheddar, ready grated',3,2,16,26,8,1.40,2.49,'BD',21),
  p('Greek Yoghurt 500g','Brighton Dairy','dairy','Strained, 10% fat',3,3,18,28,10,1.05,1.85,'BD',14),
  p('Yoghurt Multipack 6x100g','Brighton Dairy','dairy','Mixed flavours',3,3,22,32,12,1.30,2.35,'BD',14),
  p('Salted Butter 250g','Brighton Dairy','dairy','Block, salted',3,3,26,36,12,0.95,1.65,'BD',40),
  p('Unsalted Butter 250g','Brighton Dairy','dairy','Block, unsalted',3,3,10,24,8,1.05,1.75,'BD',40),
  p('Free Range Eggs 12pk','Brighton Dairy','dairy','Free range, large',3,4,20,36,15,1.40,2.75,'BD',21),
  p('Free Range Eggs 6pk','Brighton Dairy','dairy','Free range, large',3,4,12,24,8,0.80,1.55,'BD',21),
  p('Double Cream 300ml','Brighton Dairy','dairy','48% fat',3,4,8,16,6,0.85,1.55,'BD',10),
  p('Coleslaw 300g','Brighton Dairy','dairy','Chilled, dressed',3,4,7,14,5,0.90,1.65,'BD',8),
  p('Fresh Penne Pasta 500g','Brighton Dairy','dairy','Chilled, dry',3,5,11,20,8,0.95,1.85,'BD',12),
  p('Soup of the Week 400g','Brighton Dairy','dairy','Rotating recipe',3,5,5,12,4,2.10,3.95,'BD',4),

  /* ---- Row 4 · Meat & Fish ---- */
  p('Beef Mince 12% 500g','Fieldsworth','meat','British beef, 12% fat',4,1,16,24,10,2.85,4.95,'MS',4),
  p('Beef Steak Cuts 2pk','Fieldsworth','meat','Rump, trimmed',4,1,8,16,6,4.20,6.99,'MS',5),
  p('Pork Chops 4pk','Fieldsworth','meat','Bone-in chops',4,1,9,16,6,3.10,5.49,'MS',4),
  p('Bacon Rashers 300g','Fieldsworth','meat','Smoked, back bacon',4,2,18,28,10,1.95,3.25,'NF',14),
  p('Pork Sausages 8pk','Fieldsworth','meat','Pork & beef, 12pk per case',4,2,20,30,12,1.75,2.95,'NF',7),
  p('Chicken Breast Fillets 600g','Fieldsworth','meat','Boneless, skinless',4,2,15,24,10,3.40,5.75,'MS',3),
  p('Whole Chicken 1.4kg','Fieldsworth','meat','Free range, oven ready',4,3,6,12,5,3.95,6.49,'MS',3),
  p('Chicken Drumsticks 800g','Fieldsworth','meat','Skin on, 8 pack',4,3,12,20,8,2.60,4.35,'MS',3),
  p('Salmon Fillets 2pk','Dayboat Fish','meat','Scottish, skin on',4,3,7,14,5,4.85,7.95,'MS',2),
  p('White Fish Fillets 300g','Dayboat Fish','meat','Cod loin, frozen at sea',4,4,10,18,6,3.20,5.25,'MS',2),
  p('Smoked Haddock 200g','Dayboat Fish','meat','Oak smoked',4,4,5,12,4,3.75,6.25,'MS',5),
  p('Cooked Ham Slices 150g','Delish','meat','Honey cured, sliced',4,4,14,24,8,1.45,2.55,'NF',10),
  p('Salami 200g','Delish','meat','Sliced, chorizo style',4,5,9,16,6,2.15,3.65,'NF',30),
  p('Mixed Olives 200g','Delish','meat','Pitted, jarred',4,5,11,18,6,1.60,2.85,'NF',45),
  p('Antipasti Selection 250g','Delish','meat','Cured meats, olives, cheese',4,5,6,12,4,2.60,4.45,'NF',12),

  /* ---- Row 5 · Frozen ---- */
  p('Fish Fingers 12pk','Icesea','frozen','Battered, 12 pieces',5,1,14,24,8,1.85,3.25,'NF',180),
  p('Chicken Nuggets 20pk','Icesea','frozen','Breaded, 20 pieces',5,1,18,28,10,2.25,3.95,'NF',180),
  p('Garden Peas 1kg','Icesea','frozen','Grade A, 10oz bags',5,1,12,22,8,1.05,1.95,'NF',365),
  p('Mixed Vegetables 1kg','Icesea','frozen','Carrot, peas, sweetcorn',5,2,15,24,8,1.15,2.15,'NF',365),
  p('Oven Chips 1kg','Icesea','frozen','Straight cut, 10oz bags',5,2,22,32,12,0.95,1.75,'NF',180),
  p('Straight Cut Fries 750g','Icesea','frozen','Thick cut, 6oz bags',5,2,10,20,8,0.90,1.65,'NF',180),
  p('Hash Browns 500g','Icesea','frozen','Oven ready',5,3,9,16,6,0.80,1.45,'NF',180),
  p('Margherita Pizza 12in','Icesea','frozen','Stone baked, 4 pack',5,3,16,24,8,1.45,2.75,'NF',365),
  p('Pepperoni Pizza 12in','Icesea','frozen','Spicy, 4 pack',5,3,14,24,8,1.75,3.25,'NF',365),
  p('Vanilla Ice Cream 2L','Icesea','frozen','Madagascar vanilla',5,4,12,20,8,1.85,3.49,'NF',365),
  p('Chocolate Ice Cream 2L','Icesea','frozen','Belgian chocolate',5,4,10,20,8,1.85,3.49,'NF',365),
  p('Waffles 8pk','Icesea','frozen','Belgian style',5,5,7,14,5,1.65,3.15,'NF',180),
  p('Frozen Garlic Bread 2pk','Icesea','frozen','Sliced, with butter',5,5,13,22,8,1.05,1.95,'NF',180),
  p('Spring Rolls 10pk','Icesea','frozen','Vegetable, 10 pieces',5,5,9,16,6,1.45,2.75,'NF',180),

  /* ---- Row 6 · Grocery & Food ---- */
  p('Spaghetti 500g','Storia','grocery','Bronze cut penne',6,1,24,40,12,0.45,0.85,'KC',365),
  p('Penne 500g','Storia','grocery','Bronze cut penne',6,1,22,40,12,0.45,0.85,'KC',365),
  p('Lasagne Sheets 500g','Storia','grocery','Fresh egg pasta',6,1,8,18,6,0.85,1.55,'KC',365),
  p('Couscous 500g','Storia','grocery','Whole wheat couscous',6,2,11,20,8,0.80,1.45,'KC',365),
  p('Long Grain Rice 1kg','Storia','grocery','Easy cook',6,2,26,40,12,0.95,1.75,'KC',365),
  p('Basmati Rice 1kg','Storia','grocery','Extra long grain',6,2,16,30,10,1.65,2.95,'KC',365),
  p('Plain Flour 1.5kg','Storia','grocery','Strong white',6,2,12,24,8,0.65,1.15,'KC',300),
  p('Granulated Sugar 1kg','Storia','grocery','White caster',6,2,20,30,10,0.70,1.15,'KC',365),
  p('Butterflies 250g','Storia','grocery','Golden, frozen',6,3,7,14,5,0.70,1.25,'KC',180),
  p('Golden Syrup 1kg','Storia','grocery','Laminated dough',6,3,8,14,5,0.90,1.55,'KC',365),
  p('Chopped Tomatoes 400g','Storia','grocery','Italian grown',6,3,30,48,20,0.32,0.65,'KC',730),
  p('Sweetcorn 400g Tin','Storia','grocery','Sweetcorn kernels',6,3,18,32,12,0.38,0.75,'KC',730),
  p('Tinned Tomatoes 400g','Storia','grocery','Plum tomatoes',6,4,26,44,18,0.30,0.60,'KC',730),
  p('Baked Beans 400g','Storia','grocery','In tomato sauce',6,4,20,36,14,0.42,0.80,'KC',730),
  p('Tuna in Oil 145g','Storia','grocery','Skipjack, 5 pack',6,4,22,36,14,0.75,1.35,'KC',730),
  p('Tomato Ketchup 500g','Storia','grocery','Tomato based',6,4,14,26,10,0.70,1.25,'KC',365),
  p('Brown Sauce 250g','Storia','grocery','Sour mash recipe',6,5,12,22,8,0.60,1.10,'KC',365),
  p('Mayonnaise 500g','Storia','grocery','Free range egg',6,5,16,26,10,1.15,2.05,'KC',365),
  p('Olive Oil 500ml','Olivara','grocery','Extra virgin, cold pressed',6,5,9,16,6,2.35,4.15,'KC',730),
  p('Stock Cubes 66g','Storia','grocery','12 vegetable cubes',6,5,18,30,10,0.55,0.95,'KC',365),
  p('Mixed Herbs 30g','Storia','grocery','Dried, glass jar',6,5,10,18,6,0.60,1.10,'KC',365),
  p('Table Salt 750g','Storia','grocery','Fine sea salt',6,5,15,24,8,0.35,0.65,'KC',730),

  /* ---- Row 7 · Beverages ---- */
  p('Still Water 1.5L','Clearspring','beverages','Natural mineral',7,1,40,60,24,0.28,0.55,'AP',365),
  p('Sparkling Water 1L','Clearspring','beverages','Lightly carbonated',7,1,24,40,16,0.45,0.85,'AP',365),
  p('Orange Juice 1L','Sunvale','beverages','Not from concentrate',7,1,18,30,12,1.15,2.05,'AP',21),
  p('Apple Juice 1L','Sunvale','beverages','Pressed, cloudy',7,1,12,24,8,1.10,1.95,'AP',21),
  p('Cola 1.5L','Fizzco','beverages','Family size',7,2,28,44,18,0.85,1.55,'AP',180),
  p('Lemonade 1.5L','Fizzco','beverages','Cloudy, real lemon',7,2,16,28,10,0.65,1.25,'AP',180),
  p('Ginger Beer 1L','Fizzco','beverages','Fiery, 6 pack',7,2,12,22,8,0.75,1.45,'AP',180),
  p('Tea 80 Bags','Yorkshire Leaf','beverages','80 teabags per box',7,3,20,32,12,1.35,2.45,'AP',365),
  p('Ground Coffee 250g','Yorkshire Leaf','beverages','Medium roast',7,3,14,24,8,2.60,4.75,'AP',180),
  p('Instant Coffee 200g','Yorkshire Leaf','beverages','Freeze dried',7,3,10,20,8,2.85,5.15,'AP',365),
  p('Energy Drink 500ml','Voltix','beverages','4 pack, 500ml cans',7,4,22,36,14,0.85,1.65,'AP',270),
  p('Sports Drink 750ml','Voltix','beverages','2 pack, sports cap',7,4,16,28,10,0.75,1.45,'AP',270),
  p('Lager 4x330ml','Kestrel','beverages','4 pack, 4.2% ABV',7,5,20,32,12,3.20,5.49,'AP',180),
  p('Cider 4x330ml','Kestrel','beverages','4 pack, 5.5% ABV',7,5,12,24,8,3.60,6.15,'AP',180),
  p('Red Wine 75cl','Vinewood','beverages','Cabernet Sauvignon',7,5,9,16,6,4.95,8.49,'AP',1095),

  /* ---- Row 8 · Snacks & Sweets ---- */
  p('Salted Crisps 150g','Crisp Co','snacks','Sharing bag, 6 pack',8,1,34,50,20,0.60,1.15,'KC',120),
  p('Ready Salted Crisps 150g','Crisp Co','snacks','Sharing bag, 6 pack',8,1,30,50,20,0.60,1.15,'KC',120),
  p('Tortilla Chips 175g','Crisp Co','snacks','Trio pack',8,1,22,36,14,0.85,1.55,'KC',120),
  p('Chocolate Digestives 400g','Biscotti','snacks','Coated biscuits',8,2,20,32,12,0.95,1.75,'KC',180),
  p('Rich Tea Biscuits 400g','Biscotti','snacks','Sugar biscuits',8,2,16,28,10,0.80,1.45,'KC',180),
  p('Water Biscuits 200g','Biscotti','snacks','Crispbread style',8,2,12,20,8,0.65,1.20,'KC',180),
  p('Oat Biscuits 350g','Biscotti','snacks','High fibre',8,2,15,26,10,0.85,1.55,'KC',180),
  p('Milk Chocolate Bar 100g','Cocoa Lane','snacks','Sharing bar',8,3,40,60,24,0.70,1.35,'KC',365),
  p('Dark Chocolate Bar 100g','Cocoa Lane','snacks','70% cocoa',8,3,26,40,16,0.85,1.55,'KC',365),
  p('White Chocolate 90g','Cocoa Lane','snacks','With sea salt',8,3,18,32,12,0.80,1.50,'KC',365),
  p('Gummy Bears 300g','Sweetworks','snacks','Fruit flavoured, 5 pack',8,4,22,36,14,0.95,1.75,'KC',365),
  p('Jelly Babies 300g','Sweetworks','snacks','Assorted, 5 pack',8,4,16,28,10,0.90,1.65,'KC',365),
  p('Chewing Gum 12pk','Freshmint','snacks','Sugar free, 12 sticks',8,4,20,32,12,1.10,2.05,'KC',365),
  p('Salted Peanuts 200g','Nutfield','snacks','Dry roasted',8,4,10,20,8,0.95,1.75,'KC',180),
  p('Mixed Nuts 250g','Nutfield','snacks','Cashew, almond, hazelnut',8,5,12,20,8,1.65,2.95,'KC',180),
  p('Salted Crackers 200g','Crisp Co','snacks','Water biscuits, 2 pack',8,5,14,24,8,0.80,1.45,'KC',150),

  /* ---- Row 9 · Household ---- */
  p('Washing Powder 2kg','Purecycle','household','Non bio, 40 washes',9,1,20,30,10,4.20,7.49,'CS',730),
  p('Liquid Detergent 1.5L','Purecycle','household','Non bio, 30 washes',9,1,18,28,10,4.85,8.49,'CS',730),
  p('Fabric Softener 1L','Purecycle','household','Lavender fresh',9,1,14,24,8,2.10,3.85,'CS',730),
  p('Stain Remover Spray 500ml','Purecycle','household','Pre-treatment spray',9,2,12,20,8,1.45,2.65,'CS',730),
  p('Dishwasher Tablets 50pk','Purecycle','household','All in one, 3 pack',9,2,16,26,10,3.95,6.99,'CS',730),
  p('Washing Up Liquid 900ml','Purecycle','household','Lemon, 2 pack',9,2,22,34,12,0.95,1.75,'CS',730),
  p('Bleach 750ml','Clearview','household','Thickened',9,3,18,28,10,0.65,1.20,'CS',730),
  p('Glass Cleaner 750ml','Clearview','household','Streak free',9,3,14,24,8,0.75,1.40,'CS',730),
  p('Multi Surface Cleaner 1L','Clearview','household','Pine, trigger spray',9,3,20,32,12,1.05,1.95,'CS',730),
  p('Disinfectant Spray 750ml','Clearview','household','Kills 99.9%',9,4,12,20,8,1.15,2.15,'CS',730),
  p('Kitchen Roll 2pk','Softline','household','2 rolls per pack',9,4,26,40,16,1.35,2.55,'CS',730),
  p('Toilet Roll 4pk','Softline','household','3 ply, quilted',9,4,30,48,20,1.65,3.25,'CS',730),
  p('Kitchen Sponge 5pk','Softline','household','Heavy duty',9,4,18,30,10,0.55,1.05,'CS',730),
  p('Bin Bags 30pk','Softline','household','30 litre, 3 roll',9,5,14,24,8,1.25,2.45,'CS',730),
  p('Kitchen Foil 10m','Softline','household','Extra wide',9,5,10,18,6,1.15,2.15,'CS',730),
  p('Cling Film 30m','Softline','household','Microwave safe',9,5,9,16,6,1.20,2.25,'CS',730),
  p('Air Freshener 300g','Zephyr','household','Solid gel, 3 pack',9,5,12,20,8,1.65,2.95,'CS',365),
  p('Fabric Refill 300ml','Zephyr','household','Unscented refill',9,5,10,18,6,1.85,3.35,'CS',365),

  /* ---- Row 10 · Personal Care ---- */
  p('Anti-Dandruff Shampoo 400ml','Vitalis','personal','Zinc pyrithione, 2 pack',10,1,18,28,10,2.15,3.99,'VP',730),
  p('Volume Shampoo 500ml','Vitalis','personal','Volumising, 2 pack',10,1,16,26,10,1.95,3.69,'VP',730),
  p('Moisturising Shampoo 400ml','Vitalis','personal','For dry hair',10,1,20,30,12,2.05,3.85,'VP',730),
  p('Colour Protect Shampoo 300ml','Vitalis','personal','For dyed hair',10,2,12,20,8,2.35,4.35,'VP',730),
  p('Deep Repair Conditioner 300ml','Vitalis','personal','Bonds and rebuilds',10,2,15,24,8,2.25,4.15,'VP',730),
  p('Volume Conditioner 400ml','Vitalis','personal','Pairs with volume shampoo',10,2,11,20,8,2.05,3.79,'VP',730),
  p('Body Wash 500ml','Verdant','personal','Aloe and cucumber',10,3,20,32,12,1.15,2.25,'VP',730),
  p('Shower Gel 250ml','Verdant','personal','Coconut, 4 pack',10,3,18,28,10,0.95,1.89,'VP',730),
  p('Bath Soak 500g','Verdant','personal','Foam bath salts',10,3,10,18,6,1.05,1.95,'VP',730),
  p('Bar Soap 4pk','Verdant','personal','Triple milled',10,3,26,40,16,0.85,1.55,'VP',730),
  p('Liquid Hand Soap 250ml','Verdant','personal','Pump bottle',10,4,18,28,10,1.05,1.95,'VP',730),
  p('Toothpaste 100ml','Brightsmile','personal','Fluoride, 2 pack',10,4,24,36,14,1.45,2.79,'VP',730),
  p('Whitening Toothpaste 75ml','Brightsmile','personal','Hydrogen peroxide',10,4,14,24,8,2.15,3.95,'VP',730),
  p('Mouthwash 500ml','Brightsmile','personal','Fluoride, 6 hour',10,4,10,18,6,1.85,3.45,'VP',730),
  p('Sanitary Towels 8pk','Careline','personal','Day, regular',10,4,20,30,12,1.65,3.15,'VP',730),
  p('Panty Liners 20pk','Careline','personal','Everyday, unscented',10,4,14,24,8,1.05,2.05,'VP',730),
  p('Deodorant Spray 150ml','Zephyr','personal','48 hour, 2 pack',10,5,22,34,12,1.25,2.45,'VP',730),
  p('Roll-On Deodorant 50ml','Zephyr','personal','For sensitive skin',10,5,16,26,10,1.05,1.99,'VP',730),
  p('Hand Cream 100ml','Verdant','personal','Non greasy, 2 pack',10,5,12,20,8,1.75,3.25,'VP',365),
  p('Facial Moisturiser 250ml','Verdant','personal','SPF 30, daily',10,5,8,16,6,3.45,6.25,'VP',365),
  p('Shaving Gel 200ml','Verdant','personal','Sensitive skin',10,5,10,18,6,1.45,2.75,'VP',730),

  /* ---- Row 11 · Pet Care ---- */
  p('Dog Food Chunks 2kg','Paws & Co','pet','Adult, chicken',11,1,20,30,10,1.85,3.29,'PP',365),
  p('Dog Food Pouches 12pk','Paws & Co','pet','Wet, mixed flavours',11,1,24,36,14,2.60,4.65,'PP',365),
  p('Puppy Food 800g','Paws & Co','pet','Large breed, 4 pack',11,1,8,14,5,1.65,2.95,'PP',365),
  p('Cat Food Pouches 12pk','Paws & Co','pet','Wet, in jelly',11,2,26,40,16,2.45,4.45,'PP',365),
  p('Dry Cat Food 2kg','Paws & Co','pet','Adult, fish',11,2,16,26,10,2.10,3.79,'PP',365),
  p('Kitten Food 800g','Paws & Co','pet','From 4 months',11,2,9,16,6,1.75,3.15,'PP',365),
  p('Cat Litter 10L','Paws & Co','pet','Clumping, 2 pack',11,3,18,28,10,2.25,4.15,'PP',365),
  p('Dog Biscuits 500g','Paws & Co','pet','Meat flavoured',11,3,14,24,8,1.15,2.15,'PP',365),
  p('Cat Treats 100g','Paws & Co','pet','Crunchy sticks',11,3,12,20,8,1.35,2.55,'PP',365),
  p('Dog Chews 6pk','Paws & Co','pet','Rawhide alternatives',11,3,10,18,6,1.55,2.85,'PP',365),
  p('Flea & Tick Drops 3pk','Paws & Co','pet','Topical, 3 month',11,4,8,14,5,6.45,12.49,'PP',365),
  p('Pet Bowl','Paws & Co','pet','Stainless steel, non slip',11,4,10,18,6,1.45,2.75,'PP',0),
  p('Dog Rope Toy','Paws & Co','pet','Cotton rope, 3 pack',11,5,12,20,8,1.25,2.45,'PP',0),
  p('Cat Scratching Post','Paws & Co','pet','Sisal wrapped, 90cm',11,5,4,8,3,5.95,11.99,'PP',0),

  /* ---- Row 12 · Baby & Child ---- */
  p('Nappies Size 4 24pk','Babycare','baby','Weight 9-14kg',12,1,20,30,12,4.35,7.99,'BC',0),
  p('Nappies Size 5 22pk','Babycare','baby','Weight 12-17kg',12,1,18,28,10,4.85,8.99,'BC',0),
  p('Baby Wipes 72pk','Babycare','baby','Water based, 6 pack',12,1,24,36,14,1.35,2.65,'BC',0),
  p('Wet Wipes 64pk','Babycare','baby','Fragrance free',12,2,16,26,10,0.95,1.89,'BC',0),
  p('Newborn Formula 800g','Nurtura','baby','Stage 1, from birth',12,2,12,20,8,7.95,13.49,'BC',0),
  p('Stage 2 Formula 900g','Nurtura','baby','From 6 months',12,2,10,18,6,8.45,14.25,'BC',0),
  p('Baby Food Purees 6pk','Nurtura','baby','6-12 months, 3 flavours',12,3,14,22,8,2.25,4.15,'BC',0),
  p('Baby Food Jars 6pk','Nurtura','baby','Single fruit, 4-6 months',12,3,12,20,8,2.35,4.29,'BC',0),
  p('Baby Rice Cereal 200g','Nurtura','baby','From 4 months',12,3,8,14,5,1.65,3.15,'BC',0),
  p('Baby Shampoo 300ml','Babycare','baby','Tear free, 2 pack',12,4,12,20,8,1.55,2.95,'BC',0),
  p('Barrier Cream 125g','Babycare','baby','Nappy rash cream',12,4,9,16,6,1.85,3.45,'BC',0),
  p('Children Toothpaste 50ml','Babycare','baby','From 12 months',12,4,11,18,6,1.45,2.75,'BC',0),
  p('Baby Bottles 2pk','Babycare','baby','260ml, wide neck',12,5,8,14,5,3.45,6.49,'BC',0),
  p('Bottle Steriliser','Babycare','baby','Steam, 6 min cycle',12,5,5,10,3,9.95,17.99,'BC',0),
  p('Dummies / Pacifiers 2pk','Babycare','baby','Silicone, 0-6 months',12,5,10,16,6,2.15,4.15,'BC',0)
];

/* ---------- suppliers ---------- */
const SUPPLIERS = {
  FR: 'Freshline Produce',
  NF: 'Northfield Foods',
  BD: 'Brighton Dairy Co.',
  MS: 'Meridian Seafood',
  KC: 'Kestrel Wholesale',
  AP: 'Apex Beverages',
  CS: 'ClearSpring Home',
  VP: 'Vitalis Personal Care',
  PP: 'Paws & Co.',
  BC: 'BabyCare Direct',
  IM: 'File import'
};

/* ---------- stock records ----------
   One record per product in its home row. Roughly a third of the
   range also has back stock in the Back Room bulk bay, so most
   products live in more than one place. */

/* The demo runs against a fixed "today" so nothing drifts out of date. */
const TODAY = new Date(2024, 8, 26, 9, 0);   /* 26 Sep 2024 */

/* Lines the shop has let sit too long, and lines nobody is buying.
   ageDays = days since the last delivery. daysNoSales = units sold in the
   last 30 days. Edit these by hand to suit your own store; anything not
   listed here falls back to the automatic ageing rules below. */
const WATCH_AGED = {
  'White Sliced Loaf 800g': 8,
  'Wholemeal Sliced Loaf 800g': 7,
  'Croissants 4pk': 5,
  'Pain au Chocolat 2pk': 4,
  'Bananas Loose (per kg)': 12,
  'Salad Leaves 200g': 11,
  'Mushrooms 250g': 9,
  'Semi Skimmed Milk 2L': 16,
  'Whole Milk 2L': 14,
  'Greek Yoghurt 500g': 21,
  'Chicken Breast Fillets 600g': 7,
  'Salmon Fillets 2pk': 5,
  'Broccoli Each': 10,
  'Avocado Each': 9,
  'Soup of the Week 400g': 6,
  'Hash Browns 500g': 200,
  'Margherita Pizza 12in': 400
};

const WATCH_SOON = {
  'Coriander Bunch': 2,
  'Cinnamon Swirls 4pk': 0,
  'Victoria Sponge 10in': 3,
  'Red Onions 1kg': 23,
  'White Fish Fillets 300g': 0,
  'Iceberg Lettuce Each': 5,
  'Double Cream 300ml': 8,
  'Spring Rolls 10pk': 179,
  'Mature Cheddar 400g': 28,
  'Tomatoes Loose (per kg)': 5
};

const WATCH_DEAD = [
  'Cat Scratching Post', 'Bottle Steriliser', 'White Wine 75cl',
  'Facial Moisturiser 250ml', 'Sourdough Loaf', 'Antipasti Selection 250g',
  'Smoked Haddock 200g', 'Pork Sausages 8pk', 'Oat Biscuits 350g',
  'Beef Steak Cuts 2pk', 'Kitten Food 800g', 'Dried Herbs'
];

/* Derive restock date, expiry date and 30-day sales for every line.
   sd (shelf life) is 0 for non-perishables, which never expire. */
PRODUCTS.forEach((pr, i) => {
  const r = ((i * 37) % 100) / 100;                 /* deterministic 0..1 */

  /* Fresh lines are dated against their own shelf life, so a short-life
     product rotates often and a long-life one is not forever stale.
     Ambient lines just age somewhere between a few days and a few months. */
  let age;
  if (WATCH_AGED[pr.name] !== undefined)     age = WATCH_AGED[pr.name];
  else if (WATCH_SOON[pr.name] !== undefined) age = WATCH_SOON[pr.name];
  else if (pr.sd > 0 && pr.sd <= 60)         age = Math.round(pr.sd * (0.1 + 0.7 * r));
  else                                       age = Math.round(4 + 70 * r);

  pr.lastRestock = new Date(TODAY.getTime() - age * 864e5);
  pr.expires = pr.sd > 0
    ? new Date(pr.lastRestock.getTime() + pr.sd * 864e5)
    : null;

  if (WATCH_DEAD.includes(pr.name)) pr.sold30 = 0;
  else if (pr.sd > 0) pr.sold30 = Math.round(pr.cap * (0.5 + 2.2 * ((i * 53) % 100) / 100));
  else               pr.sold30 = Math.round(pr.cap * (((i * 71) % 100) / 100) * 0.55);
});

const BACK_ROOM = LOCATIONS.find(l => l.reserve);

const STOCK = PRODUCTS.map(pr => {
  const home = LOCATIONS.find(l => l.row === pr.row);
  const rec = {
    id: pr.id,
    product: pr,
    location: home,
    qty: pr.stock,
    min: pr.reorder,
    reorder: Math.max(pr.cap - pr.stock, pr.reorder),
    lastRestock: pr.lastRestock,
    reserveQty: 0,
    reserveLocation: null
  };
  if (pr.row > 0 && (parseInt(pr.id.replace(/\D/g, ''), 10) % 3 === 0)) {
    /* deterministic third of the range also has back stock */
    rec.reserveQty = 8 + ((pr.stock * 3) % 40);
    rec.reserveLocation = BACK_ROOM;
  }
  return rec;
});

/* ---------- transfers ---------- */
const TRANSFERS = [
  { id:'TR-1041', date:new Date(2024,8,26, 7, 40), product:'Bananas Loose (per kg)',   from:'L01', to:'L13', qty:12, status:'completed', notes:'Overfill morning delivery' },
  { id:'TR-1040', date:new Date(2024,8,26, 8, 15), product:'Anti-Dandruff Shampoo 400ml', from:'L10', to:'L13', qty:8,  status:'completed', notes:'Slow moving, moved to bulk' },
  { id:'TR-1039', date:new Date(2024,8,25,16, 5),  product:'Washing Powder 2kg',       from:'L13', to:'L09', qty:24, status:'completed', notes:'Replen from bulk bay' },
  { id:'TR-1038', date:new Date(2024,8,25,11, 30), product:'Salmon Fillets 2pk',       from:'L04', to:'L13', qty:4,  status:'pending',   notes:'Chilled overflow to back room' },
  { id:'TR-1037', date:new Date(2024,8,24, 9,  5),  product:'Cola 1.5L',               from:'L13', to:'L07', qty:18, status:'completed', notes:'Peak weekend prep' }
];

/* ---------- recent activity ---------- */
const ACTIVITY = [
  { icon:'box',   title:'Bananas Loose (per kg)',        sub:'Row 1, Shelf 1 · order',    delta:-12, at:new Date(2024,8,26, 7, 42) },
  { icon:'box',   title:'Anti-Dandruff Shampoo 400ml',   sub:'Row 10, Shelf 1 · order',   delta:-6,  at:new Date(2024,8,26, 7, 31) },
  { icon:'box',   title:'Washing Powder 2kg',            sub:'Row 9, Shelf 1 · order',    delta:-9,  at:new Date(2024,8,25,16, 2) },
  { icon:'box',   title:'Salmon Fillets 2pk',            sub:'Row 4, Shelf 3 · order',    delta:-3,  at:new Date(2024,8,25,15, 48) },
  { icon:'truck', title:'TR-1041 · Bananas to Back Room',sub:'L01 → L13 · transfer',      delta:-12, at:new Date(2024,8,26, 7, 40) },
  { icon:'truck', title:'TR-1037 · Cola to Row 7',      sub:'L13 → L07 · transfer',      delta:18,  at:new Date(2024,8,24, 9, 5) },
  { icon:'box',   title:'Toothpaste 100ml',             sub:'Row 10, Shelf 4 · order',   delta:-4,  at:new Date(2024,8,24,14, 20) }
];

/* ---------- 7 day activity trend ---------- */
const TREND = {
  labels: ['Sep 20','Sep 21','Sep 22','Sep 23','Sep 24','Sep 25','Sep 26'],
  restocks: [4, 2, 6, 3, 5, 7, 4],
  orders:   [0, 0, 0, 0, 0, 0, 14],
  transfers:[1, 0, 2, 1, 0, 3, 2]
};

/* ---------- inventory (stock-take) sessions ----------
   Filled by the Inventarizatsiya page; persisted via the Store snapshot. */
const INVENTORIES = [];

/* ---------- receipts (chek) — written by the Kassa at every sale.
   Persisted via the Store snapshot; keep only the last few hundred. */
const RECEIPTS = [];
