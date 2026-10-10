"use strict";

import { parseFlowNumber, cfsOnly } from "https://bboudaoud.github.io/RiverDashboard/js/river.js";

// Use this to avoid CORS issues from the Gathright release page
const CORS_PROXY = "https://proxy.cors.sh/";

// Gathright projected releases
const GATHRIGHT_URL = "https://www.nao-wc.usace.army.mil/nao/projected_Q.html";
const GATHRIGHT_PROXY = CORS_PROXY + GATHRIGHT_URL;

function formatGathrightDate(dateText) {
    const date = new Date(`${dateText.slice(0, 2)} ${dateText.slice(2, 5)} ${dateText.slice(5)}`);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatGathrightSchedule(dates, flows) {
    if (dates.length === 0 || flows.length === 0) {
        return { text: "--", value: undefined };
    }
    const n = Math.min(dates.length, flows.length);
    const dateList = dates.slice(0, n);
    const flowList = flows.slice(0, n);
    const allAgree = flowList.every(f => f === flowList[0]);
    let text;
    if (allAgree) {
        // e.g. "246 cfs until 7/27"
        text = `${flowList[0]} until ${formatGathrightDate(dateList[dateList.length - 1])}`;
    }
    else {
        // One release per line, e.g. "7/24: 246 cfs"
        text = dateList.map((d, i) => `${formatGathrightDate(d)}: ${cfsOnly(flowList[i])} cfs`).join("\n");
    }
    // Color from tomorrow when available, else first cell
    const colorIdx = n > 1 ? 1 : 0;
    return { text, value: parseFlowNumber(flowList[colorIdx]) };
}

function getGathrightData(url = GATHRIGHT_PROXY) {
    return fetch(url).then(response => response.text()).then(
        text => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/html");
            const tables = doc.querySelectorAll("table");
            for (let t = 0; t < tables.length; t++) {
                const rows = tables[t].querySelectorAll("tr");
                if (rows.length < 2) {
                    continue;
                }
                let releaseRow = undefined;
                for (let r = 0; r < rows.length; r++) {
                    const label = (rows[r].cells[0] && rows[r].cells[0].textContent || "").trim().toLowerCase();
                    if (label.startsWith("release")) {
                        releaseRow = rows[r];
                        break;
                    }
                }
                if (releaseRow == undefined || releaseRow === rows[0]) {
                    // Need a dated header row above the Release values (skip reference tables)
                    continue;
                }
                // Date headers are in the first row (skip blank corner cell)
                const headerCells = rows[0].querySelectorAll("th, td");
                const dates = [];
                for (let i = 1; i < headerCells.length; i++) {
                    // "24Jul2026\nat 0700 hours" -> "24Jul2026"
                    const dateLabel = headerCells[i].textContent.trim().split(/\s+/)[0];
                    if (/^\d{1,2}[A-Za-z]{3}\d{4}$/.test(dateLabel)) {
                        dates.push(dateLabel);
                    }
                }
                if (dates.length === 0) {
                    continue;
                }
                const flowCells = releaseRow.querySelectorAll("td, th");
                const flows = [];
                for (let i = 1; i < flowCells.length; i++) {
                    const flowText = flowCells[i].textContent.trim();
                    if (flowText) {
                        flows.push(flowText);
                    }
                }
                return formatGathrightSchedule(dates, flows);
            }
            return { text: "--", value: undefined };
        }
    );
}

// Lake Moomaw level data
const MOOMAW_API_URL = "https://cwms-data.usace.army.mil/cwms-data/timeseries?office=NAO";
const MOOMAW_LEVEL_URL = `${MOOMAW_API_URL}&name=Moomaw.Elev.Inst.30Minutes.0.Rev-DCP&unit=ft`;
const MOOMAW_STORAGE_URL = `${MOOMAW_API_URL}&name=Moomaw.Stor.Inst.30Minutes.0.Rev-DCP&unit=ac-ft`;

function getLatestValue(data) {
    if (!Array.isArray(data?.values)) {
        return undefined;
    }
    for (let i = data.values.length - 1; i >= 0; i--) {
        const value = data.values[i]?.[1];
        if (Number.isFinite(value)) {
            return value;
        }
    }
    return undefined;
}

function getMoomawData() {
    const begin = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const options = {
        headers: { Accept: "application/json;version=2" }
    };
    return Promise.all([
        fetch(`${MOOMAW_LEVEL_URL}&begin=${encodeURIComponent(begin)}`, options).then(response => response.json()),
        fetch(`${MOOMAW_STORAGE_URL}&begin=${encodeURIComponent(begin)}`, options).then(response => response.json())
    ]).then(
        ([levelData, storageData]) => {
            const level = getLatestValue(levelData);
            return {
                level: Number.isFinite(level) ? Math.round(level * 100) / 100 : undefined,
                storage: getLatestValue(storageData)
            };
        }
    );
}

function updateMoomawPercentage(site, storage) {
    const fullStorage = site.pool?.fullStorageAcFt;
    if (!Number.isFinite(storage) || !Number.isFinite(fullStorage)) {
        return;
    }
    const percentage = storage / fullStorage * 100;
    requestAnimationFrame(() => {
        const fillPercentage = document.getElementById(`${site.name.replaceAll(" ", "_")}_fillPct`);
        if (fillPercentage == undefined) {
            return;
        }
        fillPercentage.textContent = `${Math.max(0, percentage).toFixed(0)}%`;
        fillPercentage.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    });
}

export function getJacksonData(site) {
    switch (site.source) {
        case "moomaw":
            return getMoomawData().then(data => {
                if (data.level == undefined) {
                    return undefined;
                }
                updateMoomawPercentage(site, data.storage);
                return { level: data.level };
            });
        case "gathright":
            return getGathrightData().then(extra => ({ extra }));
        default:
            return Promise.resolve(undefined);
    }
}
