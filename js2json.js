'use strict';

const vm = require("vm");
const fs = require("fs-extra");
const glob = require("glob-promise");
const path = require("path");

function parseStoryJs(text) {
    const window = {};
    window.globalProvideData = (a1, a2)  => a2; // vm does not support destructuring?
    const json_ = vm.runInNewContext(text, {window});
    const json = JSON.parse(json_);

    return json;
}

async function main() {
    const contents = await glob("docs/*/html5/data/js/*.js");
    
    const srcDestPairs = contents.map(x => {
        const pathParts = x.split("/");
        pathParts[0] = "docs_data_json";
        const newNameJSON = path.parse(x).name + ".json";
        pathParts[pathParts.length-1] = newNameJSON;
        return [x, pathParts.join("/")];
    });

    for (let i = 0; i < 10; i++) {
        const ele = srcDestPairs[i];
        console.log(ele[1]);
    }

    await Promise.all(srcDestPairs.map(async ([src, dest]) => {
        const text = await fs.readFile(src);
        const json = parseStoryJs(text);
        await fs.outputJSON(dest, json);
        console.log(src, "->", dest);
        return;
    }));

    return 0;
}

main().then(ret => process.exit(ret)).catch(err => console.error(err));
