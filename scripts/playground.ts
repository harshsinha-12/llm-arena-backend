import dotenv from "dotenv";
dotenv.config();

import { saveConstituents } from "./save-constituents";
import { saveNews } from "./save-news";
import { saveOHLC } from "./save-ohlc";
import { saveTechnicals } from "./save-techncials";
// import { readOHLC } from "./read-ohlc";

async function main() {
    await saveConstituents();
    console.log("Constituents saved");
    await saveOHLC();
    console.log("OHLC saved");
    await saveNews();
    console.log("News saved");
    await saveTechnicals();
    console.log("Technicals saved");

    // THIS IS TO TEST
    // await readOHLC("MBEQU5710");
    // console.log("Finished reading OHLC");
}

main().catch(console.error);
