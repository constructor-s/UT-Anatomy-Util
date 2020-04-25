const fs = require('fs').promises;
const b64 = require('base64-arraybuffer');
const fontkit = require('fontkit');
const opentype = require("opentype.js");

fs.readFile("frame.json").then(analyzeFile);

async function analyzeFile(response) {
    const json = JSON.parse(response);
    const fonts = json["fonts"];

    // const font = fonts[0];

    // console.log(fonts[0]["name"]);

    for (const font of fonts) {
        console.log(font["name"]);

        const files = font["files"];
        for (const file of files) {
            
            const fileData = file["fileData"];
            const [mime, data] = fileData.split(";");
            console.log(mime);
            const [dataType, dataText] = data.split(",");

            const dataBin = b64.decode(dataText);
            await fs.writeFile(`${font["name"]}${file['bold'] ? '-bold' : ''}.woff`, Buffer.from(dataBin));
        }
    }

    // let otfont = opentype.loadSync('Calibri5859E9C5.woff');
    // console.log('OpenType', otfont);
    let fkfont = fontkit.openSync('Calibri5859E9C5.woff');
    console.log(fkfont);
    console.log(fkfont.hasGlyphForCodePoint(57344));

    // for (const font of fonts) {
    //     console.log(font["name"]);

    //     const files = font["files"];
    //     const file = files[0];

    //     const fileData = file["fileData"];
    //     const [mime, data] = fileData.split(";");
    //     console.log(mime);
    //     const [dataType, dataText] = data.split(",");

    //     const dataBin = b64.decode(dataText, dataType);
    //     fs.writeFile("font.woff", dataBin);
    // }
    
    // const dataBin = Buffer.from(dataText, dataType);
    // console.log(dataBin);
    // const otfont = opentype.parse(dataBin);
    // if (dataType == "base64") {
    //     // console.log(dataText);
    //     // const dataBin = atob(dataText);
    //     // console.log(dataBin);

    //     const dataBin = b64.decode(dataText, dataType);
    //     fs.writeFile("font.woff", dataBin);
    //     const otfont = opentype.parse(dataBin);
    //     // console.log(otfont.toTables());
    //     console.log("Font supported:", otfont.supported);
        
    // // const otfont = opentype.parse(fileData);
    // } else {
    //     console.error("Unrecognized type:", dataType);
    // }
}
