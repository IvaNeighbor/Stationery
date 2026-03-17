document.addEventListener("DOMContentLoaded", () => {
  const swiper = new Swiper(".swiper", {
    loop: true,
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    navigation: {
      nextEl: ".hero-section__button--next",
      prevEl: ".hero-section__button--prev",
    },
  });
});

document.addEventListener("click", function (event) {
  const currentItem = event.target.closest(".category-menu__item");

  document.querySelectorAll(".category-menu__item").forEach(function (item) {
    if (item === currentItem) {
      item.classList.toggle("is-open");
    } else {
      item.classList.remove("is-open");
    }
  });
});
