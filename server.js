const express = require("express"); // Підключаємо фреймворк
const fs = require("fs");
const path = require("path");
const app = express(); // Створюємо екземпляр додатка
const port = 3000; // Номер порту, на якому буде працювати сайт

// Налаштовуємо шаблонізатор EJS
app.set("view engine", "ejs");

// Кажемо серверу, де лежать наші статичні файли (CSS, картинки)
app.use(express.static("public"));

const getAppData = () => {
  const filePath = path.join(__dirname, "data.json");
  const jsonData = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(jsonData);
};

// Головний маршрут (Main Route)
app.get("/", (req, res) => {
  const data = getAppData();
  res.render("index", { banners: data.heroBanners });
});

app.get("/categories/:slug", (req, res) => {
  const data = getAppData();
  const category = data.categories.find((c) => c.slug === req.params.slug);

  if (!category) {
    return res.status(404).send("Ой такої категорії в нас немає");
  }

  res.render("category", {
    category: category,
  });
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущено! Переходь сюди: http://localhost:${port}`);
});
