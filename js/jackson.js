"use strict";

import { parseFlowNumber, cfsOnly } from "./river.js";

// Use this to avoid CORS issues from the sites below
const CORS_PROXY = "https://corsproxy.io/?url="

// Gathright projected releases
const GATHRIGHT_URL = "https://www.nao-wc.usace.army.mil/nao/projected_Q.html"
const GATHRIGHT_PROXY = CORS_PROXY + GATHRIGHT_URL;

function _format_gathright_date(dateText) {
    const date = new Date(`${dateText.slice(0, 2)} ${dateText.slice(2, 5)} ${dateText.slice(5)}`);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function _format_gathright_schedule(dates, flows) {
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
        text = `${flowList[0]} until ${_format_gathright_date(dateList[dateList.length - 1])}`;
    }
    else {
        // One release per line, e.g. "7/24: 246 cfs"
        text = dateList.map((d, i) => `${_format_gathright_date(d)}: ${cfsOnly(flowList[i])} cfs`).join("\n");
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
                return _format_gathright_schedule(dates, flows);
            }
            return { text: "--", value: undefined };
        }
    );
}

// Lake Moomaw level data
const MOOMAW_JSON_URL = "https://moomaw.lakesonline.com/LevelDataJSON.asp?SiteID=VA006";
const MOOMAW_PROXY = CORS_PROXY + MOOMAW_JSON_URL;

function getMoomawData(url = MOOMAW_PROXY) {
    return fetch(url).then(response => response.json()).then(
        data => {
            if (!Array.isArray(data?.charts) || data.charts.length === 0) {
                return undefined;
            }
            const today = new Date();
            let date_idx = (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(today.getFullYear(), 0, 0)) / 24 / 60 / 60 / 1000 - 1;
            // Find the most recent date that has a height measurement here
            while (date_idx >= 0) {
                let level = data.charts[date_idx]?.[today.getFullYear()];
                if (level != undefined) {
                    return level;
                }
                // If the latest level is none, try the day before
                date_idx--;
            }
            return data.charts[0]?.[today.getFullYear()];
        }
    )
}

export function getJacksonData(site) {
    switch (site.source) {
        case "moomaw":
            return getMoomawData().then(level => {
                if (level == undefined) {
                    return undefined;
                }
                return { level };
            });
        case "gathright":
            return getGathrightData().then(extra => ({ extra }));
        default:
            return Promise.resolve(undefined);
    }
}
