// Общая база мест. Каждая строка: [категория, название, район, lat, lng, цена 0–4, сколько времени, описание, совет, wiki-статья (для фото), теги]
// Цена: 0 — бесплатно, 1 — $, 2 — $$, 3 — $$$, 4 — $$$$
window.PLACES = [];
window.addPlaces = function (city, rows) {
  rows.forEach(function (r) {
    var id = city + '-' + r[1].toLowerCase()
      .replace(/[’'".,()&!@]/g, '')
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    window.PLACES.push({
      id: id, city: city, cat: r[0], name: r[1], area: r[2],
      lat: r[3], lng: r[4], price: r[5], time: r[6],
      desc: r[7], tip: r[8] || '', wiki: r[9] || '', tags: r[10] || []
    });
  });
};
