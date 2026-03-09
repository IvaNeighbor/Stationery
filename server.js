const express = require("express"); // Підключаємо фреймворк
const app = express(); // Створюємо екземпляр додатка
const port = 3000; // Номер порту, на якому буде працювати сайт

// Налаштовуємо шаблонізатор EJS
app.set("view engine", "ejs");

// Кажемо серверу, де лежать наші статичні файли (CSS, картинки)
app.use(express.static("public"));

// Головний маршрут (Main Route)
app.get("/", (req, res) => {
  res.render("index"); // Сервер знайде index.ejs у папці views і віддасть його
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущено! Переходь сюди: http://localhost:${port}`);
});
