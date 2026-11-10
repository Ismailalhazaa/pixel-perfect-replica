import type {
  Address, Driver, DriverLocation, LedgerEntry, MenuCategory, MenuItem, MenuItemOptionGroup, Order, OrderItem,
  OrderStatus, Restaurant, Review, Settlement, User, Zone,
} from "@/types";
import burgerImg from "@/assets/food/burger.jpg";
import shawarmaImg from "@/assets/food/shawarma.jpg";
import pizzaImg from "@/assets/food/pizza.jpg";
import sweetsImg from "@/assets/food/sweets.jpg";
import groceryImg from "@/assets/food/grocery.jpg";
import grillImg from "@/assets/food/grill.jpg";
import breakfastImg from "@/assets/food/breakfast.jpg";
import juiceImg from "@/assets/food/juice.jpg";

export interface DB {
  users: User[];
  passwords: Record<string, string>; // userId -> password (mock only)
  zones: Zone[];
  addresses: Address[];
  restaurants: Restaurant[];
  categories: MenuCategory[];
  menuItems: MenuItem[];
  drivers: Driver[];
  driverLocations: DriverLocation[];
  orders: Order[];
  reviews: Review[];
  ledger: LedgerEntry[];
  settlements: Settlement[];
  orderSeq: number;
}

export const DEMO_PASSWORD = "123456";
export const DAMASCUS = { lat: 33.5138, lng: 36.2765 };

/** Deterministic UUID-shaped ids for seed rows. */
function makeIds() {
  let n = 0;
  return (prefix: string) => {
    n += 1;
    const hex = n.toString(16).padStart(12, "0");
    const p = prefix.padEnd(8, "0").slice(0, 8);
    return `${p}-0000-4000-8000-${hex}`;
  };
}

type ItemSeed = [cat: string, name: string, price: number, desc: string];

const sizeGroup = (id: (p: string) => string, mid: number, large: number): MenuItemOptionGroup => ({
  id: id("og"), name: "الحجم", required: true, maxSelect: 1,
  options: [
    { id: id("op"), name: "عادي", priceDelta: 0 },
    { id: id("op"), name: "وسط", priceDelta: mid },
    { id: id("op"), name: "كبير", priceDelta: large },
  ],
});
const extrasGroup = (id: (p: string) => string, extras: [string, number][]): MenuItemOptionGroup => ({
  id: id("og"), name: "إضافات", required: false, maxSelect: 3,
  options: extras.map(([name, priceDelta]) => ({ id: id("op"), name, priceDelta })),
});

interface RestSeed {
  name: string; category: string; description: string; image: string; lat: number; lng: number;
  zones: number[]; prep: number; rating: number; count: number; commission: number;
  sizes?: [number, number]; extras?: [string, number][]; items: ItemSeed[]; isOpen?: boolean;
}

const RESTAURANTS: RestSeed[] = [
  {
    name: "برغر هاوس", category: "برجر", description: "برغر لحم طازج يُشوى على الفحم مع خبز محضّر يومياً",
    image: burgerImg, lat: 33.5165, lng: 36.2878, zones: [0, 1], prep: 20, rating: 4.6, count: 312, commission: 12,
    sizes: [4000, 8000], extras: [["جبنة شيدر إضافية", 3000], ["بيكون بقري", 5000], ["فطر مشوي", 2500]],
    items: [
      ["البرغر", "برغر كلاسيك", 32000, "لحم بقري، خس، بندورة، صوص البيت"],
      ["البرغر", "برغر بالجبنة المزدوجة", 42000, "شريحتا لحم مع جبنة شيدر مذابة"],
      ["البرغر", "برغر دجاج مقرمش", 30000, "صدر دجاج مقرمش مع صوص الثوم"],
      ["البرغر", "برغر الفطر والسويسري", 45000, "فطر مشوي وجبنة سويسرية"],
      ["مقبلات", "بطاطا مقلية", 12000, "بطاطا ذهبية مقرمشة"],
      ["مقبلات", "حلقات بصل", 14000, "حلقات بصل مقرمشة مع صوص"],
      ["مشروبات", "كولا", 6000, "عبوة باردة"],
    ],
  },
  {
    name: "شاورما أبو علي", category: "شاورما", description: "شاورما شامية أصيلة على الطريقة القديمة مع ثومية البيت",
    image: shawarmaImg, lat: 33.5112, lng: 36.3021, zones: [0], prep: 15, rating: 4.8, count: 540, commission: 10,
    sizes: [3000, 6000], extras: [["ثومية إضافية", 1500], ["مخلل", 1000], ["بطاطا داخل السندويشة", 2000]],
    items: [
      ["سندويش", "سندويش شاورما دجاج", 18000, "دجاج متبّل، ثومية، مخلل"],
      ["سندويش", "سندويش شاورما لحم", 24000, "لحم غنم، طحينة، بقدونس وبصل"],
      ["وجبات", "وجبة شاورما عربي", 38000, "شاورما مقطعة مع بطاطا وثومية"],
      ["وجبات", "صحن شاورما دجاج", 42000, "صحن مع أرز وسلطة"],
      ["وجبات", "شاورما سوبر", 30000, "خبز صاج مع شاورما مضاعفة"],
      ["مشروبات", "عيران", 5000, "لبن عيران بارد"],
    ],
  },
  {
    name: "بيتزا نابولي", category: "بيتزا", description: "عجينة مخمّرة 48 ساعة وفرن حطب حقيقي",
    image: pizzaImg, lat: 33.5201, lng: 36.2799, zones: [0, 1], prep: 25, rating: 4.4, count: 198, commission: 12,
    sizes: [10000, 20000], extras: [["موزاريلا إضافية", 5000], ["زيتون", 2000], ["فطر", 3000]],
    items: [
      ["بيتزا", "بيتزا مارغريتا", 40000, "صلصة بندورة، موزاريلا، ريحان"],
      ["بيتزا", "بيتزا خضار", 44000, "فليفلة، فطر، زيتون، بصل"],
      ["بيتزا", "بيتزا ببروني بقري", 52000, "ببروني بقري مع موزاريلا"],
      ["بيتزا", "بيتزا دجاج باربكيو", 55000, "دجاج مشوي مع صوص باربكيو"],
      ["سلطات", "سلطة سيزر", 28000, "خس، خبز محمص، بارميزان"],
      ["مقبلات", "خبز بالثوم", 15000, "خبز محمص بزبدة الثوم"],
      ["مشروبات", "ليموناضة", 9000, "ليمون طازج بالنعناع"],
    ],
  },
  {
    name: "حلويات الشام", category: "حلويات", description: "حلويات دمشقية بالسمن العربي والفستق الحلبي",
    image: sweetsImg, lat: 33.5089, lng: 36.2901, zones: [0, 1], prep: 10, rating: 4.9, count: 421, commission: 15,
    items: [
      ["شرقي", "كنافة نابلسية", 35000, "صحن كنافة بالجبنة مع القطر"],
      ["شرقي", "بقلاوة بالفستق (ربع كيلو)", 60000, "بقلاوة فستق حلبي"],
      ["شرقي", "معمول بالتمر (علبة)", 45000, "12 قطعة"],
      ["شرقي", "بلّورية", 55000, "فستق حلبي وكنافة ناعمة"],
      ["مثلجات", "بوظة عربية بالقشطة", 20000, "بوظة مدقوقة بالفستق"],
      ["مثلجات", "رز بحليب", 12000, "بماء الورد والفستق"],
    ],
  },
  {
    name: "سوبرماركت الياسمين", category: "بقالة", description: "كل حاجيات البيت توصلك خلال نصف ساعة",
    image: groceryImg, lat: 33.5150, lng: 36.2700, zones: [0, 1], prep: 10, rating: 4.3, count: 87, commission: 8,
    items: [
      ["أساسيات", "خبز عربي (ربطة)", 4000, "ربطة خبز طازج"],
      ["أساسيات", "حليب طازج 1 لتر", 9000, "حليب بقري مبستر"],
      ["أساسيات", "بيض (30 بيضة)", 48000, "بيض بلدي"],
      ["خضار وفواكه", "بندورة (1 كغ)", 7000, "بندورة بلدية"],
      ["خضار وفواكه", "موز (1 كغ)", 15000, "موز مستورد"],
      ["منظفات", "مسحوق غسيل 3 كغ", 55000, "للغسالات الأوتوماتيك"],
      ["مشروبات", "مياه معدنية (6 عبوات)", 12000, "عبوات 1.5 لتر"],
      ["أساسيات", "زيت زيتون 1 لتر", 70000, "زيت زيتون بكر"],
    ],
  },
  {
    name: "مشاوي الخيمة", category: "مشاوي", description: "مشاوي على الفحم وكباب حلبي ومقبلات شامية",
    image: grillImg, lat: 33.5040, lng: 36.2820, zones: [0, 1], prep: 30, rating: 4.7, count: 265, commission: 12,
    extras: [["خبز إضافي", 2000], ["ثومية", 1500], ["بطاطا مقلية", 8000]],
    items: [
      ["مشاوي", "سيخ شيش طاووق", 35000, "صدر دجاج متبّل"],
      ["مشاوي", "سيخ كباب حلبي", 40000, "لحم غنم مفروم مع بهارات"],
      ["مشاوي", "مشاوي مشكلة (نصف كيلو)", 95000, "كباب، شقف، طاووق"],
      ["مشاوي", "فروج مشوي على الفحم", 70000, "فروج كامل مع ثومية"],
      ["مقبلات", "حمّص", 12000, "حمص بطحينة وزيت زيتون"],
      ["مقبلات", "متبّل", 12000, "باذنجان مشوي بالطحينة"],
      ["مقبلات", "تبولة", 14000, "بقدونس، برغل، بندورة"],
    ],
  },
  {
    name: "فوال وفلافل الميدان", category: "فطور", description: "فطور شامي من فول وفلافل ومناقيش",
    image: breakfastImg, lat: 33.4980, lng: 36.2950, zones: [1], prep: 12, rating: 4.5, count: 154, commission: 10, isOpen: false,
    items: [
      ["فطور", "صحن فول بالزيت", 14000, "فول مدمس مع كمون وزيت"],
      ["فطور", "صحن فتة حمص", 18000, "فتة بالسمن والصنوبر"],
      ["فطور", "سندويش فلافل", 8000, "فلافل، طحينة، خضار"],
      ["مناقيش", "منقوشة زعتر", 7000, "زعتر بلدي وزيت زيتون"],
      ["مناقيش", "منقوشة جبنة", 12000, "جبنة عكاوي"],
      ["مشروبات", "شاي بالنعناع", 4000, "كأس شاي"],
    ],
  },
  {
    name: "عصائر الربيع", category: "عصائر", description: "عصائر طبيعية وكوكتيلات فواكه طازجة",
    image: juiceImg, lat: 33.5185, lng: 36.2950, zones: [0], prep: 8, rating: 4.2, count: 76, commission: 10,
    sizes: [3000, 6000], extras: [["عسل", 2000], ["مكسرات", 4000], ["قشطة", 3000]],
    items: [
      ["عصائر", "عصير برتقال طبيعي", 12000, "برتقال معصور طازج"],
      ["عصائر", "عصير فريز", 14000, "فريز طازج"],
      ["كوكتيل", "كوكتيل أفوكادو", 25000, "أفوكادو مع حليب وعسل"],
      ["كوكتيل", "كوكتيل الربيع", 22000, "طبقات فواكه مشكلة مع قشطة"],
      ["عصائر", "ليموناضة بالنعناع", 10000, "ليمون ونعناع"],
      ["عصائر", "جزر وبرتقال", 13000, "مزيج منعش"],
    ],
  },
];

/** Builds a fresh database. Call lazily (never at module scope). */
export function buildSeed(): DB {
  const id = makeIds();
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const DAY = 86400000;
  const MIN = 60000;
  // deterministic pseudo-random
  let s = 42;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);

  const zones: Zone[] = [
    { id: id("zone"), name: "دمشق - المركز", deliveryFee: 5000, isActive: true },
    { id: id("zone"), name: "دمشق - الأطراف", deliveryFee: 9000, isActive: true },
  ];

  const users: User[] = [];
  const passwords: Record<string, string> = {};
  const addUser = (role: User["role"], name: string, phone: string, email?: string) => {
    const u: User = { id: id("user"), role, name, phone, email, isActive: true, createdAt: iso(60 * DAY) };
    users.push(u);
    passwords[u.id] = DEMO_PASSWORD;
    return u;
  };

  const admin = addUser("ADMIN", "مدير المنصة", "0911000000", "admin@waselni.sy");
  const sara = addUser("CUSTOMER", "سارة الخطيب", "0933111111", "sara@example.sy");
  const mohammad = addUser("CUSTOMER", "محمد العلي", "0933222222");
  void admin;

  const addresses: Address[] = [
    { id: id("addr"), userId: sara.id, label: "البيت - المزة", details: "شارع الجلاء، بناء 12، الطابق 3", lat: 33.5035, lng: 36.2560, zoneId: zones[0].id, isDefault: true },
    { id: id("addr"), userId: sara.id, label: "العمل - أبو رمانة", details: "قرب ساحة النجمة", lat: 33.5160, lng: 36.2830, zoneId: zones[0].id, isDefault: false },
    { id: id("addr"), userId: mohammad.id, label: "البيت - جرمانا", details: "الشارع الرئيسي", lat: 33.4860, lng: 36.3480, zoneId: zones[1].id, isDefault: true },
  ];

  const restaurants: Restaurant[] = [];
  const categories: MenuCategory[] = [];
  const menuItems: MenuItem[] = [];
  RESTAURANTS.forEach((r, i) => {
    const owner = addUser("RESTAURANT", `صاحب ${r.name}`, `09440000${String(i + 1).padStart(2, "0")}`);
    const rest: Restaurant = {
      id: id("rest"), ownerId: owner.id, name: r.name, description: r.description, imageUrl: r.image,
      category: r.category, lat: r.lat, lng: r.lng, zoneIds: r.zones.map((z) => zones[z].id),
      commissionPercent: r.commission, isApproved: true, isOpen: r.isOpen ?? true, acceptingOrders: true,
      avgPrepMinutes: r.prep, ratingAvg: r.rating, ratingCount: r.count,
      workingHours: ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({ day, open: "10:00", close: day === 5 ? "23:59" : "23:00" })),
    };
    restaurants.push(rest);
    const catIds: Record<string, string> = {};
    r.items.forEach(([cat]) => {
      if (!catIds[cat]) {
        const c: MenuCategory = { id: id("cat"), restaurantId: rest.id, name: cat, sortOrder: Object.keys(catIds).length };
        catIds[cat] = c.id;
        categories.push(c);
      }
    });
    r.items.forEach(([cat, name, price, desc], j) => {
      const groups: MenuItemOptionGroup[] = [];
      const isMain = !["مشروبات", "مقبلات", "أساسيات", "منظفات", "خضار وفواكه"].includes(cat);
      if (r.sizes && isMain) groups.push(sizeGroup(id, r.sizes[0], r.sizes[1]));
      if (r.extras && isMain) groups.push(extrasGroup(id, r.extras));
      menuItems.push({
        id: id("item"), restaurantId: rest.id, categoryId: catIds[cat], name, description: desc,
        imageUrl: r.image, price, isAvailable: !(i === 4 && j === 2), optionGroups: groups,
      });
    });
  });

  const drivers: Driver[] = [];
  const driverLocations: DriverLocation[] = [];
  const driverSeeds: [string, Driver["vehicleType"], number, number][] = [
    ["خالد السيد", "MOTORBIKE", 33.5120, 36.2850],
    ["رامي حداد", "MOTORBIKE", 33.5200, 36.2700],
    ["يوسف ديب", "BICYCLE", 33.5070, 36.2950],
    ["علاء نصر", "CAR", 33.4990, 36.2760],
  ];
  driverSeeds.forEach(([name, vehicleType, lat, lng], i) => {
    const u = addUser("DRIVER", name, `09550000${String(i + 1).padStart(2, "0")}`);
    const d: Driver = { id: id("drv"), userId: u.id, vehicleType, isApproved: i !== 3, isAvailable: i < 2, ratingAvg: 4.5 + i * 0.1, ratingCount: 40 + i * 13 };
    drivers.push(d);
    driverLocations.push({ driverId: d.id, lat, lng, updatedAt: iso(0) });
  });

  // ---- orders ----
  const orders: Order[] = [];
  let orderSeq = 1000;
  const customers = [sara, sara, sara, mohammad];
  const plan: { status: OrderStatus; ago: number; rest?: number; driver?: number; cust?: number }[] = [];
  for (let k = 0; k < 17; k++) {
    const status: OrderStatus = k === 5 || k === 11 ? "CANCELLED" : k === 8 ? "REJECTED" : "DELIVERED";
    plan.push({ status, ago: (k * 0.6 + 0.3) * DAY + rnd() * 6 * 3600000 });
  }
  plan.push({ status: "NEW", ago: 4 * MIN, rest: 0, cust: 0 });
  plan.push({ status: "PREPARING", ago: 18 * MIN, rest: 0, cust: 1 });
  plan.push({ status: "ON_THE_WAY", ago: 35 * MIN, rest: 1, driver: 0, cust: 0 });

  plan.forEach((p, k) => {
    const restIdx = p.rest ?? Math.floor(rnd() * restaurants.length);
    const rest = restaurants[restIdx];
    const cust = p.cust !== undefined ? customers[p.cust] : customers[k % customers.length];
    const addr = addresses.find((a) => a.userId === cust.id)!;
    const zone = zones.find((z) => z.id === addr.zoneId)!;
    const restItems = menuItems.filter((m) => m.restaurantId === rest.id);
    const orderId = id("ord");
    const n = 1 + Math.floor(rnd() * 3);
    const items: OrderItem[] = [];
    for (let q = 0; q < n; q++) {
      const mi = restItems[Math.floor(rnd() * restItems.length)];
      const quantity = 1 + Math.floor(rnd() * 2);
      const opts = mi.optionGroups.filter((g) => g.required).map((g) => ({
        groupId: g.id, optionId: g.options[0].id, nameSnapshot: g.options[0].name, priceDeltaSnapshot: g.options[0].priceDelta,
      }));
      items.push({
        id: id("oi"), orderId, menuItemId: mi.id, nameSnapshot: mi.name, unitPriceSnapshot: mi.price, quantity,
        selectedOptions: opts, lineTotal: mi.price * quantity,
      });
    }
    const subtotal = items.reduce((a, b) => a + b.lineTotal, 0);
    const created = now - p.ago;
    const driver = p.driver !== undefined ? drivers[p.driver] : drivers[k % 3];
    const flowTo: Record<string, OrderStatus[]> = {
      DELIVERED: ["NEW", "ACCEPTED", "PREPARING", "READY", "ON_THE_WAY", "DELIVERED"],
      CANCELLED: ["NEW", "CANCELLED"],
      REJECTED: ["NEW", "REJECTED"],
      NEW: ["NEW"],
      PREPARING: ["NEW", "ACCEPTED", "PREPARING"],
      ON_THE_WAY: ["NEW", "ACCEPTED", "PREPARING", "READY", "ON_THE_WAY"],
    };
    const steps = flowTo[p.status];
    const history = steps.map((st, si) => ({
      id: id("hist"), orderId, status: st, createdAt: new Date(created + si * 6 * MIN).toISOString(),
      reason: st === "REJECTED" ? "نفدت بعض المواد" : st === "CANCELLED" ? "ألغى الزبون الطلب" : undefined,
    }));
    const hasDriver = ["DELIVERED", "ON_THE_WAY"].includes(p.status);
    const total = subtotal + zone.deliveryFee;
    orders.push({
      id: orderId, code: `WS-${++orderSeq}`, customerId: cust.id, restaurantId: rest.id,
      driverId: hasDriver ? driver.id : undefined, zoneId: zone.id,
      deliveryAddress: { label: addr.label, details: addr.details, lat: addr.lat, lng: addr.lng },
      customerPhone: cust.phone, status: p.status, subtotal, deliveryFee: zone.deliveryFee, total,
      cashCollected: p.status === "DELIVERED" ? total : undefined,
      estimatedMinutes: rest.avgPrepMinutes + 15, items, history,
      createdAt: new Date(created).toISOString(),
      deliveredAt: p.status === "DELIVERED" ? history[history.length - 1].createdAt : undefined,
    });
  });

  // driver of the ON_THE_WAY order sits between restaurant and customer
  const live = orders.find((o) => o.status === "ON_THE_WAY")!;
  const liveRest = restaurants.find((r) => r.id === live.restaurantId)!;
  const loc = driverLocations.find((l) => l.driverId === live.driverId)!;
  loc.lat = liveRest.lat + (live.deliveryAddress.lat - liveRest.lat) * 0.25;
  loc.lng = liveRest.lng + (live.deliveryAddress.lng - liveRest.lng) * 0.25;
  drivers.find((d) => d.id === live.driverId)!.isAvailable = false;

  const db: DB = {
    users, passwords, zones, addresses, restaurants, categories, menuItems, drivers, driverLocations,
    orders, reviews: [], ledger: [], settlements: [], orderSeq,
  };
  orders.filter((o) => o.status === "DELIVERED").forEach((o) => addDeliveredLedger(db, o, id("led")));
  // give remaining ledger ids
  return db;
}

/** Ledger rules for a delivered order (see types: LedgerType). */
export function addDeliveredLedger(db: DB, o: Order, firstId?: string) {
  const rest = db.restaurants.find((r) => r.id === o.restaurantId);
  if (!rest || !o.driverId) return;
  const commission = Math.round((o.subtotal * rest.commissionPercent) / 100);
  const at = o.deliveredAt ?? new Date().toISOString();
  const mk = (suffix: number) =>
    firstId ? `${firstId.slice(0, 24)}${(parseInt(firstId.slice(24), 16) * 10 + suffix).toString(16).padStart(12, "0")}` : crypto.randomUUID();
  const base = { orderId: o.id, createdAt: at };
  db.ledger.push(
    { id: mk(1), accountType: "DRIVER", accountId: o.driverId, type: "CASH_COLLECTED", amount: o.cashCollected ?? o.total, ...base },
    { id: mk(2), accountType: "DRIVER", accountId: o.driverId, type: "DELIVERY_EARNING", amount: o.deliveryFee, ...base },
    { id: mk(3), accountType: "RESTAURANT", accountId: rest.id, type: "RESTAURANT_PAYABLE", amount: o.subtotal - commission, ...base },
    { id: mk(4), accountType: "RESTAURANT", accountId: rest.id, type: "PLATFORM_COMMISSION", amount: commission, ...base },
  );
}
