"use strict";

import { boot } from "https://cdn.jsdelivr.net/gh/bboudaoud/RiverDashboard@main/js/main.js";
import { getJacksonData as getCustomData } from "./jackson.js";

// boot() pulls in the shared stylesheet and reports startup errors itself.
// Config path is resolved against the page, not this script.
await boot("./jackson.json", getCustomData);
