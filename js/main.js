"use strict";

import { boot } from "https://bboudaoud.github.io/RiverDashboard/js/main.js";
import { getJacksonData as getCustomData } from "./jackson.js";

// boot() pulls in the shared stylesheet and reports startup errors itself.
// Config path is resolved against the page, not this script.
await boot("./jackson.json", getCustomData);
