require("dotenv").config();
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

// 1. Створюємо пул з'єднань через стандартний драйвер PostgreSQL
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 2. Створюємо адаптер, який Prisma 7 зможе "зрозуміти"
const adapter = new PrismaPg(pool);

// 3. Ініціалізуємо клієнт з цим адаптером
const prisma = new PrismaClient({ adapter });

async function main() {
  const filePath = path.join(__dirname, "../data.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  console.log("🔥 Повне очищення бази...");
  await prisma.product.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.heroBanner.deleteMany();
  // Користувачів не видаляємо, щоб не зносити адміна щоразу, або використовуй upsert

  console.log("📦 Завантаження банерів...");
  await prisma.heroBanner.createMany({ data: data.heroBanners });

  console.log("📂 Завантаження категорій та підкатегорій...");
  for (const cat of data.categories) {
    await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        subcategories: {
          create: cat.subcategories.map((sub) => ({
            title: sub.title,
            href: sub.href,
            image: sub.image,
          })),
        },
      },
    });
  }

  console.log("🛍️ Завантаження товарів...");
  for (const prod of data.products) {
    const sub = await prisma.subcategory.findFirst({
      where: { title: prod.subTitle },
    });
    if (sub) {
      await prisma.product.create({
        data: {
          name: prod.name,
          description: prod.description,
          price: prod.price,
          brand: prod.brand,
          image: prod.image,
          subcategoryId: sub.id,
        },
      });
    }
  }

  console.log("🔑 Створення адміна...");
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@kancsvit.ua" },
    update: {},
    create: {
      email: "admin@kancsvit.ua",
      name: "Головний Адмін",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("✅ Базу успішно синхронізовано!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // Закриваємо пул драйвера
  });
