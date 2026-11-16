/* Клієнт REST API сайту «Затишна кава» (лабораторна робота № 5).
   Fetch API + Promise + async/await. Підключається після components.js, перед main.js. */
(function () {
  "use strict";

  var ZK = (window.ZK = window.ZK || {});
  var TIMEOUT_MS = 8000;

  /* Помилка API: status = 0 для мережевих збоїв, fields — помилки полів із відповіді 422 */
  function ApiError(message, status, fields) {
    this.name = "ApiError";
    this.message = message;
    this.status = status;
    this.fields = fields || null;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  async function request(method, url, body) {
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    try {
      var options = { method: method, headers: { Accept: "application/json" }, signal: controller.signal };
      if (body !== undefined) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }
      var response = await fetch(url, options);
      var data = null;
      if (response.status !== 204) {
        try { data = await response.json(); } catch (e) { data = null; }
      }
      if (!response.ok) {
        var message = (data && data.error) || "Помилка сервера (" + response.status + "). Спробуйте пізніше.";
        throw new ApiError(message, response.status, data && data.errors);
      }
      return data;
    } catch (error) {
      if (error instanceof ApiError) { throw error; }
      if (error && error.name === "AbortError") {
        throw new ApiError("Сервер не відповів вчасно. Спробуйте ще раз.", 0);
      }
      throw new ApiError("Немає з’єднання із сервером. Перевірте інтернет і спробуйте ще раз.", 0);
    } finally {
      window.clearTimeout(timer);
    }
  }

  ZK.api = {
    ApiError: ApiError,
    getMenu: function () { return request("GET", "/api/menu"); },
    getSlots: function (date) { return request("GET", "/api/bookings/slots?date=" + encodeURIComponent(date)); },
    createOrder: function (payload) { return request("POST", "/api/orders", payload); },
    createBooking: function (payload) { return request("POST", "/api/bookings", payload); },
    sendFeedback: function (payload) { return request("POST", "/api/feedback", payload); }
  };
})();
