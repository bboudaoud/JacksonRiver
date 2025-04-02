"use strict";

// Utility method for reading a time series below
function _get_time_series(data, varName) {
    const timeSeries = data.value.timeSeries;
    for (let i = 0; i < timeSeries.length; i++) {
        const ts = timeSeries[i];
        if (ts.variable.variableName.includes(varName)) {
            // Found a match
            return ts.values[0].value;
        }
    }
    return [];
}

function _get_source_info(data, varName) {
    for (let i = 0; i < data.value.timeSeries.length; i++) {
        const ts = data.value.timeSeries[i];
        if (ts.variable.variableName.includes(varName)) {
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
        .catch(error => console.error('Error fetching data:', error));
}

export function getLatestValues(siteId) {
    // Return a spot result
    return getDataForSite(siteId).then(data => {
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
const GATHRIGHT_URL = CORS_PROXY + "https://www.nao-wc.usace.army.mil/nao/projected_Q.html";
export function getGathrightData(url = GATHRIGHT_URL) {
    return fetch(url).then(response => response.text()).then(
        text => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/html");
            const flowRow = doc.body.children[1].children[3].children[0].children[0].children[1].children[6].children[0].children[1];
            const todayFlow = flowRow.children[1].textContent;
            const tomorrowFlow = flowRow.children[2].textContent;
            return tomorrowFlow;
        }
    );
}

function _date_idx(date) {
    return (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 24 / 60 / 60 / 1000 - 1;
}

const MOOMAW_URL = CORS_PROXY + "https://moomaw.lakesonline.com/LevelDataJSON.asp?SiteID=VA006";
export function getMoomawData(url = MOOMAW_URL) {
    return fetch(url).then(response => response.json()).then(
        data => {
            const today = new Date();
            let date_idx = _date_idx(today);
            // Find the most recent date that has a height measurement here
            while (date_idx >= 0) {
                let latestFlow = data.charts[date_idx][today.getFullYear()];
                if (latestFlow != undefined) {
                    return latestFlow;
                }
                // If the latest flow is none, try the day before
                date_idx--;
            }
            return data.charts[0][today.getFullYear()];
        }
    )
}