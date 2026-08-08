const API_BASE = "https://prices.runescape.wiki/api/v2/rs";

const API = {
  mapping: API_BASE + "/mapping",
  latest: API_BASE + "/latest"
};

const LIST_INDEX = "lists/index.json";
const CUSTOM_LIST_KEY = "rs3-price-dashboard-custom-lists";

let mapping = [];
let prices = {};
let builtInLists = [];
let customLists = [];
let currentList = null;
let currentRows = [];

const listButtons = document.getElementById("listButtons");
const listTitle = document.getElementById("listTitle");
const listSummary = document.getElementById("listSummary");
const tableBody = document.getElementById("priceTable");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const lastUpdated = document.getElementById("lastUpdated");


// ============================================================
// START
// ============================================================

init();

async function init() {
  try {
    setStatus("Loading", false);

    loadCustomLists();
    await loadBuiltInLists();
    await loadData();

    createListButtons();

    const first = builtInLists[0] || customLists[0];

    if (first) {
      currentList = first.id;
      updateActiveButton();
      renderList();
    }

    setStatus("Live", true);

  } catch (error) {
    console.error(error);
    setStatus("Error", false, true);
    lastUpdated.textContent = error.message;
  }
}


// ============================================================
// BUILT-IN LISTS
// ============================================================

async function loadBuiltInLists() {
  const response = await fetch(
    LIST_INDEX + "?t=" + Date.now()
  );

  if (!response.ok) {
    throw new Error("Could not load lists/index.json");
  }

  const index = await response.json();

  if (!Array.isArray(index.lists)) {
    throw new Error("Invalid lists/index.json");
  }

  builtInLists = [];

  for (const filename of index.lists) {
    const response = await fetch(
      "lists/" + filename + "?t=" + Date.now()
    );

    if (!response.ok) {
      console.warn("Could not load:", filename);
      continue;
    }

    const list = await response.json();

    if (!list.name || !Array.isArray(list.items)) {
      continue;
    }

    builtInLists.push({
      id: "builtin:" + filename,
      name: list.name,
      items: list.items,
      builtin: true
    });
  }
}


// ============================================================
// CUSTOM LIST STORAGE
// ============================================================

function loadCustomLists() {
  try {
    const saved = localStorage.getItem(CUSTOM_LIST_KEY);

    customLists = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(customLists)) {
      customLists = [];
    }

  } catch (error) {
    console.error(error);
    customLists = [];
  }
}

function saveCustomLists() {
  localStorage.setItem(
    CUSTOM_LIST_KEY,
    JSON.stringify(customLists)
  );
}

function getAllLists() {
  return [
    ...builtInLists,
    ...customLists
  ];
}

function getCurrentList() {
  return getAllLists().find(
    list => list.id === currentList
  );
}


// ============================================================
// API
// ============================================================

async function loadData() {
  const [mappingResponse, latestResponse] =
    await Promise.all([
      fetch(API.mapping),
      fetch(API.latest)
    ]);

  if (!mappingResponse.ok) {
    throw new Error(
      "Mapping API returned HTTP " +
      mappingResponse.status
    );
  }

  if (!latestResponse.ok) {
    throw new Error(
      "Latest API returned HTTP " +
      latestResponse.status
    );
  }

  mapping = await mappingResponse.json();

  const latest = await latestResponse.json();

  prices = latest.data || {};

  lastUpdated.textContent =
    "Updated " +
    new Date().toLocaleTimeString();
}


// ============================================================
// SIDEBAR
// ============================================================

function createListButtons() {
  listButtons.innerHTML = "";

  builtInLists.forEach(list => {
    addListButton(list, false);
  });

  if (customLists.length) {
    const divider = document.createElement("div");
    divider.className = "list-divider";
    listButtons.appendChild(divider);
  }

  customLists.forEach(list => {
    addListButton(list, true);
  });

  const addButton = document.createElement("button");
  addButton.className = "new-list-button";
  addButton.textContent = "+ New List";
  addButton.onclick = createNewList;
  listButtons.appendChild(addButton);

  const importButton = document.createElement("button");
  importButton.className = "manage-list-button";
  importButton.textContent = "Import Lists";
  importButton.onclick = importLists;
  listButtons.appendChild(importButton);

  const exportButton = document.createElement("button");
  exportButton.className = "manage-list-button";
  exportButton.textContent = "Export Lists";
  exportButton.onclick = exportLists;
  listButtons.appendChild(exportButton);
}

function addListButton(list, custom) {
  const wrapper = document.createElement("div");
  wrapper.className = "list-row";

  const button = document.createElement("button");
  button.className = "list-button";
  button.dataset.list = list.id;
  button.textContent = list.name;

  if (custom) {
    button.classList.add("custom");
  }

  button.onclick = () => {
    currentList = list.id;
    searchInput.value = "";
    sortSelect.value = "default";
    updateActiveButton();
    renderList();
  };

  wrapper.appendChild(button);

  if (custom) {
    const menuButton = document.createElement("button");
    menuButton.className = "list-menu-button";
    menuButton.textContent = "⋮";
    menuButton.title = "List options";

    menuButton.onclick = event => {
      event.stopPropagation();
      showListMenu(list, menuButton);
    };

    wrapper.appendChild(menuButton);
  }

  listButtons.appendChild(wrapper);
}

function updateActiveButton() {
  document
    .querySelectorAll(".list-button")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.list === currentList
      );
    });
}


// ============================================================
// NEW LIST
// ============================================================

function createNewList() {
  const name = prompt("List name:");

  if (!name || !name.trim()) {
    return;
  }

  const trimmed = name.trim();

  if (
    getAllLists().some(
      list =>
        list.name.toLowerCase() ===
        trimmed.toLowerCase()
    )
  ) {
    alert("A list with that name already exists.");
    return;
  }

  const list = {
    id: "custom:" + Date.now(),
    name: trimmed,
    items: [],
    builtin: false
  };

  customLists.push(list);
  saveCustomLists();

  currentList = list.id;

  createListButtons();
  updateActiveButton();
  renderList();

  openItemPicker();
}


// ============================================================
// LIST MENU
// ============================================================

function showListMenu(list, anchor) {
  closePopups();

  const menu = document.createElement("div");
  menu.className = "list-popup";

  const rename = menuItem("Rename", () => {
    closePopups();

    const name = prompt(
      "New list name:",
      list.name
    );

    if (!name || !name.trim()) {
      return;
    }

    list.name = name.trim();

    saveCustomLists();
    createListButtons();
    updateActiveButton();
    renderList();
  });

  const add = menuItem("Add Items", () => {
    closePopups();
    currentList = list.id;
    openItemPicker();
  });

  const duplicate = menuItem("Duplicate", () => {
    closePopups();

    const copy = {
      id: "custom:" + Date.now(),
      name: list.name + " Copy",
      items: [...list.items],
      builtin: false
    };

    customLists.push(copy);
    saveCustomLists();

    currentList = copy.id;

    createListButtons();
    updateActiveButton();
    renderList();
  });

  const remove = menuItem("Delete", () => {
    closePopups();

    if (
      !confirm(
        'Delete "' + list.name + '"?'
      )
    ) {
      return;
    }

    customLists = customLists.filter(
      item => item.id !== list.id
    );

    saveCustomLists();

    const fallback =
      builtInLists[0] ||
      customLists[0];

    currentList =
      fallback ? fallback.id : null;

    createListButtons();
    updateActiveButton();
    renderList();
  });

  menu.appendChild(rename);
  menu.appendChild(add);
  menu.appendChild(duplicate);

  const separator = document.createElement("div");
  separator.className = "popup-separator";
  menu.appendChild(separator);

  menu.appendChild(remove);

  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();

  menu.style.position = "fixed";
  menu.style.left =
    Math.min(
      rect.right + 4,
      window.innerWidth - 180
    ) + "px";
  menu.style.top =
    rect.top + "px";

  setTimeout(() => {
    document.addEventListener(
      "click",
      closePopups,
      { once: true }
    );
  });
}

function menuItem(text, action) {
  const item = document.createElement("button");

  item.className = "popup-item";
  item.textContent = text;
  item.onclick = action;

  return item;
}

function closePopups() {
  document
    .querySelectorAll(".list-popup")
    .forEach(popup => popup.remove());
}


// ============================================================
// ITEM PICKER
// ============================================================

function openItemPicker() {
  const list = getCurrentList();

  if (!list || list.builtin) {
    return;
  }

  closePopups();

  const overlay = document.createElement("div");
  overlay.className = "item-picker-overlay";

  const modal = document.createElement("div");
  modal.className = "item-picker";

  const header = document.createElement("div");
  header.className = "item-picker-header";

  const title = document.createElement("h2");
  title.textContent =
    "Add items to " + list.name;

  const close = document.createElement("button");
  close.className = "picker-close";
  close.textContent = "×";

  close.onclick = () => overlay.remove();

  header.appendChild(title);
  header.appendChild(close);

  const input = document.createElement("input");
  input.className = "item-picker-search";
  input.placeholder = "Search RS3 items...";
  input.autocomplete = "off";

  const results = document.createElement("div");
  results.className = "item-picker-results";

  const selected = document.createElement("div");
  selected.className = "item-picker-selected";

  modal.appendChild(header);
  modal.appendChild(input);
  modal.appendChild(results);
  modal.appendChild(selected);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function renderSelected() {
    selected.innerHTML = "";

    const heading = document.createElement("div");
    heading.className = "selected-heading";
    heading.textContent =
      "Items in this list (" +
      list.items.length +
      ")";

    selected.appendChild(heading);

    list.items.forEach(id => {
      const item = mapping.find(
        mapped =>
          Number(mapped.id) === Number(id)
      );

      if (!item) {
        return;
      }

      const chip = document.createElement("button");
      chip.className = "selected-item";
      chip.textContent = "× " + item.name;

      chip.onclick = () => {
        list.items =
          list.items.filter(
            existing =>
              Number(existing) !==
              Number(id)
          );

        saveCustomLists();
        renderSelected();
        renderList();
      };

      selected.appendChild(chip);
    });
  }

  function renderResults() {
    const query =
      input.value
        .trim()
        .toLowerCase();

    results.innerHTML = "";

    if (!query) {
      return;
    }

    const matches =
      mapping
        .filter(item => {
          if (!item.name) {
            return false;
          }

          return item.name
            .toLowerCase()
            .includes(query);
        })
        .slice(0, 25);

    if (!matches.length) {
      const empty =
        document.createElement("div");

      empty.className =
        "picker-no-results";

      empty.textContent =
        "No matching items.";

      results.appendChild(empty);
      return;
    }

    matches.forEach(item => {
      const alreadyAdded =
        list.items.some(
          id =>
            Number(id) ===
            Number(item.id)
        );

      const result =
        document.createElement("button");

      result.className =
        "picker-result";

      const name =
        document.createElement("span");

      name.textContent =
        item.name;

      const id =
        document.createElement("small");

      id.textContent =
        "#" + item.id;

      result.appendChild(name);
      result.appendChild(id);

      if (alreadyAdded) {
        result.classList.add("already-added");
      }

      result.onclick = () => {
        if (alreadyAdded) {
          return;
        }

        list.items.push(
          Number(item.id)
        );

        saveCustomLists();

        input.value = "";
        results.innerHTML = "";

        renderSelected();
        renderList();
      };

      results.appendChild(result);
    });
  }

  input.addEventListener(
    "input",
    renderResults
  );

  overlay.addEventListener(
    "click",
    event => {
      if (event.target === overlay) {
        overlay.remove();
      }
    }
  );

  renderSelected();

  setTimeout(
    () => input.focus(),
    50
  );
}


// ============================================================
// TABLE
// ============================================================

function buildRows() {
  const list = getCurrentList();

  if (!list) {
    return [];
  }

  return list.items.map(
    (item, index) => {
      let itemData;

      if (typeof item === "number") {
        itemData = mapping.find(
          mapped =>
            Number(mapped.id) ===
            Number(item)
        );
      } else {
        itemData = findItem(item);
      }

      if (!itemData) {
        return {
          name: String(item),
          id: null,
          buy: null,
          sell: null,
          buyTime: null,
          sellTime: null,
          margin: null,
          volume: null,
          index
        };
      }

      const id =
        Number(itemData.id);

      const price =
        prices[id];

      if (!price) {
        return {
          name: itemData.name,
          id,
          buy: null,
          sell: null,
          buyTime: null,
          sellTime: null,
          margin: null,
          volume: null,
          index
        };
      }

      const buy =
        price.high ?? null;

      const sell =
        price.low ?? null;

      return {
        name: itemData.name,
        id,
        buy,
        sell,
        buyTime:
          price.highTime ?? null,
        sellTime:
          price.lowTime ?? null,
        margin:
          buy !== null &&
          sell !== null
            ? buy - sell
            : null,
        volume:
          price.volume ??
          price.dailyVolume ??
          null,
        index
      };
    }
  );
}

function findItem(name) {
  const wanted =
    String(name)
      .trim()
      .toLowerCase();

  return mapping.find(
    item =>
      String(item.name || "")
        .trim()
        .toLowerCase() === wanted
  );
}

function renderList() {
  const list = getCurrentList();

  if (!list) {
    return;
  }

  currentRows = buildRows();

  listTitle.textContent =
    list.name;

  const available =
    currentRows.filter(
      row =>
        row.buy !== null ||
        row.sell !== null
    ).length;

  listSummary.textContent =
    currentRows.length +
    " items · " +
    available +
    " with current prices";

  renderTable(currentRows);
}

function renderTable(rows) {
  let visible = rows.slice();

  const search =
    searchInput.value
      .trim()
      .toLowerCase();

  if (search) {
    visible = visible.filter(
      row =>
        row.name
          .toLowerCase()
          .includes(search)
    );
  }

  visible =
    sortRows(
      visible,
      sortSelect.value
    );

  tableBody.innerHTML = "";

  if (!visible.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  visible.forEach(row => {
    tableBody.appendChild(
      createRow(row)
    );
  });
}

function createRow(row) {
  const tr =
    document.createElement("tr");

  const item =
    document.createElement("td");

  item.className = "item";
  item.textContent = row.name;

  const buy =
    document.createElement("td");

  buy.className = "price";
  buy.textContent =
    formatPrice(row.buy);

  const buyAge =
    document.createElement("td");

  buyAge.className =
    "age " +
    ageClass(row.buyTime);

  buyAge.textContent =
    formatAge(row.buyTime);

  const sell =
    document.createElement("td");

  sell.className = "price";
  sell.textContent =
    formatPrice(row.sell);

  const sellAge =
    document.createElement("td");

  sellAge.className =
    "age " +
    ageClass(row.sellTime);

  sellAge.textContent =
    formatAge(row.sellTime);

  const margin =
    document.createElement("td");

  if (row.margin !== null) {
    margin.className =
      row.margin >= 0
        ? "margin-positive"
        : "margin-negative";
  }

  margin.textContent =
    formatMargin(row.margin);

  const volume =
    document.createElement("td");

  volume.className = "volume";
  volume.textContent =
    formatCompact(row.volume);

  tr.appendChild(item);
  tr.appendChild(buy);
  tr.appendChild(buyAge);
  tr.appendChild(sell);
  tr.appendChild(sellAge);
  tr.appendChild(margin);
  tr.appendChild(volume);

  return tr;
}


// ============================================================
// SORTING
// ============================================================

function sortRows(rows, mode) {
  if (mode === "default") {
    return rows.sort(
      (a, b) =>
        a.index - b.index
    );
  }

  if (mode === "name") {
    return rows.sort(
      (a, b) =>
        a.name.localeCompare(b.name)
    );
  }

  return rows.sort(
    (a, b) => {
      const av =
        a[mode] ?? -Infinity;

      const bv =
        b[mode] ?? -Infinity;

      return bv - av;
    }
  );
}


// ============================================================
// FORMATTING
// ============================================================

function formatPrice(value) {
  return value === null
    ? "—"
    : formatCompact(value);
}

function formatMargin(value) {
  if (value === null) {
    return "—";
  }

  const sign =
    value > 0 ? "+" : "";

  return (
    sign +
    Math.round(value)
      .toLocaleString()
  );
}

function formatCompact(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  const absolute =
    Math.abs(number);

  if (absolute < 1000000) {
    return Math.round(number)
      .toLocaleString();
  }

  if (absolute < 1000000000) {
    return (
      number / 1000000
    )
      .toFixed(3)
      .replace(/\.?0+$/, "") +
      "M";
  }

  return (
    number / 1000000000
  )
    .toFixed(3)
    .replace(/\.?0+$/, "") +
    "B";
}


// ============================================================
// TIME
// ============================================================

function formatAge(timestamp) {
  if (!timestamp) {
    return "—";
  }

  let seconds =
    Math.floor(
      (
        Date.now() -
        Number(timestamp) * 1000
      ) / 1000
    );

  seconds =
    Math.max(0, seconds);

  if (seconds < 60) {
    return "just now";
  }

  const minutes =
    Math.floor(seconds / 60);

  if (minutes < 60) {
    return minutes === 1
      ? "1 min"
      : minutes + " min";
  }

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24) {
    return hours === 1
      ? "1 hr"
      : hours + " hr";
  }

  const days =
    Math.floor(hours / 24);

  return days === 1
    ? "1 day"
    : days + " days";
}

function ageClass(timestamp) {
  if (!timestamp) {
    return "";
  }

  const age =
    Date.now() -
    Number(timestamp) * 1000;

  const minutes =
    age / 60000;

  if (minutes < 5) {
    return "fresh";
  }

  if (minutes < 60) {
    return "warning";
  }

  return "stale";
}


// ============================================================
// IMPORT / EXPORT
// ============================================================

function exportLists() {
  if (!customLists.length) {
    alert("You don't have any custom lists to export.");
    return;
  }

  const blob = new Blob(
    [
      JSON.stringify(
        customLists,
        null,
        2
      )
    ],
    {
      type: "application/json"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download =
    "rs3-custom-lists.json";

  link.click();

  URL.revokeObjectURL(url);
}

function importLists() {
  const input =
    document.createElement("input");

  input.type = "file";
  input.accept =
    ".json,application/json";

  input.onchange = () => {
    const file = input.files[0];

    if (!file) {
      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      try {
        const imported =
          JSON.parse(
            reader.result
          );

        if (!Array.isArray(imported)) {
          throw new Error();
        }

        let importedCount = 0;

        imported.forEach(list => {
          if (
            !list.name ||
            !Array.isArray(list.items)
          ) {
            return;
          }

          customLists.push({
            id:
              "custom:" +
              Date.now() +
              ":" +
              Math.random(),

            name:
              list.name,

            items:
              list.items.map(
                Number
              ),

            builtin:
              false
          });

          importedCount++;
        });

        saveCustomLists();
        createListButtons();

        alert(
          importedCount +
          " list" +
          (importedCount === 1
            ? ""
            : "s") +
          " imported."
        );

      } catch {
        alert(
          "That doesn't appear to be a valid RS3 list export."
        );
      }
    };

    reader.readAsText(file);
  };

  input.click();
}


// ============================================================
// SEARCH / SORT
// ============================================================

searchInput.addEventListener(
  "input",
  () => renderTable(currentRows)
);

sortSelect.addEventListener(
  "change",
  () => renderTable(currentRows)
);


// ============================================================
// AUTO REFRESH
// ============================================================

setInterval(
  async () => {
    try {
      setStatus(
        "Updating",
        false
      );

      await loadData();
      renderList();

      setStatus(
        "Live",
        true
      );

    } catch (error) {
      console.error(error);

      setStatus(
        "API Error",
        false,
        true
      );
    }
  },
  60 * 1000
);


// ============================================================
// STATUS
// ============================================================

function setStatus(
  text,
  live,
  error
) {
  statusText.textContent =
    text;

  statusDot.className =
    "status-dot";

  if (live) {
    statusDot.classList.add(
      "live"
    );
  }

  if (error) {
    statusDot.classList.add(
      "error"
    );
  }
}
