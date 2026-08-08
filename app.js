const API_BASE =
  "https://prices.runescape.wiki/api/v2/rs";

const API = {
  mapping: API_BASE + "/mapping",
  latest: API_BASE + "/latest"
};

const LIST_INDEX =
  "lists/index.json";

const CUSTOM_LIST_KEY =
  "rs3-price-dashboard-custom-lists";


// ============================================================
// STATE
// ============================================================

let mapping = [];
let prices = {};

let builtInLists = [];
let customLists = [];

let currentList = null;
let currentRows = [];


// ============================================================
// DOM
// ============================================================

const listButtons =
  document.getElementById("listButtons");

const listTitle =
  document.getElementById("listTitle");

const listSummary =
  document.getElementById("listSummary");

const tableBody =
  document.getElementById("priceTable");

const emptyState =
  document.getElementById("emptyState");

const searchInput =
  document.getElementById("searchInput");

const sortSelect =
  document.getElementById("sortSelect");

const statusDot =
  document.getElementById("statusDot");

const statusText =
  document.getElementById("statusText");

const lastUpdated =
  document.getElementById("lastUpdated");


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

    if (
      builtInLists.length > 0 ||
      customLists.length > 0
    ) {
      const first =
        builtInLists[0] ||
        customLists[0];

      currentList =
        first.id ||
        first.name;

      updateActiveButton();
      renderList();
    }

    setStatus("Live", true);

  } catch (error) {
    console.error(error);

    setStatus(
      "Error",
      false,
      true
    );

    lastUpdated.textContent =
      error.message;
  }
}


// ============================================================
// BUILT-IN LISTS
// ============================================================

async function loadBuiltInLists() {
  const response =
    await fetch(
      LIST_INDEX +
      "?t=" +
      Date.now()
    );

  if (!response.ok) {
    throw new Error(
      "Could not load lists/index.json"
    );
  }

  const index =
    await response.json();

  if (
    !index.lists ||
    !Array.isArray(index.lists)
  ) {
    throw new Error(
      "Invalid lists/index.json"
    );
  }

  builtInLists = [];

  for (
    const filename of index.lists
  ) {
    const response =
      await fetch(
        "lists/" +
        filename +
        "?t=" +
        Date.now()
      );

    if (!response.ok) {
      console.warn(
        "Could not load:",
        filename
      );

      continue;
    }

    const list =
      await response.json();

    if (
      !list.name ||
      !Array.isArray(list.items)
    ) {
      continue;
    }

    builtInLists.push({
      id:
        "builtin:" +
        filename,

      name:
        list.name,

      items:
        list.items,

      builtin:
        true
    });
  }
}


// ============================================================
// CUSTOM LIST STORAGE
// ============================================================

function loadCustomLists() {
  try {
    const saved =
      localStorage.getItem(
        CUSTOM_LIST_KEY
      );

    customLists =
      saved
        ? JSON.parse(saved)
        : [];

    if (!Array.isArray(customLists)) {
      customLists = [];
    }

  } catch (error) {
    console.error(
      "Could not load custom lists:",
      error
    );

    customLists = [];
  }
}


function saveCustomLists() {
  localStorage.setItem(
    CUSTOM_LIST_KEY,
    JSON.stringify(
      customLists
    )
  );
}


// ============================================================
// ALL LISTS
// ============================================================

function getAllLists() {
  return [
    ...builtInLists,
    ...customLists
  ];
}


function getCurrentList() {
  return getAllLists().find(
    function(list) {
      return list.id ===
        currentList;
    }
  );
}


// ============================================================
// RS3 API
// ============================================================

async function loadData() {
  const [
    mappingResponse,
    latestResponse
  ] = await Promise.all([
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

  mapping =
    await mappingResponse.json();

  const latest =
    await latestResponse.json();

  prices =
    latest.data || {};

  lastUpdated.textContent =
    "Updated " +
    new Date().toLocaleTimeString();
}


// ============================================================
// SIDEBAR
// ============================================================

function createListButtons() {
  listButtons.innerHTML = "";

  builtInLists.forEach(
    function(list) {
      addListButton(
        list,
        false
      );
    }
  );


  if (customLists.length > 0) {
    const divider =
      document.createElement("div");

    divider.className =
      "list-divider";

    listButtons.appendChild(
      divider
    );
  }


  customLists.forEach(
    function(list) {
      addListButton(
        list,
        true
      );
    }
  );


  const addButton =
    document.createElement("button");

  addButton.className =
    "new-list-button";

  addButton.textContent =
    "+ New List";

  addButton.addEventListener(
    "click",
    createNewList
  );

  listButtons.appendChild(
    addButton
  );


  const manageButton =
    document.createElement("button");

  manageButton.className =
    "manage-list-button";

  manageButton.textContent =
    "Manage Lists";

  manageButton.addEventListener(
    "click",
    showManageLists
  );

  listButtons.appendChild(
    manageButton
  );
}


function addListButton(
  list,
  custom
) {
  const button =
    document.createElement("button");

  button.className =
    "list-button";

  if (custom) {
    button.classList.add(
      "custom"
    );
  }

  button.textContent =
    list.name;

  button.dataset.list =
    list.id;

  button.addEventListener(
    "click",
    function() {
      currentList =
        list.id;

      searchInput.value = "";
      sortSelect.value =
        "default";

      updateActiveButton();
      renderList();
    }
  );

  listButtons.appendChild(
    button
  );
}


// ============================================================
// ACTIVE BUTTON
// ============================================================

function updateActiveButton() {
  document
    .querySelectorAll(".list-button")
    .forEach(
      function(button) {
        button.classList.toggle(
          "active",
          button.dataset.list ===
            currentList
        );
      }
    );
}


// ============================================================
// BUILD PRICE ROWS
// ============================================================

function buildRows() {
  const list =
    getCurrentList();

  if (!list) {
    return [];
  }


  return list.items.map(
    function(item, index) {

      let itemData;


      if (
        typeof item ===
        "number"
      ) {
        itemData =
          mapping.find(
            function(mapped) {
              return Number(
                mapped.id
              ) === item;
            }
          );

      } else {
        itemData =
          findItem(item);
      }


      if (!itemData) {
        return {
          name:
            String(item),

          id: null,
          buy: null,
          sell: null,
          buyTime: null,
          sellTime: null,
          margin: null,
          volume: null,
          index: index
        };
      }


      const id =
        Number(itemData.id);

      const price =
        prices[id];


      if (!price) {
        return {
          name:
            itemData.name,

          id: id,
          buy: null,
          sell: null,
          buyTime: null,
          sellTime: null,
          margin: null,
          volume: null,
          index: index
        };
      }


      const buy =
        price.high ?? null;

      const sell =
        price.low ?? null;


      return {
        name:
          itemData.name,

        id: id,

        buy:
          buy,

        sell:
          sell,

        buyTime:
          price.highTime ??
          null,

        sellTime:
          price.lowTime ??
          null,

        margin:
          buy !== null &&
          sell !== null
            ? buy - sell
            : null,

        volume:
          price.volume ??
          price.dailyVolume ??
          null,

        index: index
      };
    }
  );
}


// ============================================================
// ITEM LOOKUP
// ============================================================

function findItem(name) {
  const wanted =
    String(name)
      .trim()
      .toLowerCase();

  return mapping.find(
    function(item) {
      return String(
        item.name || ""
      )
        .trim()
        .toLowerCase() ===
        wanted;
    }
  );
}


// ============================================================
// RENDER LIST
// ============================================================

function renderList() {
  currentRows =
    buildRows();

  const list =
    getCurrentList();

  if (!list) {
    return;
  }


  listTitle.textContent =
    list.name;


  const available =
    currentRows.filter(
      function(row) {
        return (
          row.buy !== null ||
          row.sell !== null
        );
      }
    ).length;


  listSummary.textContent =
    currentRows.length +
    " items · " +
    available +
    " with current prices";


  renderTable(
    currentRows
  );
}


// ============================================================
// TABLE
// ============================================================

function renderTable(rows) {
  let visible =
    rows.slice();


  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  if (search) {
    visible =
      visible.filter(
        function(row) {
          return row.name
            .toLowerCase()
            .includes(search);
        }
      );
  }


  visible =
    sortRows(
      visible,
      sortSelect.value
    );


  tableBody.innerHTML = "";


  if (visible.length === 0) {
    emptyState.hidden = false;
    return;
  }


  emptyState.hidden = true;


  visible.forEach(
    function(row) {
      tableBody.appendChild(
        createRow(row)
      );
    }
  );
}


function createRow(row) {
  const tr =
    document.createElement("tr");


  const item =
    document.createElement("td");

  item.className = "item";

  item.textContent =
    row.name;


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
    formatMargin(
      row.margin
    );


  const volume =
    document.createElement("td");

  volume.className =
    "volume";

  volume.textContent =
    formatCompact(
      row.volume
    );


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
      function(a, b) {
        return a.index - b.index;
      }
    );
  }


  if (mode === "name") {
    return rows.sort(
      function(a, b) {
        return a.name.localeCompare(
          b.name
        );
      }
    );
  }


  return rows.sort(
    function(a, b) {
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
  if (value === null) {
    return "—";
  }

  return formatCompact(value);
}


function formatMargin(value) {
  if (value === null) {
    return "—";
  }

  const sign =
    value > 0
      ? "+"
      : "";

  return sign +
    Math.round(
      value
    ).toLocaleString();
}


function formatCompact(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  const absolute =
    Math.abs(number);


  if (absolute < 1000) {
    return Math.round(
      number
    ).toLocaleString();
  }


  if (absolute < 1000000) {
    return Math.round(
      number
    ).toLocaleString();
  }


  if (absolute < 1000000000) {
    return (
      number / 1000000
    )
      .toFixed(3)
      .replace(
        /\.?0+$/,
        ""
      ) +
      "M";
  }


  return (
    number / 1000000000
  )
    .toFixed(3)
    .replace(
      /\.?0+$/,
      ""
    ) +
    "B";
}


// ============================================================
// AGE
// ============================================================

function formatAge(timestamp) {
  if (!timestamp) {
    return "—";
  }

  let seconds =
    Math.floor(
      (
        Date.now() -
        Number(timestamp) *
          1000
      ) / 1000
    );

  seconds =
    Math.max(
      0,
      seconds
    );


  if (seconds < 60) {
    return "just now";
  }


  const minutes =
    Math.floor(
      seconds / 60
    );


  if (minutes < 60) {
    return minutes === 1
      ? "1 min"
      : minutes + " min";
  }


  const hours =
    Math.floor(
      minutes / 60
    );


  if (hours < 24) {
    return hours === 1
      ? "1 hr"
      : hours + " hr";
  }


  const days =
    Math.floor(
      hours / 24
    );


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
    Number(timestamp) *
      1000;


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
// CREATE CUSTOM LIST
// ============================================================

function createNewList() {
  const name =
    prompt(
      "Enter a name for your new list:"
    );


  if (!name) {
    return;
  }


  const trimmed =
    name.trim();


  if (!trimmed) {
    return;
  }


  if (
    getAllLists().some(
      function(list) {
        return list.name
          .toLowerCase() ===
          trimmed.toLowerCase();
      }
    )
  ) {
    alert(
      "A list with that name already exists."
    );

    return;
  }


  const list = {
    id:
      "custom:" +
      Date.now(),

    name:
      trimmed,

    items: [],

    builtin:
      false
  };


  customLists.push(list);

  saveCustomLists();

  currentList =
    list.id;

  createListButtons();
  updateActiveButton();
  renderList();

  addItemsToCurrentList();
}


// ============================================================
// ADD ITEMS
// ============================================================

function addItemsToCurrentList() {
  const list =
    getCurrentList();


  if (
    !list ||
    list.builtin
  ) {
    return;
  }


  const input =
    prompt(
      "Enter item names separated by commas:"
    );


  if (!input) {
    return;
  }


  const names =
    input
      .split(",")
      .map(
        function(name) {
          return name.trim();
        }
      )
      .filter(Boolean);


  let added = 0;


  names.forEach(
    function(name) {
      const item =
        findItem(name);


      if (!item) {
        return;
      }


      const id =
        Number(item.id);


      if (
        !list.items.includes(id)
      ) {
        list.items.push(id);
        added++;
      }
    }
  );


  saveCustomLists();

  renderList();


  alert(
    added +
    " item" +
    (added === 1
      ? ""
      : "s") +
    " added."
  );
}


// ============================================================
// MANAGE LISTS
// ============================================================

function showManageLists() {
  if (customLists.length === 0) {
    alert(
      "You don't have any custom lists yet."
    );

    return;
  }


  const names =
    customLists
      .map(
        function(list, index) {
          return (
            (index + 1) +
            ". " +
            list.name
          );
        }
      )
      .join("\n");


  const choice =
    prompt(
      "Custom Lists:\n\n" +
      names +
      "\n\nEnter the number to manage:"
    );


  if (!choice) {
    return;
  }


  const index =
    Number(choice) - 1;


  if (
    !Number.isInteger(index) ||
    !customLists[index]
  ) {
    return;
  }


  manageList(
    customLists[index]
  );
}


function manageList(list) {
  const action =
    prompt(
      list.name +
      "\n\n" +
      "1 = Rename\n" +
      "2 = Duplicate\n" +
      "3 = Delete\n" +
      "4 = Add Items"
    );


  switch (action) {

    case "1":
      renameList(list);
      break;

    case "2":
      duplicateList(list);
      break;

    case "3":
      deleteList(list);
      break;

    case "4":
      currentList =
        list.id;

      addItemsToCurrentList();
      break;
  }
}


// ============================================================
// RENAME
// ============================================================

function renameList(list) {
  const name =
    prompt(
      "New list name:",
      list.name
    );


  if (!name) {
    return;
  }


  const trimmed =
    name.trim();


  if (!trimmed) {
    return;
  }


  list.name =
    trimmed;


  saveCustomLists();

  createListButtons();

  renderList();
}


// ============================================================
// DUPLICATE
// ============================================================

function duplicateList(list) {
  const copy = {
    id:
      "custom:" +
      Date.now(),

    name:
      list.name +
      " Copy",

    items:
      [...list.items],

    builtin:
      false
  };


  customLists.push(copy);

  saveCustomLists();

  currentList =
    copy.id;

  createListButtons();
  updateActiveButton();
  renderList();
}


// ============================================================
// DELETE
// ============================================================

function deleteList(list) {
  const confirmed =
    confirm(
      'Delete "' +
      list.name +
      '"?'
    );


  if (!confirmed) {
    return;
  }


  customLists =
    customLists.filter(
      function(item) {
        return item.id !==
          list.id;
      }
    );


  saveCustomLists();


  if (
    currentList ===
    list.id
  ) {
    const fallback =
      builtInLists[0] ||
      customLists[0];

    currentList =
      fallback
        ? fallback.id
        : null;
  }


  createListButtons();
  updateActiveButton();
  renderList();
}


// ============================================================
// EXPORT
// ============================================================

function exportLists() {
  const data =
    JSON.stringify(
      customLists,
      null,
      2
    );


  const blob =
    new Blob(
      [data],
      {
        type:
          "application/json"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );

  link.href = url;

  link.download =
    "rs3-custom-lists.json";

  link.click();


  URL.revokeObjectURL(
    url
  );
}


// ============================================================
// IMPORT
// ============================================================

function importLists() {
  const input =
    document.createElement(
      "input"
    );

  input.type =
    "file";

  input.accept =
    ".json,application/json";


  input.addEventListener(
    "change",
    function() {
      const file =
        input.files[0];

      if (!file) {
        return;
      }


      const reader =
        new FileReader();


      reader.onload =
        function() {
          try {
            const imported =
              JSON.parse(
                reader.result
              );


            if (
              !Array.isArray(
                imported
              )
            ) {
              throw new Error(
                "Invalid file."
              );
            }


            imported.forEach(
              function(list) {

                if (
                  !list.name ||
                  !Array.isArray(
                    list.items
                  )
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
                    list.items,

                  builtin:
                    false
                });
              }
            );


            saveCustomLists();

            createListButtons();

            alert(
              "Lists imported successfully."
            );

          } catch (error) {
            alert(
              "Could not import that file."
            );
          }
        };


      reader.readAsText(file);
    }
  );


  input.click();
}


// ============================================================
// SEARCH / SORT
// ============================================================

searchInput.addEventListener(
  "input",
  function() {
    renderTable(
      currentRows
    );
  }
);


sortSelect.addEventListener(
  "change",
  function() {
    renderTable(
      currentRows
    );
  }
);


// ============================================================
// AUTO REFRESH
// ============================================================

setInterval(
  async function() {
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
