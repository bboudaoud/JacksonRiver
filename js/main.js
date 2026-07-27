"use strict";

import { startDashboard } from "./river.js";
import { getJacksonData as getCustomData } from "./jackson.js";

await startDashboard("./jackson.json", getCustomData);
