const API_BASE =
  "https://prices.runescape.wiki/api/v2/rs";

const API = {
  mapping: API_BASE + "/mapping",
  latest: API_BASE + "/latest"
};

const LIST_INDEX =
  "lists/index.json";


// ============================================================
// STATE
// ============================================================

let mapping = [];
let prices = {};

let lists = [];
let loadedLists = {};

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

    await loadLists();

    await loadData();

    createListButtons();

    if (lists.length > 0) {
      currentList = lists[0].name;
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
// LOAD LIST INDEX
// ============================================================

async function loadLists() {
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
      "lists/index.json does not contain a valid lists array."
    );
  }

  lists = [];

  for (const filename of index.lists) {
    const list = await loadList(filename);

    if (list) {
      lists.push(list);
    }
  }
}


// ============================================================
// LOAD INDIVIDUAL LIST
// ============================================================

async function loadList(filename) {
  const response =
    await fetch(
      "lists/" +
      filename +
      "?t=" +
      Date.now()
    );

  if (!response.ok) {
    console.warn(
      "Could not load list:",
      filename
    );

    return null;
  }

  const list =
    await response.json();

  if (
    !list.name ||
    !Array.isArray(list.items)
  ) {
    console.warn(
      "Invalid list:",
      filename
    );

    return null;
  }

  loadedLists[filename] = list;

  return {
    filename: filename,
    name: list.name,
    items: list.items
  };
}


// ============================================================
// LOAD RS3 API DATA
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
// CREATE SIDEBAR
// ============================================================

function createListButtons() {
  listButtons.innerHTML = "";

  lists.forEach(function(list) {
    const button =
      document.createElement("button");

    button.className =
      "list-button";

    button.textContent =
      list.name;

    button.dataset.list =
      list.name;

    button.addEventListener(
      "click",
      function() {
        currentList =
          list.name;

        searchInput.value = "";
        sortSelect.value = "default";

        updateActiveButton();
        renderList();
      }
    );

    listButtons.appendChild(
      button
    );
  });
}


// ============================================================
// ACTIVE SIDEBAR BUTTON
// ============================================================

function updateActiveButton() {
  document
    .querySelectorAll(".list-button")
    .forEach(function(button) {
      button.classList.toggle(
        "active",
        button.dataset.list ===
          currentList
      );
    });
}


// ============================================================
// GET CURRENT LIST
// ============================================================

function getCurrentList() {
  return lists.find(
    function(list) {
      return list.name ===
        currentList;
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
    function(itemName, index) {

      const item =
        findItem(itemName);


      if (!item) {
        return {
          name: itemName,
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


      const price =
        prices[item.id];


      if (!price) {
        return {
          name: item.name,
          id: item.id,
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
        name: item.name,
        id: item.id,

        buy: buy,
        sell: sell,

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

        index: index
      };
    }
  );
}


// ============================================================
// FIND ITEM ID FROM NAME
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
        .toLowerCase() === wanted;
    }
  );
}


// ============================================================
// RENDER LIST
// ============================================================

function renderList() {
  currentRows =
    buildRows();

  listTitle.textContent =
    currentList;


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
// RENDER TABLE
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


// ============================================================
// CREATE TABLE ROW
// ============================================================

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
// PRICE FORMATTING
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

  const sign = value > 0 ? "+" : "";

  return sign +
    Math.round(value).toLocaleString();
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

  const absolute = Math.abs(number);

  // Under 1K: show the exact price.
  if (absolute < 1000) {
    return Math.round(number).toLocaleString();
  }

  // 1K - 999K: show the exact price.
  if (absolute < 1000000) {
    return Math.round(number).toLocaleString();
  }

  // 1M - 999M: show 3 significant digits.
  if (absolute < 1000000000) {
    return (
      (number / 1000000)
        .toFixed(3)
        .replace(/\.?0+$/, "")
      + "M"
    );
  }

  // 1B+: show 3 significant digits.
  return (
    (number / 1000000000)
      .toFixed(3)
      .replace(/\.?0+$/, "")
    + "B"
  );
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
        Number(timestamp) * 1000
      ) / 1000
    );


  seconds =
    Math.max(0, seconds);


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
