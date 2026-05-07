const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const data = require("../data.json");
require("dotenv").config();

// Створюємо пул з'єднань
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// Ініціалізуємо клієнт з адаптером
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("--- Початок повної синхронізації бази даних ---");

  // 1. Очищення бази (порядок важливий через зв'язки)
  await prisma.product.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.heroBanner.deleteMany();
  await prisma.user.deleteMany();

  const categoriesData = [
    {
      name: "Письмове приладдя",
      slug: "writing-supplies",
      subs: [
        { title: "Ручки", slug: "pens", tag: "pen" },
        { title: "Олівці", slug: "pencils", tag: "pencil" },
        { title: "Маркери", slug: "markers", tag: "marker" },
        { title: "Лінери", slug: "liners", tag: "liner" },
      ],
    },
    {
      name: "Паперова продукція",
      slug: "paper-products",
      subs: [
        { title: "Зошити", slug: "notebooks", tag: "notebook" },
        { title: "Блокноти", slug: "notepads", tag: "notepad" },
        { title: "Папір для друку", slug: "printing-paper", tag: "paper" },
        { title: "Кольоровий папір", slug: "color-paper", tag: "color-paper" },
      ],
    },
    {
      name: "Школа та навчання",
      slug: "school",
      subs: [
        { title: "Рюкзаки", slug: "backpacks", tag: "backpack" },
        { title: "Пенали", slug: "pencil-cases", tag: "pencil-case" },
        { title: "Щоденники", slug: "diaries", tag: "diary" },
        {
          title: "Набори для креслення",
          slug: "drawing-sets",
          tag: "geometry",
        },
      ],
    },
    {
      name: "Офісне приладдя",
      slug: "office",
      subs: [
        { title: "Папки та файли", slug: "folders", tag: "folder" },
        { title: "Степлери", slug: "staplers", tag: "stapler" },
        { title: "Органайзери", slug: "organizers", tag: "organizer" },
        { title: "Скріпки", slug: "paper-clip", tag: "paperclip" },
      ],
    },
    {
      name: "Творчість та хобі",
      slug: "creativity",
      subs: [
        { title: "Фарби", slug: "paints", tag: "paint" },
        { title: "Пластилін", slug: "plasticine", tag: "clay" },
        { title: "Мольберти", slug: "canvases", tag: "easel" },
        {
          title: "Набори для творчості",
          slug: "creativity-kits",
          tag: "craft",
        },
      ],
    },
    {
      name: "Подарунки",
      slug: "gifts",
      subs: [
        { title: "Подарункові бокси", slug: "gift-boxes", tag: "giftbox" },
        { title: "Елітні ручки", slug: "premium-pens", tag: "luxury-pen" },
        { title: "Настільні ігри", slug: "board-games", tag: "boardgame" },
        {
          title: "Упаковка та листівки",
          slug: "wrapping-cards",
          tag: "postcard",
        },
      ],
    },
  ];

  const brands = [
    "BIC",
    "Pilot",
    "Axent",
    "Economix",
    "Kite",
    "Koh-i-Noor",
    "Buromax",
    "Leo",
  ];

  // 2. Створення категорій та товарів
  for (const cat of categoriesData) {
    const createdCat = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        subcategories: {
          // ДОДАЄМО i як другий аргумент у map
          create: cat.subs.map((sub, i) => ({
            title: sub.title,
            href: `/category/${cat.slug}/${sub.slug}`,
            // Використовуємо i для фіксації зображення
            image: `https://loremflickr.com/320/240/${sub.tag},stationery?lock=${cat.slug}${i}`,
          })),
        },
      },
      include: { subcategories: true },
    });

    for (const sub of createdCat.subcategories) {
      const subTag = cat.subs.find((s) => s.title === sub.title).tag;

      const products = Array.from({ length: 12 }).map((_, i) => ({
        name: `${sub.title} ${brands[i % brands.length]} Model-${i + 1}`,
        description: `Професійний інструмент для роботи та навчання. Висока якість від ${brands[i % brands.length]}.`,
        price: parseFloat((Math.random() * (850 - 45) + 45).toFixed(2)),
        brand: brands[i % brands.length],
        image: `https://loremflickr.com/400/400/${subTag},stationery/all?lock=${sub.id}${i}`,
        subcategoryId: sub.id,
      }));

      await prisma.product.createMany({ data: products });
    }
  }

  await prisma.heroBanner.createMany({ data: data.heroBanners });

  // 3. Базові дані для роботи
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      email: "admin@kancsvit.ua",
      name: "Адмін",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("--- Базу успішно заповнено! ---");
  console.log("Створено: 6 категорій, 24 підкатегорії, 288 товарів.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
