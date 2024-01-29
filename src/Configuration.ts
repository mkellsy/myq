import fs from "fs";
import path from "path";

import { Configuration } from "./Interfaces/Configuration";

const configuration: Configuration = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../myq.config.json")).toString());

export { configuration };
