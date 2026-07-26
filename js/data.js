"use strict";

// Gets a URL for other gauge site
export function gaugeUrl(state, siteId, periodDays = 7) {
    return `https://bboudaoud.github.io/USGS-StreamView/gaugeSite.html?state=${state}&site_id=${siteId}&periodDays=${periodDays}`;
}

// Utility method for reading a time series below
function _get_time_series(data, varName) {
    const timeSeries = data?.value?.timeSeries;
    if (!Array.isArray(timeSeries)) {
        return [];
    }
    for (let i = 0; i < timeSeries.length; i++) {
        const ts = timeSeries[i];
        if (ts?.variable?.variableName?.includes(varName)) {
            // Found a match
            return ts.values?.[0]?.value || [];
        }
    }
    return [];
}

function _get_source_info(data, varName) {
    const timeSeries = data?.value?.timeSeries;
    if (!Array.isArray(timeSeries)) {
        return undefined;
    }
    for (let i = 0; i < timeSeries.length; i++) {
        const ts = timeSeries[i];
        if (ts?.variable?.variableName?.includes(varName)) {
            // Found a match
            return ts.sourceInfo;
        }
    }
    return undefined;
}

export function getDataForSite(siteId, periodDays = undefined) {
    let url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060,00065,00010`;
    if (periodDays != undefined) {
        const period = `P${periodDays}D`;
        url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&period=${period}&parameterCd=00060,00065,00010`;

    }
    return fetch(url).then(response => response.json())
        .then(data => {
            const flowVarName = "Streamflow";
            const heightVarName = "Gage height";
            const tempVarName = "Temperature, water";

            let siteName = undefined;
            let siteLoc = undefined;

            const flowValues = _get_time_series(data, flowVarName);
            const flowInfo = _get_source_info(data, flowVarName);
            if (flowInfo != undefined) {
                siteName = flowInfo.siteName;
                siteLoc = [flowInfo.geoLocation.geogLocation.latitude, flowInfo.geoLocation.geogLocation.longitude];
            }

            const heightValues = _get_time_series(data, heightVarName);
            const heightInfo = _get_source_info(data, heightVarName);
            if (heightInfo != undefined) {
                siteName = heightInfo.siteName;
                siteLoc = [heightInfo.geoLocation.geogLocation.latitude, heightInfo.geoLocation.geogLocation.longitude];
            }

            const tempValues = _get_time_series(data, tempVarName);
            const tempInfo = _get_source_info(data, tempVarName);
            if (tempInfo != undefined) {
                siteName = tempInfo.siteName;
                siteLoc = [tempInfo.geoLocation.geogLocation.latitude, tempInfo.geoLocation.geogLocation.longitude];
            }

            return [siteName, siteLoc, flowValues, heightValues, tempValues];

        })
        .catch(error => {
            console.error('Error fetching data:', error);
            return [undefined, undefined, [], [], []];
        });
}

export function getLatestValues(siteId) {
    // Return a spot result
    return getDataForSite(siteId).then(data => {
        if (data == undefined) {
            return [undefined, undefined, undefined];
        }
        // eslint-disable-next-line no-unused-vars
        const [_siteName, _siteLoc, flowValues, heightValues, tempValues] = data;
        var [flow, height, temp] = [undefined, undefined, undefined];

        if (flowValues.length > 0) {
            flow = flowValues[flowValues.length - 1].value;
            flow = Math.round(flow * 10) / 10;
        }
        if (heightValues.length > 0) {
            height = heightValues[heightValues.length - 1].value;
            height = Math.round(height * 100) / 100;
        }
        if (tempValues.length > 0) {
            temp = tempValues[tempValues.length - 1].value * 9 / 5 + 32;
            temp = Math.round(temp * 100) / 100;
        }
        return [flow, height, temp];
    });
}

// Use this to avoid CORS issues from the sites below
const CORS_PROXY = "https://corsproxy.io/?url="

// Gathright web page
export const GATHRIGHT_URL = "https://www.nao-wc.usace.army.mil/nao/projected_Q.html"
// This is requred to get data from the source above
const GATHRIGHT_PROXY = CORS_PROXY + GATHRIGHT_URL;
function _gathright_flow_number(flowText) {
    // "246 cfs", "200-300 cfs", "1,200 cfs"
    const cleaned = flowText.replace(/,/g, "").trim();
    const range = cleaned.split(/\s+/)[0].split("-");
    if (range.length === 1) {
        return parseFloat(range[0]);
    }
    if (range.length === 2) {
        return (parseFloat(range[0]) + parseFloat(range[1])) / 2;
    }
    return undefined;
}

function _gathright_cfs_only(flowText) {
    // Keep CFS values only (drop "cfs" / "feet" units from cell text)
    return flowText.replace(/,/g, "").replace(/\s*cfs\s*/i, "").trim();
}

function _format_gathright_date(dateText) {
    const date = new Date(`${dateText.slice(0, 2)} ${dateText.slice(2, 5)} ${dateText.slice(5)}`);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function _format_gathright_schedule(dates, flows) {
    if (dates.length === 0 || flows.length === 0) {
        return { text: "--", flow: undefined };
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
        text = dateList.map((d, i) => `${_format_gathright_date(d)}: ${_gathright_cfs_only(flowList[i])} cfs`).join("\n");
    }
    // Color from tomorrow when available, else first cell
    const colorIdx = n > 1 ? 1 : 0;
    return { text, flow: _gathright_flow_number(flowList[colorIdx]) };
}

export function getGathrightData(url = GATHRIGHT_PROXY) {
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
            return { text: "--", flow: undefined };
        }
    );
}

function _date_idx(date) {
    return (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 24 / 60 / 60 / 1000 - 1;
}

// This is the user visitable site
export const MOOMAW_URL = "https://moomaw.lakesonline.com/Level/";
// This gets raw JSON/works around CORS
const MOOMAW_JSON_URL = "https://moomaw.lakesonline.com/LevelDataJSON.asp?SiteID=VA006";
const MOOMAW_PROXY = CORS_PROXY + MOOMAW_JSON_URL;
export function getMoomawData(url = MOOMAW_PROXY) {
    return fetch(url).then(response => response.json()).then(
        data => {
            if (!Array.isArray(data?.charts) || data.charts.length === 0) {
                return undefined;
            }
            const today = new Date();
            let date_idx = _date_idx(today);
            // Find the most recent date that has a height measurement here
            while (date_idx >= 0) {
                let latestFlow = data.charts[date_idx]?.[today.getFullYear()];
                if (latestFlow != undefined) {
                    return latestFlow;
                }
                // If the latest flow is none, try the day before
                date_idx--;
            }
            return data.charts[0]?.[today.getFullYear()];
        }
    )
}