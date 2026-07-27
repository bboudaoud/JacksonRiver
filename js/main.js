"use strict";

import { startDashboard } from "./river.js";
import { getJacksonData as getCustomData } from "./jackson.js";

try {
    await startDashboard("./jackson.json", getCustomData);
}
catch (error) {
    console.error(error);
    document.body.textContent = `Failed to start dashboard: ${error.message}`;
}
