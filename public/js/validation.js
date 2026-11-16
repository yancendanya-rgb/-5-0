/* Клієнтська валідація форм сайту «Затишна кава».
   Підключається перед main.js і надає об'єкт ZK.validation. */
(function () {
  "use strict";

  var ZK = (window.ZK = window.ZK || {});

  /* ---------- Допоміжні функції ---------- */
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function toISO(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function todayISO() {
    return toISO(new Date());
  }

  function addDaysISO(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return toISO(d);
  }

  /* ---------- Набір правил: кожне повертає текст помилки або "" ---------- */
  var rules = {
    required: function (message) {
      return function (value) {
        return String(value).trim() ? "" : message;
      };
    },
    minLength: function (min, message) {
      return function (value) {
        var v = String(value).trim();
        return v && v.length < min ? message : "";
      };
    },
    maxLength: function (max, message) {
      return function (value) {
        return String(value).length > max ? message : "";
      };
    },
    personName: function (value) {
      var v = String(value).trim();
      if (!v) { return ""; }
      return /^[A-Za-zА-Яа-яІіЇїЄєҐґ'’ʼ\-\s]+$/.test(v)
        ? ""
        : "Ім’я може містити лише літери, пробіл, апостроф і дефіс.";
    },
    email: function (value) {
      var v = String(value).trim();
      if (!v) { return ""; }
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
        ? ""
        : "Некоректна адреса. Приклад: name@example.com.";
    },
    phone: function (value) {
      var v = String(value).trim();
      if (!v) { return ""; }
      if (!/^[+\d\s\-()]+$/.test(v)) {
        return "Телефон може містити лише цифри, пробіли, дужки, дефіс і «+».";
      }
      var digits = v.replace(/\D/g, "");
      return /^(380\d{9}|0\d{9})$/.test(digits)
        ? ""
        : "Введіть український номер: +380 XX XXX XX XX або 0XX XXX XX XX.";
    },
    dateNotPast: function (value) {
      return !value || value >= todayISO() ? "" : "Дата не може бути в минулому.";
    },
    dateWithin: function (days) {
      return function (value) {
        return !value || value <= addDaysISO(days)
          ? ""
          : "Бронювання доступне не далі ніж на " + days + " днів уперед.";
      };
    }
  };

  /* ---------- Робота з елементами ---------- */
  function getControls(form, name) {
    var el = form.elements[name];
    if (!el) { return []; }
    return el.tagName ? [el] : Array.prototype.slice.call(el);
  }

  function getValue(controls) {
    if (!controls.length) { return ""; }
    var first = controls[0];
    if (first.type === "radio") {
      var checked = controls.filter(function (c) { return c.checked; })[0];
      return checked ? checked.value : "";
    }
    if (first.type === "checkbox") {
      return first.checked ? first.value : "";
    }
    return first.value;
  }

  function getErrorEl(form, name, controls) {
    var id = "err-" + (form.id || "form") + "-" + name;
    var el = document.getElementById(id);
    if (el) { return el; }
    el = document.createElement("p");
    el.className = "field__error";
    el.id = id;
    el.hidden = true;
    var first = controls[0];
    if (first.type === "radio") {
      var group = first.closest("fieldset") || first.parentNode;
      group.appendChild(el);
    } else {
      first.parentNode.insertBefore(el, first.nextSibling);
    }
    return el;
  }

  function showError(form, name, controls, message) {
    var errorEl = getErrorEl(form, name, controls);
    errorEl.textContent = message;
    errorEl.hidden = !message;
    controls.forEach(function (c) {
      if (message) {
        c.setAttribute("aria-invalid", "true");
        c.setAttribute("aria-describedby", errorEl.id);
      } else {
        c.removeAttribute("aria-invalid");
        c.removeAttribute("aria-describedby");
      }
    });
  }

  function validateField(form, name) {
    var config = form.__zk;
    var field = config.schema[name];
    var controls = getControls(form, name);
    if (!field || !controls.length) { return true; }
    var value = getValue(controls);
    var message = "";
    for (var i = 0; i < field.rules.length && !message; i += 1) {
      message = field.rules[i](value, form);
    }
    showError(form, name, controls, message);
    return !message;
  }

  /* ---------- Лічильник символів ---------- */
  function initCounter(form, name, max) {
    var controls = getControls(form, name);
    if (!controls.length) { return; }
    var control = controls[0];
    var counter = document.createElement("p");
    counter.className = "field__counter";
    counter.setAttribute("aria-hidden", "true");
    control.parentNode.insertBefore(counter, control.nextSibling);

    function update() {
      var len = control.value.length;
      counter.textContent = len + " / " + max;
      counter.classList.toggle("is-limit", len > max);
    }
    control.addEventListener("input", update);
    form.addEventListener("reset", function () { window.setTimeout(update, 0); });
    update();
  }

  /* ---------- Підсумок помилок форми ---------- */
  function getSummary(form) {
    var el = form.querySelector(".form-summary");
    if (el) { return el; }
    el = document.createElement("p");
    el.className = "form-summary";
    el.setAttribute("role", "alert");
    el.hidden = true;
    var actions = form.querySelector(".form-actions");
    if (actions) {
      actions.insertBefore(el, actions.firstChild);
    } else {
      form.appendChild(el);
    }
    return el;
  }

  /* ---------- Публічний інтерфейс ---------- */
  function attach(form, schema, options) {
    if (!form) { return; }
    options = options || {};
    form.noValidate = true;
    form.__zk = { schema: schema, formRule: options.formRule || null, touched: {} };

    Object.keys(schema).forEach(function (name) {
      if (schema[name].max) { initCounter(form, name, schema[name].max); }
    });

    // перевірка при виході з поля, а далі — під час введення
    form.addEventListener("focusout", function (event) {
      var name = event.target.name;
      if (name && schema[name]) {
        form.__zk.touched[name] = true;
        validateField(form, name);
      }
    });
    function onChange(event) {
      var name = event.target.name;
      if (name && schema[name] && (form.__zk.touched[name] || event.type === "change")) {
        form.__zk.touched[name] = true;
        validateField(form, name);
      }
    }
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
  }

  function validate(form) {
    var config = form.__zk;
    if (!config) { return true; }
    var invalid = [];
    Object.keys(config.schema).forEach(function (name) {
      config.touched[name] = true;
      if (!validateField(form, name)) { invalid.push(name); }
    });

    var formMessage = config.formRule ? config.formRule(form) : "";
    var summary = getSummary(form);
    if (invalid.length || formMessage) {
      var parts = [];
      if (invalid.length) {
        parts.push("Форму не надіслано: виправте поля, позначені червоним (помилок: " + invalid.length + ").");
      }
      if (formMessage) { parts.push(formMessage); }
      summary.textContent = parts.join(" ");
      summary.hidden = false;
      if (invalid.length) {
        var firstControls = getControls(form, invalid[0]);
        var target = firstControls.filter(function (c) { return !c.disabled; })[0] || firstControls[0];
        if (target) { target.focus(); }
      }
      return false;
    }
    summary.hidden = true;
    return true;
  }

  function reset(form) {
    var config = form.__zk;
    if (!config) { return; }
    config.touched = {};
    Object.keys(config.schema).forEach(function (name) {
      var controls = getControls(form, name);
      if (controls.length) { showError(form, name, controls, ""); }
    });
    getSummary(form).hidden = true;
  }

  /* Показує помилки, які повернув сервер (відповідь 422), біля полів форми.
     fields — об'єкт «ім'я поля → повідомлення»; message — загальний текст помилки. */
  function showServerErrors(form, message, fields) {
    var summary = getSummary(form);
    var first = null;
    var extra = [];
    Object.keys(fields || {}).forEach(function (name) {
      var controls = getControls(form, name);
      if (controls.length) {
        showError(form, name, controls, fields[name]);
        if (!first) { first = controls.filter(function (c) { return !c.disabled; })[0] || controls[0]; }
      } else {
        extra.push(fields[name]);
      }
    });
    var parts = [first ? "Сервер не прийняв дані: виправте поля, позначені червоним." : message];
    extra.forEach(function (text) { parts.push(text); });
    summary.textContent = parts.join(" ");
    summary.hidden = false;
    if (first) { first.focus(); }
  }

  ZK.validation = {
    rules: rules,
    attach: attach,
    validate: validate,
    reset: reset,
    showServerErrors: showServerErrors,
    todayISO: todayISO,
    addDaysISO: addDaysISO
  };
})();
