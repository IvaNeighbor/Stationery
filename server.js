require("dotenv").config();
const express = require("express");
const session = require("express-session");
const prisma = require("./lib/prisma");
const app = express();
const port = 3000;
const bcrypt = require("bcrypt");
const expressLayouts = require("express-ejs-layouts");

app.use(expressLayouts);
app.set("layout", "layout");

app.set("view engine", "ejs");

app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use(
  session({
    secret: "On my way",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  }),
);

app.use((req, res, next) => {
  res.locals.query = req.query;
  next();
});

const authMiddleware = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect("/login");
};

app.use((req, res, next) => {
  res.locals.userId = req.session.userId || null;
  res.locals.userName = req.session.userName || null;
  res.locals.userRole = req.session.role || "USER";

  res.locals.cartCount = req.session.cart
    ? Object.values(req.session.cart).reduce((sum, qty) => sum + qty, 0)
    : 0;

  next();
});

app.use(async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: { subcategories: true },
      orderBy: { id: "asc" },
    });

    res.locals.categories = categories;
    res.locals.userName = req.session.userName || null;
    res.locals.userId = req.session.userId || null;
    next();
  } catch (err) {
    console.error("Помилка завантаження категорій у middleware:", err);
    res.locals.categories = [];
    next();
  }
});

const adminMiddleware = (req, res, next) => {
  if (req.session && req.session.role === "ADMIN") return next();
  res.status(403).send("Доступ заборонено: потрібні права адміністратора");
};

app.get("/admin", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { search } = req.query;

    const whereCondition = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { brand: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const products = await prisma.product.findMany({
      where: whereCondition,
      include: {
        subcategory: { include: { category: true } },
      },
      orderBy: { id: "desc" },
    });

    res.render("admin/dashboard", {
      products,
      query: req.query,
      title: "Панель керування",
    });
  } catch (err) {
    console.error("Помилка пошуку в адмінці:", err);
    res.status(500).send("Помилка сервера при пошуку");
  }
});

app.get("/admin/add", authMiddleware, adminMiddleware, async (req, res) => {
  const subcategories = await prisma.subcategory.findMany({
    include: { category: true },
  });
  res.render("admin/add", { subcategories, title: "Додати товар" });
});

app.post("/admin/add", authMiddleware, adminMiddleware, async (req, res) => {
  const { name, description, price, brand, image, subcategoryId } = req.body;
  try {
    await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        brand,
        image,
        subcategoryId: parseInt(subcategoryId),
      },
    });
    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Помилка при збереженні товару");
  }
});

app.post(
  "/admin/delete/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    await prisma.product.delete({ where: { id: parseInt(req.params.id) } });
    res.redirect("/admin");
  },
);

app.post(
  "/admin/category/delete/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      await prisma.category.delete({ where: { id: parseInt(req.params.id) } });
      res.redirect("/admin");
    } catch (err) {
      res.status(500).send("Помилка при видаленні категорії");
    }
  },
);

app.get(
  "/admin/edit/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const [product, subcategories] = await Promise.all([
        prisma.product.findUnique({ where: { id: productId } }),
        prisma.subcategory.findMany(),
      ]);

      if (!product) return res.status(404).send("Товар не знайдено");

      res.render("admin/edit", {
        product,
        subcategories,
        title: "Редагування товару",
      });
    } catch (err) {
      res.status(500).send("Помилка завантаження даних");
    }
  },
);

app.post(
  "/admin/edit/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const productId = parseInt(req.params.id);
    const { name, description, price, brand, image, subcategoryId } = req.body;

    try {
      await prisma.product.update({
        where: { id: productId },
        data: {
          name,
          description,
          price: parseFloat(price),
          brand,
          image,
          subcategoryId: parseInt(subcategoryId),
        },
      });
      res.redirect("/admin");
    } catch (err) {
      console.error(err);
      res.status(500).send("Не вдалося оновити товар");
    }
  },
);

app.get("/category/:catSlug", authMiddleware, async (req, res) => {
  const { catSlug } = req.params;

  const category = await prisma.category.findUnique({
    where: { slug: catSlug },
    include: { subcategories: true },
  });

  if (!category) return res.status(404).send("Категорію не знайдено");

  const products = await prisma.product.findMany({
    where: {
      subcategory: { categoryId: category.id },
    },
  });

  res.render("category-main", { category, products });
});

app.get("/search", authMiddleware, async (req, res) => {
  const q = req.query.q;

  if (!q || q.trim() === "") return res.redirect("/");

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { subcategory: { include: { category: true } } },
  });

  res.render("search-results", {
    products,
    query: { q },
    title: `Результати пошуку: ${q}`,
  });
});

app.post("/cart/add", (req, res) => {
  const productId = parseInt(req.body.productId);
  if (!req.session.cart) req.session.cart = {};

  req.session.cart[productId] = (req.session.cart[productId] || 0) + 1;

  const backURL = req.header("Referer") || "/";
  res.redirect(`${backURL}${backURL.includes("?") ? "&" : "?"}added=true`);
});

app.post("/cart/update", (req, res) => {
  const { productId, action } = req.body;
  const id = parseInt(productId);

  if (req.session.cart && req.session.cart[id]) {
    if (action === "increase") req.session.cart[id]++;
    else if (action === "decrease") {
      req.session.cart[id]--;
      if (req.session.cart[id] <= 0) delete req.session.cart[id];
    } else if (action === "remove") {
      delete req.session.cart[id];
    }
  }
  res.redirect("/cart");
});

app.get("/cart", authMiddleware, async (req, res) => {
  const cart = req.session.cart || {};
  const productIds = Object.keys(cart).map((id) => parseInt(id));

  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  const products = dbProducts.map((p) => ({
    ...p,
    quantity: cart[p.id],
    subtotal: p.price * cart[p.id],
  }));

  const total = products.reduce((sum, p) => sum + p.subtotal, 0);
  res.render("cart", { products, total });
});

app.post("/checkout", authMiddleware, (req, res) => {
  const cart = req.session.cart || {};

  if (Object.keys(cart).length === 0) {
    return res.redirect("/cart");
  }

  req.session.cart = {};
  res.render("order-success", { title: "Дякуємо!" });
});

app.get("/", async (req, res) => {
  try {
    const [heroBanners, categories] = await Promise.all([
      prisma.heroBanner.findMany({ orderBy: { id: "asc" } }),
      prisma.category.findMany({
        include: { subcategories: true },
        orderBy: {
          id: "asc",
        },
      }),
    ]);

    res.render("index", {
      banners: heroBanners,
      categories: categories,
      user: req.session.userName || null,
    });
  } catch (err) {
    console.error("Помилка БД на головній:", err);
    res.status(500).send("Виникла проблема з доступом до бази даних");
  }
});

app.get("/category/:catSlug/:subSlug", authMiddleware, async (req, res) => {
  try {
    const { catSlug, subSlug } = req.params;

    const { search, brand } = req.query;

    const subcategory = await prisma.subcategory.findFirst({
      where: { href: `/category/${catSlug}/${subSlug}` },
      include: { category: true },
    });

    if (!subcategory) return res.status(404).send("Підкатегорію не знайдено");

    const whereCondition = {
      subcategoryId: subcategory.id,
      AND: [],
    };

    if (search) {
      whereCondition.AND.push({
        name: {
          contains: search,
          mode: "insensitive",
        },
      });
    }

    if (brand) {
      whereCondition.AND.push({ brand: brand });
    }

    const products = await prisma.product.findMany({
      where: whereCondition,
      orderBy: { price: "asc" },
    });

    const distinctBrands = await prisma.product.findMany({
      where: { subcategoryId: subcategory.id },
      select: { brand: true },
      distinct: ["brand"],
    });
    const brandsList = distinctBrands.map((p) => p.brand);

    res.render("catalog", {
      subcategory,
      products,
      brands: brandsList,
      query: req.query,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Помилка завантаження товарів");
  }
});

app.get("/product/:id", authMiddleware, async (req, res) => {
  const productId = parseInt(req.params.id);

  if (isNaN(productId)) {
    return res.status(400).send("Некоректний ідентифікатор товару");
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { subcategory: true },
    });

    if (!product) {
      return res.status(404).send("Товар не знайдено");
    }

    res.render("product", { product });
  } catch (error) {
    console.error(error);
    res.status(500).send("Помилка сервера");
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  const { email, name, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, name, password: hashedPassword },
    });
    res.redirect("/login");
  } catch (err) {
    res
      .status(500)
      .send("Помилка при реєстрації. Можливо, email вже зайнятий.");
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log(`Невдала спроба входу: ${email}`);
      return res.status(401).send("Невірний email або пароль");
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).send("Невірний email або пароль");
    }

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

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.listen(port, () => {
  console.log(`Сервер запущено! Переходь сюди: http://localhost:${port}`);
});
