require("dotenv").config();
const express = require("express"); // Підключаємо фреймворк
const session = require("express-session");
const prisma = require("./lib/prisma");
const app = express(); // Створюємо екземпляр додатка
const port = 3000; // Номер порту, на якому буде працювати сайт
const bcrypt = require("bcrypt");

// Налаштовуємо шаблонізатор EJS
app.set("view engine", "ejs");

// Кажемо серверу, де лежать наші статичні файли (CSS, картинки)
app.use(express.static("public"));

// Дозволяємо серверу читати дані з HTML-форм (URL-encoded)
app.use(express.urlencoded({ extended: true }));
// Дозволяємо працювати з JSON (на майбутнє)
app.use(express.json());

app.use(
  session({
    secret: "On my way", // Вигадай складний рядок
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // Сесія на 1 добу
  }),
);

const authMiddleware = (req, res, next) => {
  if (!req.session.userId) return res.redirect("/login");
  next();
};

app.post("/cart/add", (req, res) => {
  if (!req.session.cart) req.session.cart = [];
  req.session.cart.push(req.body.productId);
  res.redirect("/cart");
});

app.get("/cart", authMiddleware, (req, res) => {
  // Тут витягуй товари з БД, чиї ID є в req.session.cart
  res.render("cart", { cart: req.session.cart || [] });
});

app.get("/", async (req, res) => {
  try {
    // Робимо запити паралельно через Promise.all, щоб сайт "літав"
    const [heroBanners, categories] = await Promise.all([
      prisma.heroBanner.findMany({ orderBy: { id: "asc" } }),
      prisma.category.findMany({
        include: { subcategories: true }, // Обов'язково підтягуємо підкатегорії
        orderBy: {
          id: "asc", // Сортуємо за ID від меншого до більшого
        },
      }),
    ]);

    res.render("index", {
      banners: heroBanners, // Твій EJS чекає "banners"
      categories: categories,
      user: req.session.userName || null,
    });
  } catch (err) {
    console.error("Помилка БД на головній:", err);
    res.status(500).send("Виникла проблема з доступом до бази даних");
  }
});

// Сторінка окремої категорії
app.get("/categories/:slug", async (req, res) => {
  // 1. Перевірка доступу (вимога ТЗ)
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  try {
    const { search, brand } = req.query; // Отримуємо дані з форми пошуку/фільтрації

    const category = await prisma.category.findUnique({
      where: { slug: req.params.slug },
      include: {
        subcategories: {
          include: {
            products: {
              where: {
                AND: [
                  search
                    ? { name: { contains: search, mode: "insensitive" } }
                    : {},
                  brand ? { brand: brand } : {},
                ],
              },
            },
          },
        },
      },
    });

    if (!category) return res.status(404).send("Категорію не знайдено");

    // Збираємо всі товари з підкатегорій в один масив для верстки
    const allProducts = category.subcategories.flatMap((sub) => sub.products);

    res.render("category", {
      category: category,
      products: allProducts,
      query: req.query, // Щоб зберегти значення у полях після пошуку
    });
  } catch (err) {
    res.status(500).send("Помилка завантаження товарів");
  }
});

// Сторінка конкретного товару
app.get("/product/:id", async (req, res) => {
  // ПЕРЕВІРКА ДОСТУПУ (вимога твого ТЗ)
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  try {
    const productId = parseInt(req.params.id);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { subcategory: true }, // Щоб знати, до якої категорії він належить
    });

    if (!product) {
      return res.status(404).send("Товар не знайдено");
    }

    // Відправляємо дані в шаблон
    res.render("product", { product });
  } catch (err) {
    console.error(err);
    res.status(500).send("Помилка сервера");
  }
});

// Маршрут для обробки входу
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Шукаємо юзера в базі
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log(`Невдала спроба входу: ${email}`);
      return res.status(401).send("Невірний email або пароль");
    }

    // 2. Порівнюємо введений пароль із хешем у базі
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).send("Невірний email або пароль");
    }

    // 3. Якщо все ок — створюємо сесію
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.userName = user.name;

    console.log(`Користувач ${user.name} увійшов у систему`);
    res.redirect("/");
  } catch (err) {
    console.error("Помилка при логіні:", err);
    res.status(500).send("Помилка на сервері");
  }
});

// Маршрут для виходу
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// const fs = require("fs").promises;
// const path = require("path");

// const getAppData = async () => {
//   try {
//     const filePath = path.join(__dirname, "data.json");
//     const jsonData = await fs.readFile(filePath, "utf-8");
//     return JSON.parse(jsonData);
//   } catch (err) {
//     console.error("Помилка читання бази:", err);
//   }
// };

// // Головний маршрут (Main Route)
// app.get("/", async (req, res) => {
//   const data = await getAppData();
//   res.render("index", {
//     banners: data.heroBanners,
//     categories: data.categories,
//   });
// });

// app.get("/categories/:slug", async (req, res) => {
//   const data = await getAppData();
//   const category = data.categories.find((c) => c.slug === req.params.slug);

//   if (!category) {
//     return res.status(404).send("Ой такої категорії в нас немає");
//   }

//   res.render("category", {
//     category: category,
//   });
// });

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущено! Переходь сюди: http://localhost:${port}`);
});
