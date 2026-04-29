(function () {
  "use strict";

  var ROOT_SELECTOR = "#about-teams";
  var STYLE_ID = "synthesis-teams-github-style";
  var ACTIVE_CLASS = "synthesis-teams-active";
  var ACTIVE_PANE_CLASS = "synthesis-teams-pane-active";
  var COLOR_ATTR = "data-synthesis-team-color";
  var ACTIVE_ATTR = "data-synthesis-active-team";
  var VERSION_ATTR = "data-synthesis-teams-version";
  var VERSION = "1.0.0";

  var COLORS = ["blue", "yellow", "pink"];
  var currentTabName = null;
  var observer = null;
  var applying = false;
  var scheduled = false;

  function toArray(list) {
    return Array.prototype.slice.call(list || []);
  }

  function root() {
    return document.querySelector(ROOT_SELECTOR);
  }

  function tabs() {
    return toArray(
      document.querySelectorAll(
        ROOT_SELECTOR + " .about-teams-links a[data-w-tab]",
      ),
    );
  }

  function panes() {
    return toArray(
      document.querySelectorAll(
        ROOT_SELECTOR + " .about-teams-content .about-teams-pane[data-w-tab]",
      ),
    );
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css =
      ROOT_SELECTOR +
      " .about-teams-names-grid p.about-teams-name," +
      ROOT_SELECTOR +
      " p.about-teams-name{white-space:nowrap!important;word-break:normal!important;overflow-wrap:normal!important}" +
      ROOT_SELECTOR +
      " .about-teams-links a.about-teams-tab-link{background-color:#fdfdfd!important;color:#030303!important;transition:background-color .15s ease!important;text-decoration:none!important}" +
      ROOT_SELECTOR +
      " .about-teams-links a.about-teams-tab-link:last-child{border-bottom-width:0!important;border-bottom-style:none!important}" +
      ROOT_SELECTOR +
      " .about-teams-links a.about-teams-tab-link .tag-label{color:#030303!important;font-weight:600!important}" +
      ROOT_SELECTOR +
      " .about-teams-links a.about-teams-tab-link[" +
      COLOR_ATTR +
      '="blue"]:is(:hover,.' +
      ACTIVE_CLASS +
      "){background-color:#28b5ff!important;color:#030303!important}" +
      ROOT_SELECTOR +
      " .about-teams-links a.about-teams-tab-link[" +
      COLOR_ATTR +
      '="yellow"]:is(:hover,.' +
      ACTIVE_CLASS +
      "){background-color:#ffe23a!important;color:#030303!important}" +
      ROOT_SELECTOR +
      " .about-teams-links a.about-teams-tab-link[" +
      COLOR_ATTR +
      '="pink"]:is(:hover,.' +
      ACTIVE_CLASS +
      "){background-color:#e1008d!important;color:#030303!important}" +
      ROOT_SELECTOR +
      " .about-teams-links a.about-teams-tab-link:is(:hover,." +
      ACTIVE_CLASS +
      ") .tag-label{color:#030303!important}";

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function tabColor(index) {
    return COLORS[index % COLORS.length];
  }

  function removeForeignTabState(tab) {
    tab.classList.remove("w--current", "is-on", "wfp", "wft");
    tab.style.removeProperty("background");
    tab.style.removeProperty("background-color");
    tab.style.removeProperty("color");

    var label = tab.querySelector(".tag-label");
    if (label) label.style.removeProperty("color");
  }

  function prepareTabs() {
    tabs().forEach(function (tab, index) {
      removeForeignTabState(tab);
      tab.setAttribute(COLOR_ATTR, tabColor(index));
    });
  }

  function firstTabName() {
    var first = tabs()[0];
    return first ? first.getAttribute("data-w-tab") : null;
  }

  function initialTabName() {
    var active = document.querySelector(
      ROOT_SELECTOR + " .about-teams-links a." + ACTIVE_CLASS + "[data-w-tab]",
    );
    if (active) return active.getAttribute("data-w-tab");

    var activePane = document.querySelector(
      ROOT_SELECTOR + " .about-teams-content .about-teams-pane.is-open[data-w-tab]",
    );
    if (activePane) return activePane.getAttribute("data-w-tab");

    var webflowPane = document.querySelector(
      ROOT_SELECTOR +
        " .about-teams-content .about-teams-pane.w--tab-active[data-w-tab]",
    );
    if (webflowPane) return webflowPane.getAttribute("data-w-tab");

    return firstTabName();
  }

  function applyState(name) {
    var container = root();
    if (!container || !name) return;

    applying = true;
    currentTabName = name;
    container.setAttribute(ACTIVE_ATTR, name);
    container.setAttribute(VERSION_ATTR, VERSION);

    prepareTabs();

    tabs().forEach(function (tab) {
      var isActive = tab.getAttribute("data-w-tab") === name;
      tab.classList.toggle(ACTIVE_CLASS, isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    panes().forEach(function (pane) {
      var isActive = pane.getAttribute("data-w-tab") === name;
      pane.classList.toggle(ACTIVE_PANE_CLASS, isActive);
      pane.classList.toggle("is-open", isActive);
      pane.classList.remove("w--tab-active");
      pane.setAttribute("aria-hidden", isActive ? "false" : "true");
      pane.style.setProperty("display", isActive ? "flex" : "none", "important");
    });

    applying = false;
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;

    window.requestAnimationFrame(function () {
      scheduled = false;
      applyState(currentTabName || initialTabName());
    });
  }

  function handleClick(event) {
    var container = root();
    var tab =
      event.target &&
      event.target.closest &&
      event.target.closest(ROOT_SELECTOR + " .about-teams-links a[data-w-tab]");

    if (!container || !tab || !container.contains(tab)) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();

    var name = tab.getAttribute("data-w-tab");
    applyState(name);

    // Run after any older Webflow/App listeners that may still be globally applied.
    window.setTimeout(function () {
      applyState(name);
    }, 0);
    window.requestAnimationFrame(function () {
      applyState(name);
    });
  }

  function bindEvents() {
    var container = root();
    if (!container || container.getAttribute("data-synthesis-teams-bound") === VERSION) {
      return;
    }

    container.setAttribute("data-synthesis-teams-bound", VERSION);
    container.addEventListener("click", handleClick, true);
  }

  function observeMutations() {
    var container = root();
    if (!container || observer) return;

    observer = new MutationObserver(function () {
      if (applying) return;
      scheduleApply();
    });

    observer.observe(container, {
      attributes: true,
      attributeFilter: ["class", "style", ACTIVE_ATTR, COLOR_ATTR],
      childList: false,
      subtree: true,
    });
  }

  function init() {
    var container = root();
    if (!container) return;

    injectStyles();
    bindEvents();
    applyState(currentTabName || initialTabName());
    observeMutations();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("load", function () {
    window.setTimeout(init, 100);
  });
})();
