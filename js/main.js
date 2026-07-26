"use strict";

import * as Data from './data.js';

// Doc elements
const siteBar = document.getElementById("siteBar");

// Sites structure with forking logic
const RIVER_STRUCTURE = [
    // Fork before Moomaw
    {
        type: "fork",
        branches: [
            { name: "Back Creek", siteId: "02011460" },
            { name: "Bacova", siteId: "02011400" },
        ]
    },
    // Lake (special bucket styling)
    { name: "Lake Moomaw", siteId: undefined, type: "lake" },
    { name: "Gathright Dam", siteId: "02011800" },
    { name: "Falling Spring", siteId: "02012500" },
    { name: "Filtration Plant", siteId: "02012800" },
    { name: "Above Dunlap", siteId: undefined },
    // Inflow junction at Dunlap
    {
        type: "inflow",
        tributary: { name: "Dunlap Creek", siteId: "02013000" }
    },
    { name: "Rose Dale", siteId: "02013100" },
    {
        type: "inflow",
        tributary: { name: "Potts Creek", siteId: "02014000" }
    },
    { name: "Upper James", siteId: "02016500", type: "terminal" },
];

const FLOW_THRESH = {
    "Bacova": [100, 300, 500, 800],
    "Back Creek": [50, 200, 400, 600],
    "Gathright Dam": [200, 800, 1000, 3000],
    "Above Dunlap": [200, 800, 1000, 3000],
    "Dunlap Creek": [50, 200, 500, 1000],
    "Rose Dale": [200, 600, 1000, 3000],
    "Potts Creek": [50, 200, 500, 1000],
    "Upper James": [500, 1500, 2000, 3000],
};
const HEIGHT_THRESH = {
    "Falling Spring": [4, 7, 9, 10],
};
const FLOW_COLORS = ["darkred", "green", "darkorange", "red", "magenta"]

const MOOMAW_FULL_POOL = 1582.0;
const MOOMAW_HIGH_LEVEL = 1587.0;
const MOOMAW_LOW_LEVEL = 1572.0;
const MOOMAW_FLOOD_POOL = 1610.0;
const MOOMAW_FULL_STORAGE = 123700; // ac-ft at full pool
const MOOMAW_SURFACE_ACRES = 2530;

const COLD_TEMP = 40;
const MID_TEMP = 60;
const WARM_TEMP = 65;
const HOT_TEMP = 70;

// Function to create a site element
function createSiteElement(siteName, siteId) {
    const htmlName = siteName.replaceAll(" ", "_");
    let siteDiv = document.createElement("div");
    siteDiv.id = `${htmlName}_div`;
    siteDiv.className = "siteDiv";
    
    let siteUrl = undefined;
    if (siteId != undefined) {
        siteUrl = Data.gaugeUrl("VA", siteId);
    }
    if (siteName.includes("Gathright")) {
        siteUrl = Data.GATHRIGHT_URL;
    }

    // Special override for Moomaw
    if (siteName.includes("Moomaw")) {
        siteDiv.innerHTML = `<h2 class="siteLabel"><a href=${Data.MOOMAW_URL} target="_blank">${siteName}</a></h2>
        <p class="siteData" id="moomawLevel" style="font-weight:bold; font-size:1.2em;">-- ft</p>
        <div class="lake-fill" id="lakeFill">
            <div class="fill-percentage" id="fillPercentage">--%</div>
        </div>`;
    } else {
        let labelHtml = siteUrl != undefined
            ? `<h2 class="siteLabel"><a href=${siteUrl} target="_blank">${siteName}</a></h2>`
            : `<h2 class="siteLabel">${siteName}</h2>`;

        let statsHtml = `<p class="siteData" id=${htmlName}_flow>-- cfs</p>`;
        if (!(siteName.includes("Above Dunlap"))) {
            statsHtml += `<p class="siteData" id=${htmlName}_height>-- ft</p>
        <p class="siteData" id=${htmlName}_temp>-- °F</p>`;
        }
        if (siteName.includes("Gathright")) {
            statsHtml += '<br><p class="siteData" id=Gathright_Dam_tmrwFlow style="color:gray">-- projected</p>';
        }

        siteDiv.innerHTML = `${labelHtml}<div class="siteStats">${statsHtml}</div>`;
    }

    return siteDiv;
}

// Populate site list with forking structure
for (const item of RIVER_STRUCTURE) {
    let li = document.createElement("li");
    
    if (item.type === "fork") {
        // Create fork container
        li.className = "fork-container";
        const forkDiv = document.createElement("div");
        forkDiv.className = "fork";

        // SVG Y: left/right dots join at center, then vertical line down to lake
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "fork-lines");
        svg.setAttribute("viewBox", "0 0 200 80");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.innerHTML = `
            <line class="fork-line left" x1="70" y1="16" x2="100" y2="55" />
            <line class="fork-line right" x1="130" y1="16" x2="100" y2="55" />
            <line class="fork-line stem" x1="100" y1="55" x2="100" y2="80" />
            <circle class="fork-dot left" cx="70" cy="16" r="8" />
            <circle class="fork-dot right" cx="130" cy="16" r="8" />
        `;
        forkDiv.appendChild(svg);

        item.branches.forEach((branch, idx) => {
            const branchDiv = document.createElement("div");
            branchDiv.className = idx === 0 ? "branch left" : "branch right";
            branchDiv.appendChild(createSiteElement(branch.name, branch.siteId));
            forkDiv.appendChild(branchDiv);
        });

        li.appendChild(forkDiv);
    } else if (item.type === "lake") {
        // Create lake container (bucket style)
        li.className = "lake-container";
        li.appendChild(createSiteElement(item.name, item.siteId));
    } else if (item.type === "inflow") {
        // Create inflow junction (tributary joining main river)
        li.className = "inflow-container";
        const inflowDiv = document.createElement("div");
        inflowDiv.className = "inflow";

        const tributaryDiv = document.createElement("div");
        tributaryDiv.className = "tributary";

        // Junction sits on the stem (left edge of the right-hand column)
        const junction = document.createElement("div");
        junction.className = "inflow-junction";
        tributaryDiv.appendChild(junction);
        tributaryDiv.appendChild(createSiteElement(item.tributary.name, item.tributary.siteId));

        inflowDiv.appendChild(tributaryDiv);
        li.appendChild(inflowDiv);
    } else if (item.type === "terminal") {
        // Terminal site where the river line ends
        li.className = "terminal-container";
        li.appendChild(createSiteElement(item.name, item.siteId));
    } else {
        // Regular site
        li.appendChild(createSiteElement(item.name, item.siteId));
    }
    
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

function colorSite(siteDiv, c) {
    if (c == undefined) {
        delete siteDiv.dataset.statusColor;
        updateCommonColors();
        return;
    }

    siteDiv.dataset.statusColor = c;
    siteDiv.style.color = c;
    const dataFields = siteDiv.querySelectorAll(".siteData");
    for (let i = 0; i < dataFields.length; i++) {
        dataFields[i].style.color = c;
    }

    const parent = siteDiv.parentElement;
    if (parent && parent.classList.contains("branch")) {
        parent.style.setProperty("--color", c);
        const side = parent.classList.contains("left") ? "left" : "right";
        const svg = parent.parentElement.querySelector(".fork-lines");
        if (svg) {
            const dot = svg.querySelector(`.fork-dot.${side}`);
            const line = svg.querySelector(`.fork-line.${side}`);
            if (dot) {
                dot.style.fill = c;
            }
            if (line) {
                line.style.stroke = c;
            }
        }
    }
    else if (parent && parent.classList.contains("tributary")) {
        parent.style.setProperty("--tributary-color", c);
        parent.style.color = c;
    }
    else if (parent) {
        parent.style.setProperty("--color", c);
    }

    updateCommonColors();
}

function getMainColor(item) {
    if (item.classList.contains("fork-container")) {
        const branchColors = Array.from(item.querySelectorAll(".branch .siteDiv"))
            .map(siteDiv => siteDiv.dataset.statusColor);
        if (branchColors.length === 2 && branchColors[0] != undefined && branchColors[0] === branchColors[1]) {
            return branchColors[0];
        }
        return undefined;
    }

    if (item.classList.contains("inflow-container")) {
        return undefined;
    }

    const siteDiv = item.querySelector(".siteDiv");
    return siteDiv ? siteDiv.dataset.statusColor : undefined;
}

function parseRgb(color) {
    const probe = document.createElement("span");
    probe.style.color = color;
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) {
        return undefined;
    }
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function blendColors(colorA, colorB, t) {
    if (colorA == undefined) {
        return colorB;
    }
    if (colorB == undefined || colorA === colorB || t <= 0) {
        return colorA;
    }
    if (t >= 1) {
        return colorB;
    }
    const rgbA = parseRgb(colorA);
    const rgbB = parseRgb(colorB);
    if (rgbA == undefined || rgbB == undefined) {
        return colorA;
    }
    const r = Math.round(rgbA[0] + (rgbB[0] - rgbA[0]) * t);
    const g = Math.round(rgbA[1] + (rgbB[1] - rgbA[1]) * t);
    const b = Math.round(rgbA[2] + (rgbB[2] - rgbA[2]) * t);
    return `rgb(${r}, ${g}, ${b})`;
}

function updateCommonColors() {
    const fork = siteBar.querySelector(".fork-container");
    if (fork) {
        const stem = fork.querySelector(".fork-line.stem");
        const branchColors = Array.from(fork.querySelectorAll(".branch .siteDiv"))
            .map(siteDiv => siteDiv.dataset.statusColor);
        if (branchColors.length === 2 && branchColors[0] != undefined && branchColors[1] != undefined) {
            stem.style.stroke = blendColors(branchColors[0], branchColors[1], 0.5);
        }
        else {
            stem.style.removeProperty("stroke");
        }
    }

    const items = Array.from(siteBar.children);
    const knownColors = items.map(getMainColor);
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (knownColors[i] != undefined || item.classList.contains("fork-container") || item.classList.contains("lake-container")) {
            continue;
        }

        let aboveIdx = -1;
        let aboveColor = undefined;
        for (let above = i - 1; above >= 0; above--) {
            if (knownColors[above] != undefined) {
                aboveIdx = above;
                aboveColor = knownColors[above];
                break;
            }
        }

        let belowIdx = -1;
        let belowColor = undefined;
        for (let below = i + 1; below < items.length; below++) {
            if (knownColors[below] != undefined) {
                belowIdx = below;
                belowColor = knownColors[below];
                break;
            }
        }

        if (aboveColor != undefined && belowColor != undefined) {
            const t = (i - aboveIdx) / (belowIdx - aboveIdx);
            item.style.setProperty("--color", blendColors(aboveColor, belowColor, t));
        }
        else if (aboveColor != undefined) {
            item.style.setProperty("--color", aboveColor);
        }
        else if (belowColor != undefined) {
            item.style.setProperty("--color", belowColor);
        }
        else {
            item.style.removeProperty("--color");
        }
    }
}

// Create lookup for easy access in update function
const SITE_ID_LOOKUP = {};
for (const item of RIVER_STRUCTURE) {
    if (item.type === "fork") {
        for (const branch of item.branches) {
            SITE_ID_LOOKUP[branch.name] = branch.siteId;
        }
    } else if (item.type === "inflow") {
        SITE_ID_LOOKUP[item.tributary.name] = item.tributary.siteId;
    } else {
        SITE_ID_LOOKUP[item.name] = item.siteId;
    }
}

function updateAboveDunlap(dunlap, roseDale) {
    const aboveDunlapFlow = document.getElementById("Above_Dunlap_flow");
    const aboveDunlapDiv = document.getElementById("Above_Dunlap_div");
    if (dunlap[0] != undefined && roseDale[0] != undefined) {
        const flow = roseDale[0] - dunlap[0];
        aboveDunlapFlow.textContent = `${flow} cfs`;
        aboveDunlapFlow.style.display = "inline";
        const c = getFlowHeightColor("Above Dunlap", flow);
        colorSite(aboveDunlapDiv, c);
    }
    else {
        aboveDunlapFlow.style.display = "none";
    }
}

function update() {
    var dunlap = [undefined, undefined, undefined];
    var roseDale = [undefined, undefined, undefined];
    for (const siteName in SITE_ID_LOOKUP) {
        const htmlName = siteName.replaceAll(" ", "_");
        const siteId = SITE_ID_LOOKUP[siteName];
        if (siteId == undefined) {
            // Skip this for now (no site id)
            continue;
        }
        const siteDiv = document.getElementById(`${htmlName}_div`);
        const siteHeading = siteDiv?.getElementsByClassName("siteLabel")[0];
        if (siteDiv == undefined || siteHeading == undefined) {
            console.warn(`Missing dashboard elements for ${siteName}`);
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
                if (flow != undefined && flowField) {
                    flowField.textContent = `${flow} cfs`;
                    flowField.style.display = "inline";
                    noData = false;
                }
                else if (flowField) {
                    flowField.style.display = "none";
                }

                if (height != undefined && heightField) {
                    heightField.textContent = `${height} ft`;
                    heightField.style.display = "inline";
                    noData = false;
                }
                else if (heightField) {
                    heightField.style.display = "none";
                }

                // Color these two together
                let setSiteHeading = false;
                if (flow != undefined || height != undefined) {
                    const c = getFlowHeightColor(siteName, flow, height);
                    colorSite(siteHeading.parentElement, c);
                    setSiteHeading = true;
                }

                if (temp != undefined && tempField) {
                    tempField.textContent = `${temp} °F`;
                    tempField.style.display = "inline";
                    const c = getTempColor(temp);
                    noData = false;
                    if (!setSiteHeading) {
                        colorSite(siteHeading.parentElement, c);
                        setSiteHeading = true;
                    }
                    tempField.style.color = c;
                }
                else if (tempField) {
                    tempField.style.display = "none";
                }

                // Hide the entire item if it has no data
                // Clear display when showing so CSS grid/layout rules still apply
                siteDiv.style.display = noData ? "none" : "";

                // Check for dam (special case)
                if (siteName.includes("Gathright")) {
                    Data.getGathrightData().then(schedule => {
                        const tmrwFlow = document.getElementById("Gathright_Dam_tmrwFlow");
                        tmrwFlow.textContent = schedule.text;
                        if (schedule.flow != undefined) {
                            tmrwFlow.style.color = getFlowHeightColor("Gathright Dam", schedule.flow);
                        }
                    }).catch(error => console.error("Error updating Gathright schedule:", error));
                }
                else if (siteName === "Dunlap Creek") {
                    dunlap = data.slice();
                    updateAboveDunlap(dunlap, roseDale);
                }
                else if (siteName.includes("Rose Dale")) {
                    roseDale = data.slice();
                    updateAboveDunlap(dunlap, roseDale);
                }
            }
        ).catch(error => console.error(`Error updating ${siteName}:`, error));
    }

    // Check for moomaw (special case)
    Data.getMoomawData().then(level => {
        if (level == undefined) {
            return;
        }
        const moomawDiv = document.getElementById("Lake_Moomaw_div");
        const moomawLevel = document.getElementById("moomawLevel");
        const fillPercentage = document.getElementById("fillPercentage");
        if (!moomawDiv || !moomawLevel || !fillPercentage) {
            console.warn("Missing Lake Moomaw dashboard elements");
            return;
        }
        const moomawLi = moomawDiv.parentElement;
        
        moomawLevel.textContent = `${level} ft`;
        
        // % of full pool ~= conservation storage / full-pool storage
        // (constant surface-area approx using published volume and area)
        const drawdown = MOOMAW_FULL_POOL - level;
        const currentStorage = MOOMAW_FULL_STORAGE - MOOMAW_SURFACE_ACRES * drawdown;
        const percentage = (currentStorage / MOOMAW_FULL_STORAGE) * 100;
        
        // Update fill percentage display
        fillPercentage.textContent = `${Math.max(0, percentage).toFixed(0)}%`;
        fillPercentage.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
        
        // Get the difference between the level and the full pool
        const diff = (level - MOOMAW_FULL_POOL).toFixed(2);
        if (diff > 0) {
            moomawLevel.textContent += ` (+${diff} ft)`;
        }
        else if (diff < 0) {
            moomawLevel.textContent += ` (${diff} ft)`;
        }
        else {
            moomawLevel.textContent += " (@ full pool)";
        }
        
        const c = getMoomawColor(level);
        moomawLi.style.setProperty("--color", c);
        moomawDiv.dataset.statusColor = c;
        moomawLevel.style.color = c;
        updateCommonColors();
    }).catch(error => console.error("Error updating Lake Moomaw:", error));
}

update();