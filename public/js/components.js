/* Інтерактивні компоненти: сповіщення (toast), модальне вікно, акордеон. */
(function () {
  "use strict";

  var ZK = (window.ZK = window.ZK || {});

  /* ---------- Сповіщення ---------- */
  var toast = {
    region: null,

    show: function (message) {
      if (!this.region) {
        this.region = document.createElement("div");
        this.region.className = "toast-region";
        this.region.setAttribute("role", "status");
        this.region.setAttribute("aria-live", "polite");
        document.body.appendChild(this.region);
      }
      var item = document.createElement("div");
      item.className = "toast";
      item.textContent = message;
      this.region.appendChild(item);
      window.setTimeout(function () {
        if (item.parentNode) { item.parentNode.removeChild(item); }
      }, 2500);
    }
  };

  /* ---------- Модальне вікно з деталями позиції меню ---------- */
  var modal = {
    dialog: null,
    opener: null,

    build: function () {
      var dialog = document.createElement("dialog");
      dialog.className = "modal";
      dialog.setAttribute("aria-labelledby", "modal-title");
      dialog.innerHTML =
        '<button class="modal__close" type="button" aria-label="Закрити">\u00d7</button>' +
        '<img class="modal__img" alt="" width="600" height="400">' +
        '<div class="modal__body">' +
        '<div class="modal__head"><h2 class="modal__title" id="modal-title"></h2><p class="modal__price"></p></div>' +
        '<p class="modal__text"></p>' +
        '<p class="modal__allergen" hidden></p>' +
        '<button class="btn btn--primary" type="button" data-add-to-cart>До кошика</button>' +
        "</div>";
      document.body.appendChild(dialog);

      var self = this;
      dialog.querySelector(".modal__close").addEventListener("click", function () {
        dialog.close();
      });
      // клік по затемненому фону закриває вікно
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) { dialog.close(); }
      });
      dialog.addEventListener("close", function () {
        document.documentElement.classList.remove("has-modal");
        if (self.opener) { self.opener.focus(); }
      });
      this.dialog = dialog;
    },

    openProduct: function (data, opener) {
      if (!this.dialog) { this.build(); }
      var d = this.dialog;
      var img = d.querySelector(".modal__img");
      img.src = data.image;
      img.alt = data.imageAlt;
      d.querySelector(".modal__title").textContent = data.title;
      d.querySelector(".modal__price").textContent = data.price;
      d.querySelector(".modal__text").textContent = data.text;
      var allergen = d.querySelector(".modal__allergen");
      allergen.hidden = !data.allergen;
      allergen.textContent = data.allergen ? "Алергени: " + data.allergen : "";
      var addBtn = d.querySelector("[data-add-to-cart]");
      addBtn.dataset.name = data.title;
      addBtn.dataset.id = data.id || "";
      this.opener = opener || null;
      document.documentElement.classList.add("has-modal");
      d.showModal();
    }
  };

  /* ---------- Акордеон ---------- */
  function initAccordions() {
    document.querySelectorAll("[data-accordion]").forEach(function (root) {
      var triggers = Array.prototype.slice.call(root.querySelectorAll(".accordion__trigger"));

      function setOpen(trigger, open) {
        trigger.setAttribute("aria-expanded", String(open));
        document.getElementById(trigger.getAttribute("aria-controls")).hidden = !open;
      }

      root.addEventListener("click", function (event) {
        var trigger = event.target.closest(".accordion__trigger");
        if (!trigger) { return; }
        var willOpen = trigger.getAttribute("aria-expanded") !== "true";
        triggers.forEach(function (t) { setOpen(t, false); });
        setOpen(trigger, willOpen);
      });

      // навігація клавіатурою
      root.addEventListener("keydown", function (event) {
        var index = triggers.indexOf(document.activeElement);
        if (index === -1) { return; }
        var next = null;
        if (event.key === "ArrowDown") { next = triggers[(index + 1) % triggers.length]; }
        if (event.key === "ArrowUp") { next = triggers[(index - 1 + triggers.length) % triggers.length]; }
        if (event.key === "Home") { next = triggers[0]; }
        if (event.key === "End") { next = triggers[triggers.length - 1]; }
        if (next) {
          event.preventDefault();
          next.focus();
        }
      });
    });
  }

  ZK.toast = toast;
  ZK.modal = modal;
  ZK.initAccordions = initAccordions;
})();
