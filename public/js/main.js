/* Інтерактивність сайту «Затишна кава» (лабораторні роботи № 3–5).
   Залежить від validation.js, components.js і api.js (підключаються раніше). */
(function () {
  "use strict";

  var ZK = window.ZK;
  var V = ZK.validation;
  var CART_KEY = "zk-cart";
  var MAX_QTY = 20;

  /* ---------- Допоміжні функції ---------- */
  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* сховище недоступне — працюємо без збереження */
    }
  }

  function formatPrice(value) {
    return value + "\u00a0\u20b4";
  }

  function showStatus(id, message) {
    var status = document.getElementById(id);
    if (status) {
      if (message) { status.textContent = message; }
      status.hidden = false;
      status.focus();
    }
  }

  /* Спільна обробка надсилання форми на сервер: блокування кнопки, індикатор,
     показ помилок сервера. send() повертає Promise, onSuccess(result) викликається при успіху. */
  function submitToServer(form, send, onSuccess, after) {
    var btn = form.querySelector('[type="submit"]');
    var label = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Надсилаємо…"; }
    form.setAttribute("aria-busy", "true");
    return send().then(onSuccess).catch(function (error) {
      if (error instanceof ZK.api.ApiError) {
        V.showServerErrors(form, error.message, error.fields);
      } else {
        V.showServerErrors(form, "Сталася неочікувана помилка. Спробуйте ще раз.");
        console.error(error);
      }
    }).then(function () {
      form.removeAttribute("aria-busy");
      if (btn) { btn.disabled = false; btn.textContent = label; }
      if (after) { after(); }
    });
  }

  /* ---------- Навігація ---------- */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");
    var header = document.querySelector(".site-header");

    function closeNav() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
      });
      // закриття по Escape
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && nav.classList.contains("is-open")) {
          closeNav();
          toggle.focus();
        }
      });
      // закриття кліком поза меню (делегування на document)
      document.addEventListener("click", function (event) {
        if (nav.classList.contains("is-open") && !event.target.closest("#site-nav, .nav-toggle")) {
          closeNav();
        }
      });
      // закриття після вибору пункту меню
      nav.addEventListener("click", function (event) {
        if (event.target.closest("a")) { closeNav(); }
      });
      // повернення до десктопного вигляду
      window.addEventListener("resize", function () {
        if (window.innerWidth > 768) { closeNav(); }
      });
    }

    // кнопка «Нагору» й тінь шапки під час прокручування
    var toTop = document.createElement("button");
    toTop.className = "to-top";
    toTop.type = "button";
    toTop.hidden = true;
    toTop.setAttribute("aria-label", "Повернутися нагору");
    toTop.textContent = "\u2191";
    document.body.appendChild(toTop);

    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    function onScroll() {
      var y = window.scrollY || document.documentElement.scrollTop;
      toTop.hidden = y < 400;
      if (header) { header.classList.toggle("is-scrolled", y > 10); }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Кошик: зберігається в localStorage як { id позиції: кількість } ---------- */
  var cart = {
    read: function () {
      var result = {};
      try {
        var raw = JSON.parse(storageGet(CART_KEY) || "{}");
        Object.keys(raw).forEach(function (id) {
          var qty = Number(raw[id]);
          if (/^\d+$/.test(id) && Number.isInteger(qty) && qty >= 1) { result[id] = Math.min(qty, MAX_QTY); }
        });
      } catch (e) { /* пошкоджені дані — починаємо з порожнього кошика */ }
      return result;
    },
    write: function (data) {
      storageSet(CART_KEY, JSON.stringify(data));
      renderCartCount();
    },
    add: function (id) {
      var data = cart.read();
      data[id] = Math.min((data[id] || 0) + 1, MAX_QTY);
      cart.write(data);
    },
    setQty: function (id, qty) {
      var data = cart.read();
      data[id] = Math.max(1, Math.min(MAX_QTY, qty));
      cart.write(data);
    },
    remove: function (id) {
      var data = cart.read();
      delete data[id];
      cart.write(data);
    },
    clear: function () { cart.write({}); },
    count: function () {
      var data = cart.read();
      return Object.keys(data).reduce(function (sum, id) { return sum + data[id]; }, 0);
    }
  };
  ZK.cart = cart;

  function renderCartCount() {
    var count = cart.count();
    var badge = document.querySelector(".icon-btn__count");
    if (!badge) { return; }
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  function initCart() {
    renderCartCount();
    document.addEventListener("click", function (event) {
      var button = event.target.closest("[data-add-to-cart]");
      if (!button) { return; }
      var card = button.closest(".product-card");
      var id = button.dataset.id || (card ? card.dataset.id : "");
      if (!/^\d+$/.test(id || "")) { return; }
      cart.add(id);

      var titleEl = card ? card.querySelector(".product-card__title") : null;
      var name = titleEl ? titleEl.textContent : button.dataset.name || "Позицію";
      ZK.toast.show("«" + name + "» додано до кошика");

      var original = button.dataset.label || button.textContent;
      button.dataset.label = original;
      button.textContent = "Додано";
      window.setTimeout(function () {
        button.textContent = original;
      }, 1200);
    });
    // кошик може змінитися в іншій вкладці
    window.addEventListener("storage", function (event) {
      if (event.key === CART_KEY) { renderCartCount(); }
    });
  }

  /* ---------- Повідомлення про стан завантаження / помилку (з кнопкою «Спробувати ще») ---------- */
  function showLoadError(anchor, message, retry) {
    var box = document.createElement("div");
    box.className = "load-error";
    box.setAttribute("role", "alert");
    var text = document.createElement("p");
    text.textContent = message;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--secondary";
    btn.textContent = "Спробувати ще раз";
    btn.addEventListener("click", function () {
      if (box.parentNode) { box.parentNode.removeChild(box); }
      retry();
    });
    box.appendChild(text);
    box.appendChild(btn);
    anchor.parentNode.insertBefore(box, anchor);
    return box;
  }

  /* ---------- Меню: дані з API, фільтр, пошук, сортування, деталі ---------- */
  var ALLERGEN_ICON =
    '<svg class="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>';

  /* Картка створюється через DOM-методи й textContent: дані з БД ніколи не вставляються як HTML */
  function buildCard(item) {
    var li = document.createElement("li");
    var article = document.createElement("article");
    article.className = "product-card";
    article.dataset.category = item.category;
    article.dataset.id = String(item.id);

    var media = document.createElement("div");
    media.className = "product-card__media";
    var img = document.createElement("img");
    img.className = "product-card__img";
    img.src = item.image;
    img.alt = item.image_alt;
    img.width = 600;
    img.height = 400;
    img.loading = "lazy";
    media.appendChild(img);
    if (item.badge) {
      var badges = document.createElement("div");
      badges.className = "product-card__badges";
      var badge = document.createElement("span");
      badge.className = "badge badge--hit";
      badge.textContent = item.badge;
      badges.appendChild(badge);
      media.appendChild(badges);
    }

    var body = document.createElement("div");
    body.className = "product-card__body";
    var head = document.createElement("div");
    head.className = "product-card__head";
    var title = document.createElement("h3");
    title.className = "product-card__title";
    title.textContent = item.title;
    var price = document.createElement("p");
    price.className = "product-card__price";
    price.textContent = formatPrice(item.price);
    head.appendChild(title);
    head.appendChild(price);
    var text = document.createElement("p");
    text.className = "product-card__text";
    text.textContent = item.description;
    body.appendChild(head);
    body.appendChild(text);
    if (item.allergens) {
      var allergen = document.createElement("p");
      allergen.className = "product-card__allergen";
      allergen.innerHTML = ALLERGEN_ICON + '<span class="visually-hidden">Алергени: </span>';
      allergen.appendChild(document.createTextNode(item.allergens));
      body.appendChild(allergen);
    }
    var add = document.createElement("button");
    add.className = "btn btn--secondary";
    add.type = "button";
    add.setAttribute("data-add-to-cart", "");
    add.textContent = "До кошика";
    body.appendChild(add);

    article.appendChild(media);
    article.appendChild(body);
    li.appendChild(article);
    return li;
  }

  async function initMenu() {
    var grid = document.querySelector(".product-grid");
    if (!grid || !document.querySelectorAll("[data-filter]").length) { return; }
    var counter = document.getElementById("menu-count");

    async function load() {
      if (counter) { counter.textContent = "Завантажуємо меню…"; }
      grid.setAttribute("aria-busy", "true");
      try {
        var menu = await ZK.api.getMenu();
        // замінюємо запасну статичну розмітку даними з бази
        grid.textContent = "";
        menu.forEach(function (item) { grid.appendChild(buildCard(item)); });
      } catch (error) {
        // на помилці лишається статична розмітка (працює пошук і фільтр), але кошик і замовлення потребують сервера
        showLoadError(grid, error.message + " Показано збережену версію меню.", load);
      }
      grid.removeAttribute("aria-busy");
      setupMenu(grid);
    }
    await load();
  }

  var menuInitialised = false;
  function setupMenu(grid) {
    var tabs = document.querySelectorAll("[data-filter]");
    var cards = grid.querySelectorAll("[data-category]");
    var counter = document.getElementById("menu-count");
    var empty = document.getElementById("menu-empty");
    var search = document.getElementById("menu-search");
    var sort = document.getElementById("menu-sort");

    // дані позицій зчитуються з розмітки
    var items = Array.prototype.map.call(cards, function (card, index) {
      var img = card.querySelector(".product-card__img");
      var allergenEl = card.querySelector(".product-card__allergen");
      var title = card.querySelector(".product-card__title").textContent.trim();
      var priceText = card.querySelector(".product-card__price").textContent;
      return {
        card: card,
        li: card.closest("li"),
        id: card.dataset.id,
        index: index,
        category: card.dataset.category,
        title: title,
        priceText: priceText.replace(/\s/g, "\u00a0").trim(),
        price: parseInt(priceText, 10) || 0,
        text: card.querySelector(".product-card__text").textContent.trim(),
        image: img ? img.getAttribute("src") : "",
        imageAlt: img ? img.getAttribute("alt") : "",
        allergen: allergenEl ? allergenEl.textContent.replace("Алергени:", "").trim() : ""
      };
    });

    // кнопка «Детальніше» створюється скриптом у кожній картці
    items.forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "link-btn";
      btn.setAttribute("data-details", String(item.index));
      btn.textContent = "Детальніше";
      var cartBtn = item.card.querySelector("[data-add-to-cart]");
      cartBtn.parentNode.insertBefore(btn, cartBtn);
    });

    var state = menuInitialised ? menuInitialised : { filter: "all", query: "", sort: "default" };

    function render() {
      var q = state.query.trim().toLowerCase();
      var list = items.slice().sort(function (a, b) {
        if (state.sort === "price-asc") { return a.price - b.price || a.index - b.index; }
        if (state.sort === "price-desc") { return b.price - a.price || a.index - b.index; }
        if (state.sort === "name") { return a.title.localeCompare(b.title, "uk"); }
        return a.index - b.index;
      });
      var visible = 0;
      list.forEach(function (item) {
        var matches =
          (state.filter === "all" || item.category === state.filter) &&
          (!q || item.title.toLowerCase().indexOf(q) !== -1 || item.text.toLowerCase().indexOf(q) !== -1);
        item.li.hidden = !matches;
        grid.appendChild(item.li); // зміна порядку в DOM
        if (matches) { visible += 1; }
      });
      if (counter) { counter.textContent = "Показано позицій: " + visible; }
      if (empty) { empty.hidden = visible !== 0; }
    }

    function setFilter(filter) {
      state.filter = filter;
      tabs.forEach(function (t) {
        t.setAttribute("aria-pressed", String(t.dataset.filter === filter));
      });
      render();
    }

    if (!menuInitialised) {
      menuInitialised = state;
      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          state.filter = tab.dataset.filter;
          tabs.forEach(function (t) { t.setAttribute("aria-pressed", String(t === tab)); });
          state.render();
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, "", tab.dataset.filter === "all" ? "menu.html" : "#" + tab.dataset.filter);
          }
        });
      });
      if (search) {
        search.addEventListener("input", function () { state.query = search.value; state.render(); });
      }
      if (sort) {
        sort.addEventListener("change", function () { state.sort = sort.value; state.render(); });
      }
      // делегування: один обробник для всіх кнопок «Детальніше»
      grid.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-details]");
        if (!btn) { return; }
        var item = state.items[parseInt(btn.dataset.details, 10)];
        ZK.modal.openProduct(
          { id: item.id, title: item.title, price: item.priceText, text: item.text,
            image: item.image, imageAlt: item.imageAlt, allergen: item.allergen },
          btn
        );
      });
      // початковий фільтр із адреси: menu.html#tea
      state.applyHash = function () {
        var hash = window.location.hash.replace("#", "");
        var known = Array.prototype.some.call(tabs, function (t) { return t.dataset.filter === hash; });
        if (known) { state.setFilter(hash); }
      };
      window.addEventListener("hashchange", function () { state.applyHash(); });
    }
    // після перезавантаження даних оновлюємо посилання на актуальні картки
    state.items = items;
    state.render = render;
    state.setFilter = setFilter;
    // відновлюємо стан фільтра, пошуку й сортування
    setFilter(state.filter);
    state.applyHash();
  }

  /* ---------- Бронювання: вільні слоти з сервера ---------- */
  function initBooking() {
    var form = document.getElementById("booking-form");
    var summary = document.getElementById("booking-summary");
    if (!form || !summary) { return; }

    var dateInput = form.elements.date;
    var today = V.todayISO();
    dateInput.min = today;
    dateInput.max = V.addDaysISO(60);
    if (!dateInput.value || dateInput.value < today) { dateInput.value = today; }

    var slots = Array.prototype.slice.call(form.querySelectorAll('input[name="time"]'));
    var busyTimes = {};   // час → true, якщо сервер повідомив, що слот зайнятий
    var slotsRequest = 0; // номер останнього запиту: відповіді, що запізнилися, ігноруються

    // слот недоступний, якщо він зайнятий (за даними сервера) або час на сьогодні вже минув
    function updateSlots() {
      var now = new Date();
      var current = ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2);
      var isToday = dateInput.value === today;
      slots.forEach(function (slot) {
        var past = isToday && slot.value <= current;
        var busy = busyTimes[slot.value] === true;
        slot.disabled = past || busy;
        if (past) { slot.setAttribute("data-past", ""); } else { slot.removeAttribute("data-past"); }
        if (slot.disabled && slot.checked) { slot.checked = false; }
      });
    }

    async function loadSlots() {
      var request = (slotsRequest += 1);
      var date = dateInput.value;
      if (!date) { return; }
      try {
        var data = await ZK.api.getSlots(date);
        if (request !== slotsRequest) { return; }
        busyTimes = {};
        data.slots.forEach(function (slot) { if (!slot.available) { busyTimes[slot.time] = true; } });
      } catch (error) {
        if (request !== slotsRequest) { return; }
        busyTimes = {}; // без сервера доступність не відома: сервер перевірить її під час надсилання
      }
      updateSlots();
      update();
    }

    function update() {
      var date = dateInput.value;
      var time = form.elements.time.value;
      var guests = form.elements.guests.value;
      if (!date || !time) {
        summary.textContent = "Оберіть дату та час, щоб побачити підсумок";
        return;
      }
      var parsed = new Date(date + "T12:00:00");
      var text = new Intl.DateTimeFormat("uk-UA", {
        weekday: "long",
        day: "numeric",
        month: "long"
      }).format(parsed);
      summary.textContent = text + ", " + time + ", гостей: " + guests;
    }

    V.attach(form, {
      date: { rules: [V.rules.required("Оберіть дату візиту."), V.rules.dateNotPast, V.rules.dateWithin(60)] },
      time: { rules: [V.rules.required("Оберіть вільний час візиту.")] },
      guests: { rules: [V.rules.required("Оберіть кількість гостей.")] },
      name: {
        rules: [
          V.rules.required("Вкажіть ім’я."),
          V.rules.minLength(2, "Ім’я має містити щонайменше 2 символи."),
          V.rules.personName
        ]
      },
      phone: { rules: [V.rules.required("Вкажіть номер телефону."), V.rules.phone] },
      note: { rules: [V.rules.maxLength(200, "Побажання не повинні перевищувати 200 символів.")], max: 200 }
    });

    form.addEventListener("change", function (event) {
      if (event.target === dateInput) {
        busyTimes = {};
        updateSlots();
        loadSlots();
      }
      update();
    });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!V.validate(form)) { return; }
      var status = document.getElementById("booking-status");
      if (status) { status.hidden = true; }
      submitToServer(
        form,
        function () {
          return ZK.api.createBooking({
            date: dateInput.value,
            time: form.elements.time.value,
            guests: parseInt(form.elements.guests.value, 10),
            name: form.elements.name.value,
            phone: form.elements.phone.value,
            note: form.elements.note.value
          });
        },
        function (booking) {
          var text = summary.textContent;
          showStatus("booking-status", "Дякуємо! Столик заброньовано (№ " + booking.id + "): " + text + ".");
          ZK.toast.show("Столик заброньовано");
          loadSlots();
        }
      ).then(function () {
        // слот міг зайняти хтось інший — оновлюємо доступність після будь-якої відповіді
        loadSlots();
      });
    });
    updateSlots();
    update();
    loadSlots();
  }

  /* ---------- Замовлення: кошик із localStorage + ціни з API ---------- */
  function buildOrderRow(item, qty) {
    var li = document.createElement("li");
    li.className = "order-item";
    li.dataset.id = String(item.id);
    li.dataset.price = String(item.price);

    var img = document.createElement("img");
    img.className = "order-item__img";
    img.src = item.image;
    img.alt = "";
    img.width = 600;
    img.height = 400;

    var info = document.createElement("div");
    var name = document.createElement("h3");
    name.className = "order-item__name";
    name.textContent = item.title;
    var note = document.createElement("p");
    note.className = "order-item__note";
    note.textContent = formatPrice(item.price) + " за одиницю";
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link-btn";
    remove.setAttribute("data-remove", "");
    remove.textContent = "Видалити";
    info.appendChild(name);
    info.appendChild(note);
    info.appendChild(remove);

    var group = document.createElement("div");
    group.className = "quantity";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Кількість: " + item.title);
    function stepBtn(step, sign, label) {
      var b = document.createElement("button");
      b.className = "quantity__btn";
      b.type = "button";
      b.dataset.step = String(step);
      b.setAttribute("aria-label", label);
      b.textContent = sign;
      return b;
    }
    var value = document.createElement("span");
    value.className = "quantity__value";
    value.textContent = String(qty);
    group.appendChild(stepBtn(-1, "\u2212", "Зменшити кількість"));
    group.appendChild(value);
    group.appendChild(stepBtn(1, "+", "Збільшити кількість"));

    var price = document.createElement("p");
    price.className = "order-item__price";
    li.appendChild(img);
    li.appendChild(info);
    li.appendChild(group);
    li.appendChild(price);
    return li;
  }

  async function initOrder() {
    var list = document.getElementById("order-items");
    if (!list) { return; }
    var form = document.getElementById("order-form");
    var bonus = document.getElementById("use-bonus");
    var bonusValue = parseInt(bonus ? bonus.dataset.points : "0", 10) || 0;
    var submitBtn = form ? form.querySelector('[type="submit"]') : null;

    // повідомлення «Кошик порожній» є в розмітці одразу, щоб сторінка не зсувалася після завантаження
    var emptyMsg = document.getElementById("order-empty");

    function recalc() {
      var subtotal = 0;
      var qtyTotal = 0;
      list.querySelectorAll(".order-item").forEach(function (item) {
        var price = parseInt(item.dataset.price, 10);
        var qty = parseInt(item.querySelector(".quantity__value").textContent, 10);
        item.querySelector(".order-item__price").textContent = formatPrice(price * qty);
        subtotal += price * qty;
        qtyTotal += qty;
      });
      var isEmpty = list.querySelectorAll(".order-item").length === 0;
      emptyMsg.hidden = !isEmpty || list.hasAttribute("aria-busy");
      if (submitBtn) { submitBtn.disabled = isEmpty; }
      if (bonus) {
        bonus.disabled = isEmpty;
        if (isEmpty) { bonus.checked = false; }
      }
      var discount = bonus && bonus.checked ? Math.min(bonusValue, subtotal) : 0;
      document.getElementById("sum-items").textContent = formatPrice(subtotal);
      document.getElementById("sum-discount").textContent = "\u2212" + formatPrice(discount);
      document.getElementById("sum-total").textContent = formatPrice(subtotal - discount);
      document.getElementById("sum-earn").textContent = "+" + Math.floor((subtotal - discount) / 10);
      document.getElementById("sum-count").textContent = String(qtyTotal);
    }

    async function loadCart() {
      list.textContent = "";
      var stored = cart.read();
      var ids = Object.keys(stored);
      if (!ids.length) { recalc(); return; }
      list.setAttribute("aria-busy", "true");
      document.getElementById("sum-count").textContent = "…";
      try {
        var menu = await ZK.api.getMenu();
        var byId = {};
        menu.forEach(function (item) { byId[item.id] = item; });
        var cleaned = {};
        ids.forEach(function (id) {
          if (byId[id]) {
            cleaned[id] = stored[id];
            list.appendChild(buildOrderRow(byId[id], stored[id]));
          }
        });
        cart.write(cleaned); // позиції, яких уже немає в меню, прибираються з кошика
      } catch (error) {
        list.removeAttribute("aria-busy");
        recalc();
        var box = showLoadError(list, error.message, loadCart);
        if (submitBtn) { submitBtn.disabled = true; }
        return box;
      }
      list.removeAttribute("aria-busy");
      recalc();
    }

    list.addEventListener("click", function (event) {
      var button = event.target.closest("[data-step]");
      var remove = event.target.closest("[data-remove]");
      var row = event.target.closest(".order-item");
      if (!row) { return; }
      if (button) {
        var valueEl = row.querySelector(".quantity__value");
        var next = Math.max(1, Math.min(MAX_QTY, parseInt(valueEl.textContent, 10) + parseInt(button.dataset.step, 10)));
        valueEl.textContent = String(next);
        cart.setQty(row.dataset.id, next);
        recalc();
      }
      if (remove) {
        cart.remove(row.dataset.id);
        row.parentElement.removeChild(row);
        recalc();
      }
    });
    if (bonus) { bonus.addEventListener("change", recalc); }

    if (form) {
      V.attach(
        form,
        {
          pickup: { rules: [V.rules.required("Оберіть час отримання.")] },
          name: {
            rules: [
              V.rules.required("Вкажіть ім’я."),
              V.rules.minLength(2, "Ім’я має містити щонайменше 2 символи."),
              V.rules.personName
            ]
          },
          phone: { rules: [V.rules.required("Вкажіть номер телефону."), V.rules.phone] },
          note: { rules: [V.rules.maxLength(200, "Коментар не повинен перевищувати 200 символів.")], max: 200 }
        },
        {
          formRule: function () {
            return list.querySelectorAll(".order-item").length ? "" : "Кошик порожній — додайте хоча б одну позицію.";
          }
        }
      );
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!V.validate(form)) { return; }
        var status = document.getElementById("order-status");
        if (status) { status.hidden = true; }
        var items = Array.prototype.map.call(list.querySelectorAll(".order-item"), function (row) {
          return { id: parseInt(row.dataset.id, 10), qty: parseInt(row.querySelector(".quantity__value").textContent, 10) };
        });
        // на сервер надсилаються лише id та кількість: ціни й суму сервер рахує сам
        submitToServer(
          form,
          function () {
            return ZK.api.createOrder({
              name: form.elements.name.value,
              phone: form.elements.phone.value,
              note: form.elements.note.value,
              pickup: form.elements.pickup.value,
              payment: form.elements.payment.value,
              useBonus: !!(bonus && bonus.checked),
              items: items
            });
          },
          function (order) {
            cart.clear();
            list.textContent = "";
            form.reset();
            V.reset(form);
            showStatus(
              "order-status",
              "Дякуємо! Замовлення № " + order.id + " прийнято. До сплати: " + formatPrice(order.total) +
              ". Буде нараховано балів: " + order.earnedPoints + "."
            );
            ZK.toast.show("Замовлення № " + order.id + " підтверджено");
          },
          recalc
        );
      });
    }
    await loadCart();
  }

  /* ---------- Контакти: форма відгуку ---------- */
  function initContactForm() {
    var form = document.getElementById("feedback-form");
    if (!form) { return; }
    V.attach(form, {
      name: {
        rules: [
          V.rules.required("Вкажіть ім’я."),
          V.rules.minLength(2, "Ім’я має містити щонайменше 2 символи."),
          V.rules.personName
        ]
      },
      email: { rules: [V.rules.required("Вкажіть електронну пошту."), V.rules.email] },
      rating: { rules: [V.rules.required("Оберіть оцінку закладу.")] },
      message: {
        rules: [
          V.rules.required("Напишіть повідомлення."),
          V.rules.minLength(10, "Повідомлення закоротке: напишіть щонайменше 10 символів."),
          V.rules.maxLength(500, "Повідомлення не повинно перевищувати 500 символів.")
        ],
        max: 500
      }
    });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      document.getElementById("feedback-status").hidden = true;
      if (!V.validate(form)) { return; }
      submitToServer(
        form,
        function () {
          return ZK.api.sendFeedback({
            name: form.elements.name.value,
            email: form.elements.email.value,
            rating: parseInt(form.elements.rating.value, 10),
            message: form.elements.message.value
          });
        },
        function () {
          showStatus("feedback-status", "Дякуємо за відгук! Ми прочитаємо його найближчим часом.");
          form.reset();
          V.reset(form);
        }
      );
    });
  }

  /* ---------- Запуск ---------- */
  initNav();
  initCart();
  initMenu();
  initBooking();
  initOrder();
  initContactForm();
  ZK.initAccordions();
})();
