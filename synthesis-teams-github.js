(function () {
  "use strict";

  var ROOT_SELECTOR = "#about-teams";
  var STYLE_ID = "synthesis-teams-github-style";
  var ACTIVE_CLASS = "synthesis-teams-active";
  var ACTIVE_PANE_CLASS = "synthesis-teams-pane-active";
  var COLOR_ATTR = "data-synthesis-team-color";
  var ACTIVE_ATTR = "data-synthesis-active-team";
  var VERSION_ATTR = "data-synthesis-teams-version";
  var VERSION = "1.7.0";
  var FADE_DURATION = 220;
  var LEAVING_PANE_CLASS = "synthesis-teams-pane-leaving";

  /**
   * Scene-specific alt text from team process photos (order matches `<img>` DOM order per pane).
   * Keys are lowercase; lookup is case-insensitive against Webflow `data-w-tab`.
   *
   * Icons: `data-synthesis-teams-no-photo-alt` on `<img>`. Force replace: `data-synthesis-teams-alt-refresh`.
   */
  var TEAM_IMAGE_ALT_SCENES = {
    branding: [
      "Students adjust glowing cyan and orange light boxes on a table in a dim studio, with monitors and a RISO poster visible behind them.",
      "Students type and design on laptops around a large studio table; one screen shows the Synthesis ComDes exit review poster for May 12th.",
      "One student photographs another student seated on a stool under softboxes, with a peach-to-white gradient backdrop and studio lighting.",
      "A student laughs while opening a soda bottle as another student sits nearby in a room with a DFA sign and cork bulletin board.",
    ],
    experience: [
      "Several students lean in around a laptop on a desk in a design lab, with large-format equipment visible in the background.",
      "A student wearing an apron hands a boba tea across a counter to another student; payment QR codes sit on the counter.",
      "Three students collaborate around a laptop in a studio with walls covered in colorful prints and vinyl rolls on a shelf.",
      "Translucent yellow, orange, and green acrylic keychains and metal rings spread on a wooden table from the Experience team hand-assembly work.",
    ],
    fundraising: [
      "A student stands behind a fundraiser table with pastries, prints, postcards, and a ComDes Exit Review payments sign.",
      "A student smiles while holding a paper cup of coffee with latte art at an informal indoor meet-up.",
      "Two students smile behind The Boba Lab counter with tea jugs, colorful straws, and a payment sheet on the table.",
      "Three students pose outdoors by a brick pillar with hand-drawn Art + Coffee and Support TXST Art & Design signs.",
    ],
    photography: [
      "A group of students gather around a tripod-mounted camera under a large softbox, reviewing a shot in the studio.",
      "A student photographs another student in a red top under a parabolic softbox; the photographer appears as a silhouette with a lit camera screen.",
      "Two students shoot from behind a tripod as a smiling student poses against a pink, orange, and blue gradient backdrop.",
      "One student operates a camera on a stand while another student poses seated on a bench in front of a white screen with Neewer softboxes.",
    ],
    promotion: [
      "A student wearing blue gloves runs a large printer and holds fresh sheets in a studio wall covered with sketches; an Entry Only sign is on the door.",
      "Two students assemble chain and colorful acrylic pieces with pliers on a workshop table strewn with keychain supplies.",
      "Bold black, cyan, pink, and yellow graphic print sheets lie on a wooden table with pencils and keys—Promotion team printed pieces.",
      "About seven students sit and stand around a large studio table for a group meeting, several focused on a central laptop.",
    ],
    website: [
      "Five students work on laptops around a long white table in the Art & Design Resource Center, posters and string lights on the wall.",
      "Two students focus on laptops; a foreground screen shows site layout work, with a corkboard and projector screen in the room.",
      "Two students sit at a desk facing the camera with a sticker-covered laptop, art posters and studio signage on the wall behind them.",
      "Three students collaborate at a white desk; a laptop shows a spreadsheet tracking teams such as Branding, Website, and Promotion.",
    ],
  };

  function synthesisTeamTabId(tabName) {
    var base = String(tabName || "tab")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return "synthesis-team-tab-" + (base || "unnamed");
  }

  var COLORS = ["blue", "yellow", "pink"];
  var currentTabName = null;
  var observer = null;
  var applying = false;
  var scheduled = false;
  var fadeTimers = {};
  /** Skip MutationObserver reactions briefly while script/Webflow sync tab DOM (reduces applyState races). */
  var observerMutedUntil = 0;

  function muteObserver(ms) {
    observerMutedUntil = Date.now() + (ms || 500);
  }

  function observerIsMuted() {
    return Date.now() < observerMutedUntil;
  }

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

  function scenesForTabKey(tabKey) {
    var k = String(tabKey || "").trim();
    if (!k) return null;
    if (Object.prototype.hasOwnProperty.call(TEAM_IMAGE_ALT_SCENES, k))
      return TEAM_IMAGE_ALT_SCENES[k];
    var lower = k.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(TEAM_IMAGE_ALT_SCENES, lower))
      return TEAM_IMAGE_ALT_SCENES[lower];
    return null;
  }

  function getTeamLabelForTab(tabKey) {
    var key = String(tabKey || "").trim();
    if (!key) return "process";
    var i = 0;
    var tabList = tabs();
    for (; i < tabList.length; i++) {
      if (tabList[i].getAttribute("data-w-tab") === key) {
        var lab = tabList[i].querySelector(".tag-label");
        if (lab && String(lab.textContent || "").trim())
          return String(lab.textContent || "").trim();
        break;
      }
    }
    return key.replace(/-/g, " ");
  }

  function applyMeetTheTeamsImageAlts() {
    var container = root();
    if (!container) return;

    var fallbackScenes = [
      "Students on the {team} team collaborating on synthesis capstone work together.",
      "Students on the {team} team reviewing materials and discussing their process during the workshop.",
      "Students on the {team} team presenting project work and sharing feedback with one another.",
      "Students on the {team} team gathered for hands-on synthesis documentation and design tasks.",
    ];

    panes().forEach(function (pane) {
      var tabKey = pane.getAttribute("data-w-tab") || "";
      var teamLabel = getTeamLabelForTab(tabKey);
      var imgs = toArray(pane.querySelectorAll("img"));
      if (!imgs.length) return;

      var custom = scenesForTabKey(tabKey);
      var hasCustom = custom && custom.length;

      imgs.forEach(function (img, i) {
        if (img.getAttribute("data-synthesis-teams-no-photo-alt") != null) return;

        var existing = String(img.getAttribute("alt") || "").trim();
        var force = img.getAttribute("data-synthesis-teams-alt-refresh") != null;
        if (existing && !force) return;

        if (hasCustom) {
          var line = custom[Math.min(i, custom.length - 1)];
          if (line) {
            img.alt = line;
            return;
          }
        }

        var tmpl = fallbackScenes[i % fallbackScenes.length];
        img.alt = tmpl.replace(/\{team\}/g, teamLabel);
      });
    });
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css =
      ROOT_SELECTOR +
      " .about-teams-names-grid p.about-teams-name," +
      ROOT_SELECTOR +
      " p.about-teams-name{white-space:nowrap!important;word-break:normal!important;overflow-wrap:normal!important}" +
      /* z-index on .about-teams-links does not stack against .about-teams-content (different parents).
         Lift the whole side-nav column above the content column; keep links clickable inside it. */
      ROOT_SELECTOR +
      " .about-teams-side-nav{z-index:10!important}" +
      ROOT_SELECTOR +
      " .about-teams-links{position:relative!important;z-index:1!important}" +
      ROOT_SELECTOR +
      " .about-teams-content{position:relative!important;z-index:0!important}" +
      ROOT_SELECTOR +
      " .about-teams-content .about-teams-pane:not(.is-open){pointer-events:none!important}" +
      ROOT_SELECTOR +
      " .about-teams-content .about-teams-pane.is-open{pointer-events:auto!important}" +
      ROOT_SELECTOR +
      " .about-teams-links a.about-teams-tab-link{background-color:#fdfdfd!important;color:#030303!important;transition:background-color .15s ease!important;text-decoration:none!important;touch-action:manipulation!important}" +
      ROOT_SELECTOR +
      " .about-teams-content .about-teams-pane{opacity:0!important;transition:opacity " +
      FADE_DURATION +
      "ms ease!important;will-change:opacity!important}" +
      ROOT_SELECTOR +
      " .about-teams-content .about-teams-pane." +
      ACTIVE_PANE_CLASS +
      "{opacity:1!important}" +
      ROOT_SELECTOR +
      " .about-teams-content .about-teams-pane." +
      LEAVING_PANE_CLASS +
      "{opacity:0!important}" +
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
      " .about-teams-links a.about-teams-tab-link." +
      ACTIVE_CLASS +
      " .tag-label{color:#030303!important}";

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
    var tabList = document.querySelector(ROOT_SELECTOR + " .about-teams-links");
    if (tabList) tabList.setAttribute("role", "tablist");
    tabs().forEach(function (tab, index) {
      removeForeignTabState(tab);
      tab.setAttribute(COLOR_ATTR, tabColor(index));
      tab.setAttribute("role", "tab");
      var tabName = tab.getAttribute("data-w-tab");
      if (tabName) tab.id = synthesisTeamTabId(tabName);
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

  function paneKey(pane) {
    return pane.getAttribute("data-w-tab") || "";
  }

  function clearFadeTimer(pane) {
    var key = paneKey(pane);
    if (!key || !fadeTimers[key]) return;

    window.clearTimeout(fadeTimers[key]);
    fadeTimers[key] = null;
  }

  function showPane(pane, animate) {
    clearFadeTimer(pane);
    pane.classList.remove(LEAVING_PANE_CLASS, ACTIVE_PANE_CLASS);
    pane.classList.remove("w--tab-active");
    pane.setAttribute("aria-hidden", "false");
    pane.style.setProperty("display", "flex", "important");
    pane.style.removeProperty("pointer-events");

    if (!animate) {
      pane.classList.add(ACTIVE_PANE_CLASS, "is-open");
      return;
    }

    // Let the browser paint the pane at opacity 0 before fading it in.
    pane.offsetWidth;
    window.requestAnimationFrame(function () {
      pane.classList.add(ACTIVE_PANE_CLASS, "is-open");
    });
  }

  function hidePane(pane, animate) {
    var key = paneKey(pane);

    pane.classList.remove(ACTIVE_PANE_CLASS, "is-open", "w--tab-active");
    pane.setAttribute("aria-hidden", "true");
    /* Opacity-0 / leaving panes still hit-test; CSS also sets pointer-events via .is-open. */
    pane.style.setProperty("pointer-events", "none", "important");

    if (!animate && pane.classList.contains(LEAVING_PANE_CLASS) && fadeTimers[key]) {
      return;
    }

    if (!animate) {
      clearFadeTimer(pane);
      pane.classList.remove(LEAVING_PANE_CLASS);
      pane.style.setProperty("display", "none", "important");
      return;
    }

    pane.classList.add(LEAVING_PANE_CLASS);
    pane.style.setProperty("display", "flex", "important");
    clearFadeTimer(pane);

    fadeTimers[key] = window.setTimeout(function () {
      applying = true;
      pane.classList.remove(LEAVING_PANE_CLASS);
      pane.style.setProperty("display", "none", "important");
      pane.style.removeProperty("pointer-events");
      applying = false;
      fadeTimers[key] = null;
    }, FADE_DURATION);
  }

  function applyState(name) {
    var container = root();
    if (!container || !name) return;

    var previousTabName = currentTabName || initialTabName();
    var shouldAnimate = previousTabName && previousTabName !== name;

    muteObserver(520);
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
      var paneName = pane.getAttribute("data-w-tab");
      pane.setAttribute("role", "tabpanel");
      if (paneName) {
        pane.setAttribute("aria-labelledby", synthesisTeamTabId(paneName));
      }
      var isActive = paneName === name;
      var wasActive = paneName === previousTabName;

      if (isActive) {
        showPane(pane, shouldAnimate);
      } else {
        hidePane(pane, shouldAnimate && wasActive);
      }
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
    if (!name) return;

    muteObserver(520);
    applyState(name);
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
      if (applying || observerIsMuted()) return;
      scheduleApply();
    });

    observer.observe(container, {
      attributes: true,
      /* Do not include "style": this script sets display/pointer-events on panes, which would
         retrigger the observer every time and stack redundant applyState calls (racey with clicks). */
      attributeFilter: ["class", ACTIVE_ATTR, COLOR_ATTR],
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
    applyMeetTheTeamsImageAlts();
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
