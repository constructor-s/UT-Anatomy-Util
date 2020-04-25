const fs = require('fs').promises;

const CHAR_MAPPING = {
    // 57344: "f",
    // 57349: "t",
    // 57350: "ti"
}
const CHAR_MAPPING_REGEX = Object.entries(CHAR_MAPPING).map(
    ([k, v], i) => [new RegExp(String.fromCodePoint(k), 'g'), v]
)
  

fs.readFile("paths.json").then((response) => {
    const json = JSON.parse(response);
    let str = json["Lib"]["commandset-0"]["children"][1]["children"][0]["children"][0];

    // How slow is this...?
    for (const [fr, to] of CHAR_MAPPING_REGEX) {
        str = str.replace(fr, to);
    }

    console.log(typeof(str));
    console.log(str);
    for (const [i, char] of Object.entries(str)) {
        console.log(i, char, char.charCodeAt(0), char.charCodeAt(0).toString(16), String.fromCodePoint(char.codePointAt()));
    }
});
