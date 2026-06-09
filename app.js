const LIMITS = {
  veryWet: 2,
  ideal: 8,
  attention: 10,
  avoid: 12,
};

const RECOMMENDATIONS = {
  "MUITO ÚMIDO": "Atenção para orvalho, neblina e inversão térmica antes de aplicar.",
  IDEAL: "Condição favorável para aplicação, mantendo controle de vento, gota, altura e faixa.",
  ATENÇÃO: "Aplicar com cautela técnica: gota maior, ajuste de volume e monitoramento contínuo.",
  EVITAR: "Evitar aplicação, principalmente aérea; alto risco de perda por evaporação e deriva.",
  CRÍTICO: "Condição crítica: não recomendado aplicar.",
};

const STORAGE_KEY = "delta-t-mobile-history-v1";

const form = document.querySelector("#calculatorForm");
const temperature = document.querySelector("#temperature");
const temperatureNumber = document.querySelector("#temperatureNumber");
const humidity = document.querySelector("#humidity");
const humidityNumber = document.querySelector("#humidityNumber");
const wind = document.querySelector("#wind");
const field = document.querySelector("#field");
const team = document.querySelector("#team");
const deltaValue = document.querySelector("#deltaValue");
const wetBulbValue = document.querySelector("#wetBulbValue");
const statusPill = document.querySelector("#statusPill");
const recommendation = document.querySelector("#recommendation");
const scaleMarker = document.querySelector("#scaleMarker");
const timestamp = document.querySelector("#timestamp");
const saveButton = document.querySelector("#saveButton");
const shareButton = document.querySelector("#shareButton");
const csvButton = document.querySelector("#csvButton");
const clearButton = document.querySelector("#clearButton");
const historyList = document.querySelector("#historyList");
const historyCount = document.querySelector("#historyCount");
const template = document.querySelector("#historyItemTemplate");
const installButton = document.querySelector("#installButton");

let deferredInstallPrompt = null;
let currentResult = null;

function parseDecimal(value) {
  if (typeof value !== "string") {
    return Number(value);
  }
  return Number(value.trim().replace(",", "."));
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function calculateWetBulb(airTemperature, relativeHumidity) {
  const t = airTemperature;
  const ur = relativeHumidity;
  const wetBulb =
    t * Math.atan(0.151977 * Math.sqrt(ur + 8.313659)) +
    Math.atan(t + ur) -
    Math.atan(ur - 1.676331) +
    0.00391838 * ur ** 1.5 * Math.atan(0.023101 * ur) -
    4.686035;

  return roundOne(wetBulb);
}

function classifyDelta(deltaT) {
  if (deltaT < LIMITS.veryWet) return "MUITO ÚMIDO";
  if (deltaT <= LIMITS.ideal) return "IDEAL";
  if (deltaT <= LIMITS.attention) return "ATENÇÃO";
  if (deltaT <= LIMITS.avoid) return "EVITAR";
  return "CRÍTICO";
}

function statusClass(status) {
  return status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function setHistory(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 80)));
}

function buildResult() {
  const airTemperature = parseDecimal(temperatureNumber.value);
  const relativeHumidity = parseDecimal(humidityNumber.value);
  const windSpeed = parseDecimal(wind.value);

  if (
    !Number.isFinite(airTemperature) ||
    !Number.isFinite(relativeHumidity) ||
    airTemperature < -20 ||
    airTemperature > 60 ||
    relativeHumidity < 1 ||
    relativeHumidity > 100
  ) {
    return null;
  }

  const wetBulb = calculateWetBulb(airTemperature, relativeHumidity);
  const deltaT = roundOne(airTemperature - wetBulb);
  const status = classifyDelta(deltaT);

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    field: field.value.trim(),
    team: team.value.trim(),
    airTemperature,
    relativeHumidity,
    windSpeed: Number.isFinite(windSpeed) ? windSpeed : null,
    wetBulb,
    deltaT,
    status,
    recommendation: RECOMMENDATIONS[status],
  };
}

function renderResult() {
  currentResult = buildResult();

  if (!currentResult) {
    deltaValue.textContent = "--";
    wetBulbValue.textContent = "--";
    statusPill.textContent = "ENTRADA";
    statusPill.className = "status-pill evitar";
    recommendation.textContent = "Confira temperatura e umidade.";
    scaleMarker.style.left = "0%";
    return;
  }

  deltaValue.textContent = formatNumber(currentResult.deltaT);
  wetBulbValue.textContent = formatNumber(currentResult.wetBulb);
  statusPill.textContent = currentResult.status;
  statusPill.className = `status-pill ${statusClass(currentResult.status)}`;
  recommendation.textContent = currentResult.recommendation;
  timestamp.textContent = new Date(currentResult.createdAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const markerPercent = clamp((Math.max(currentResult.deltaT, 0) / 14) * 100, 0, 100);
  scaleMarker.style.left = `calc(${markerPercent}% - 4px)`;
}

function renderHistory() {
  const records = getHistory();
  historyList.replaceChildren();
  historyCount.textContent = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;

  for (const record of records.slice(0, 8)) {
    const item = template.content.firstElementChild.cloneNode(true);
    item.querySelector('[data-field="status"]').textContent = record.status;
    item.querySelector('[data-field="date"]').textContent = new Date(record.createdAt).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    item.querySelector('[data-field="delta"]').textContent = `${formatNumber(record.deltaT)} °C`;
    item.querySelector('[data-field="weather"]').textContent =
      `${formatNumber(record.airTemperature)} °C · ${formatNumber(record.relativeHumidity)}%`;
    item.querySelector('[data-field="place"]').textContent =
      [record.field, record.team].filter(Boolean).join(" · ") || "Sem local/equipe";
    historyList.append(item);
  }
}

function syncPair(rangeInput, numberInput, source) {
  const min = Number(rangeInput.min);
  const max = Number(rangeInput.max);
  const value = clamp(parseDecimal(source.value), min, max);

  if (!Number.isFinite(value)) {
    return;
  }

  rangeInput.value = String(value);
  numberInput.value = String(value);
  renderResult();
}

function flashSaveButton(text) {
  const original = saveButton.innerHTML;
  saveButton.innerHTML = `<span aria-hidden="true">✓</span>${text}`;
  setTimeout(() => {
    saveButton.innerHTML = original;
  }, 1100);
}

function saveCurrentRecord() {
  if (!currentResult) {
    return;
  }

  const records = getHistory();
  setHistory([currentResult, ...records]);
  renderHistory();
  flashSaveButton("Salvo");
}

function escapeCsv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(records) {
  const header = [
    "Data/hora",
    "Local/Talhao",
    "Piloto/Equipe",
    "Temperatura do ar (C)",
    "Umidade relativa (%)",
    "Vento (km/h)",
    "Bulbo umido (C)",
    "Delta T (C)",
    "Status",
    "Recomendacao",
  ];

  const rows = records.map((record) => [
    new Date(record.createdAt).toLocaleString("pt-BR"),
    record.field,
    record.team,
    formatNumber(record.airTemperature),
    formatNumber(record.relativeHumidity),
    record.windSpeed === null ? "" : formatNumber(record.windSpeed),
    formatNumber(record.wetBulb),
    formatNumber(record.deltaT),
    record.status,
    record.recommendation,
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\n");
}

function downloadCsv() {
  const records = getHistory();
  const csv = "\uFEFF" + buildCsv(records.length ? records : [currentResult].filter(Boolean));
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `registro_delta_t_${date}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function shareCurrentResult() {
  if (!currentResult) {
    return;
  }

  const text = [
    `Delta T: ${formatNumber(currentResult.deltaT)} °C`,
    `Bulbo úmido: ${formatNumber(currentResult.wetBulb)} °C`,
    `Status: ${currentResult.status}`,
    currentResult.recommendation,
  ].join("\n");

  if (navigator.share) {
    await navigator.share({
      title: "Resultado Delta T",
      text,
    });
    return;
  }

  await navigator.clipboard.writeText(text);
}

function clearHistory() {
  if (!getHistory().length) {
    return;
  }

  const confirmed = confirm("Limpar histórico salvo neste aparelho?");
  if (!confirmed) {
    return;
  }

  setHistory([]);
  renderHistory();
}

temperature.addEventListener("input", (event) => syncPair(temperature, temperatureNumber, event.target));
temperatureNumber.addEventListener("input", (event) => syncPair(temperature, temperatureNumber, event.target));
humidity.addEventListener("input", (event) => syncPair(humidity, humidityNumber, event.target));
humidityNumber.addEventListener("input", (event) => syncPair(humidity, humidityNumber, event.target));
form.addEventListener("input", renderResult);
saveButton.addEventListener("click", saveCurrentRecord);
csvButton.addEventListener("click", downloadCsv);
shareButton.addEventListener("click", shareCurrentResult);
clearButton.addEventListener("click", clearHistory);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.classList.remove("hidden");
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.classList.add("hidden");
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}

renderResult();
renderHistory();
