"use strict";

import * as Data from './data.js';

// Doc elements
const siteBar = document.getElementById("siteBar");

// Sites used for USGS data
const SITE_ID_LOOKUP = {
    "At Bacova": "02011400",
    "Lake Moomaw": undefined,
    "Below Gathright Dam": "02011800",
    "At Falling Spring": "02012500",
    "At Water Filtration Plant": "02012800",
    "Above Dunlap Creek": undefined,
    "Dunlap Creek": "02013000",
    "At Rose Dale": "02013100",
};

const FLOW_THRESH = {
    "At Bacova": [100, 300, 500, 800],
    "Below Gathright Dam": [200, 800, 1000, 3000],
    "Above Dunlap Creek": [200, 800, 1000, 3000],
    "Dunlap Creek": [50, 300, 500, 1000],
    "At Rose Dale": [200, 600, 1000, 3000],
};
const HEIGHT_THRESH = {
    "At Falling Spring": [4, 7, 9, 10],
};
const FLOW_COLORS = ["darkred", "green", "darkorange", "red", "magenta"]

const MOOMAW_FULL_POOL = 1582.0;
const MOOMAW_HIGH_LEVEL = 1587.0;
const MOOMAW_LOW_LEVEL = 1572.0;
const MOOMAW_FLOOD_POOL = 1610.0;

const COLD_TEMP = 40;
const MID_TEMP = 60;
const WARM_TEMP = 65;
const HOT_TEMP = 70;

// Populate site list
for (const siteName in SITE_ID_LOOKUP) {
    const htmlName = siteName.replaceAll(" ", "_");
    let li = document.createElement("li");
    let siteDiv = document.createElement("div");
    siteDiv.id = `${htmlName}_div`;
    siteDiv.className = "siteDiv";
    // This indicates this is a simulated gauge, only do flow
    let siteUrl = undefined
    const siteId = SITE_ID_LOOKUP[siteName]
    if (siteId != undefined) {
        siteUrl = Data.gaugeUrl("VA", siteId)
    }
    if (siteName == "Below Gathright Dam") {
        // Override the site here w/ army corps page
        siteUrl = Data.GATHRIGHT_URL;
    }

    // Create header w/ or w/o link
    if (siteUrl != undefined) {
        siteDiv.innerHTML = `<h2 class="siteLabel"><a href=${siteUrl} target="_blank">${siteName}</a></h2>
        <p class="siteData" id=${htmlName}_flow>-- cfs</p>`
    }
    else {
        siteDiv.innerHTML = `<h2 class="siteLabel">${siteName}</h2>
        <p class="siteData" id=${htmlName}_flow>-- cfs</p>`
    }
    
    // Custom tweaking for certain sites
    if (!(siteName.includes("Above Dunlap"))) {
        // Everything but Above Dunlap gets all fields (for now)
        siteDiv.innerHTML += `<p class="siteData" id=${htmlName}_height>-- ft</p>
        <p class="siteData" id=${htmlName}_temp>-- °F</p>`;
    }
    if (siteName.includes("Gathright")) {
        // This gets a special field
        siteDiv.innerHTML += '<br><p class="siteData" id=Gathright_Dam_tmrwFlow style="color:gray">-- cfs tomorrow</p>'
    }

    // Special override for Moomaw here
    if (siteName.includes("Moomaw")) {
        siteDiv.innerHTML = `<h2 class="siteLabel"><a href=${Data.MOOMAW_URL} target="_blank">${siteName}</a></h2><p class="siteData" id="moomawLevel" style="color:gray">-- ft</p>`
    }

    // Add this element to the document
    li.appendChild(siteDiv);
    siteBar.appendChild(li);
}

function getMoomawColor(level) {
    if (level == undefined) {
        return "gray";
    }
    else if (level < MOOMAW_LOW_LEVEL) {
        return "red";
    }
    else if (level < MOOMAW_FULL_POOL) {
        return "darkorange";
    }
    else if (level < MOOMAW_HIGH_LEVEL) {
        return "green";
    }
    else if (level < MOOMAW_FLOOD_POOL) {
        // Lake is above high level
        return "darkgreen";
    }
    else {
        // Lake is above flood pool
        return "darkred";
    }
}

function getFlowHeightColor(siteName, flow, height) {
    if (siteName in FLOW_THRESH && flow != undefined) {
        const thresh = FLOW_THRESH[siteName];
        for (let i = 0; i < thresh.length; i++) {
            if (flow < thresh[i]) {
                return FLOW_COLORS[i];
            }
        }
        return FLOW_COLORS[FLOW_COLORS.length - 1];
    }
    else if (siteName in HEIGHT_THRESH && height != undefined) {
        const thresh = HEIGHT_THRESH[siteName];
        for (let i = 0; i < thresh.length; i++) {
            if (height < thresh[i]) {
                return FLOW_COLORS[i];
            }
        }
    }
}

function getTempColor(temp) {
    if (temp == undefined) {
        return "gray";
    }
    else if (temp < COLD_TEMP) {
        return "blue";
    }
    else if (temp < MID_TEMP) {
        return "green";
    }
    else if (temp < WARM_TEMP) {
        return "darkorange";
    }
    else if (temp < HOT_TEMP) {
        return "red";
    }
    else {
        return "darkred";
    }
}

function update() {
    var dunlap = [undefined, undefined, undefined];
    var roseDale = [undefined, undefined, undefined];
    for (const siteName in SITE_ID_LOOKUP) {
        const htmlName = siteName.replaceAll(" ", "_");
        const siteHeading = document.getElementById(`${htmlName}_div`).getElementsByClassName("siteLabel")[0];
        const siteLi = siteHeading.parentElement.parentElement;
        const siteId = SITE_ID_LOOKUP[siteName];
        if (siteId == undefined) {
            // Skip this for now (no site id)
            continue;
        }
        Data.getLatestValues(SITE_ID_LOOKUP[siteName]).then(
            data => {
                // Unpack values
                const [flow, height, temp] = data;

                const flowField = document.getElementById(`${htmlName}_flow`);
                const heightField = document.getElementById(`${htmlName}_height`);
                const tempField = document.getElementById(`${htmlName}_temp`);

                // Update these fields
                let noData = true;
                if (flow != undefined) {
                    flowField.textContent = `${flow} cfs`;
                    flowField.style.display = "inline";
                    noData = false;
                }
                else {
                    flowField.style.display = "none";
                }

                if (height != undefined) {
                    heightField.textContent = `${height} ft`;
                    heightField.style.display = "inline";
                    noData = false;
                }
                else {
                    heightField.style.display = "none";
                }

                // Color these two together
                let setSiteHeading = false;
                if (flow != undefined || height != undefined) {
                    const c = getFlowHeightColor(siteName, flow, height);
                    siteLi.style = `--color: ${c}`;
                    for (let i = 0; i < siteLi.children.length; i++) {
                        siteLi.children[i].style.color = c;
                    }
                    setSiteHeading = true;
                }

                if (temp != undefined) {
                    tempField.textContent = `${temp} °F`;
                    tempField.style.display = "inline";
                    const c = getTempColor(temp);
                    noData = false;
                    if (!setSiteHeading) {
                        siteLi.style = `--color: ${c}`;
                        for (let i = 0; i < siteLi.children.length; i++) {
                            siteLi.children[i].style.color = c;
                        }
                        setSiteHeading = true;
                    }
                    tempField.style.color = c;
                }
                else {
                    tempField.style.display = "none";
                }

                // Hide the entire item if it has no data
                const siteDiv = document.getElementById(`${siteName.replaceAll(" ", "_")}_div`);
                siteDiv.style.display = noData ? "none" : "block";

                // Check for dam (special case)
                if (siteName.includes("Gathright")) {
                    Data.getGathrightData().then(tomorrowFlow => {
                        const tmrwFlow = document.getElementById("Gathright_Dam_tmrwFlow")
                        tmrwFlow.textContent = `${tomorrowFlow} tomorrow`;
                    });
                }

                // Stash these for later
                else if (siteName.includes("Dunlap Creek")) {
                    dunlap = data.slice();
                }
                else if (siteName.includes("Rose Dale")) {
                    roseDale = data.slice();
                }

                return [dunlap, roseDale]
            }
        ).then(data => {
            // Process fake "Above Dunlap" gauge, separate pass after data is fetched
            const [dunlap, roseDale] = data;
            const aboveDunlapFlow = document.getElementById("Above_Dunlap_Creek_flow");
            const aboveDunalpLi = aboveDunlapFlow.parentElement.parentElement;
            if (dunlap[0] != undefined && roseDale[0] != undefined) {
                const flow = roseDale[0] - dunlap[0];
                aboveDunlapFlow.textContent = `${flow} cfs`;
                aboveDunlapFlow.style.display = "inline";
                const c = getFlowHeightColor("Above Dunlap Creek", flow);
                aboveDunalpLi.style = `--color: ${c}`;
                for (let i = 0; i < siteLi.children.length; i++) {
                    aboveDunalpLi.children[i].style.color = c;
                }
            }
            else {
                aboveDunlapFlow.style.display = "none";
            }
        });
    }

    // Check for moomaw (special case)
    Data.getMoomawData().then(level => {
        const moomawDiv = document.getElementById("Lake_Moomaw_div");
        const moomawLi = moomawDiv.parentElement;
        const moomawLevel = document.getElementById("moomawLevel");
        moomawLevel.textContent = `${level} ft`
        const diff = 100 * Math.round((level - MOOMAW_FULL_POOL) / 100);
        if (diff > 0) {
            moomawLevel.textContent += ` (${diff} ft above full pool)`;
        }
        else if (diff < 0) {
            moomawLevel.textContent += ` (${diff} ft below full pool)`;
        }
        else {
            moomawLevel.textContent += " (@ full pool)";
        }
        const c = getMoomawColor(level);
        moomawLi.style = `--color: ${c}`;
        moomawLevel.style.color = c;
        moomawDiv.style.color = c;
    });
}

update();