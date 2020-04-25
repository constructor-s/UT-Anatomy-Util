'use strict';

const vm = require('vm');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const http = require('http');
const https = require('http');
const fetch = require('node-fetch');
const fs = require('fs-extra');
const path = require('path');

const MODULE_NAME = "Anatomy/Lab9";
const LOCAL_NAME = MODULE_NAME.replace("/", "_");
const OUTPUT_DIR = "output"
const URL_TEMPLATE_ROOT = `http://emodules.med.utoronto.ca/${MODULE_NAME}/`;
const URL_DATA_JS_SUFFIX = "html5/data/js/data.js";
const URL_FRAME_JS_SUFFIX = "html5/data/js/frame.js";
const URL_PATHS_JS_SUFFIX = "html5/data/js/paths.js";
const CONTENT_LINK_REGEX = [
    /"(html5\/.*?)"/g,
    /"(mobile\/.*?)"/g,
    /"(story_content\/.*?)"/g
]

const httpAgent = new http.Agent({
    keepAlive: true
});
const httpsAgent = new https.Agent({
    keepAlive: true
});
 
const fetchOptions = {
    agent: function (_parsedURL) {
        if (_parsedURL.protocol == 'http:') {
            return httpAgent;
        } else {
            return httpsAgent;
        }
    }
}

async function parseStoryData(url) {
    const response = await fetch(url);
    const text = await response.text();

    const window = {};
    window.globalProvideData = (a1, a2)  => a2; // vm does not support destructuring?
    const json_ = vm.runInNewContext(text, {window});
    const json = JSON.parse(json_);

    return json;
}


function getSearchText(slideid, idSearchMap) {
    if (idSearchMap.has(slideid)) {
        return idSearchMap.get(slideid)["Text"];
        // lines.push(`<p>${idSearchMap.get(slideid)["Text"]}</p>`);
    }
}
    
async function main_old() {

    // console.log(process.versions);
    // console.log("data.js location: " + URL_TEMPLATE_ROOT + URL_DATA_JS_SUFFIX);

    // const response = await http.get(URL_TEMPLATE_ROOT + URL_DATA_JS_SUFFIX);
    // console.log(response.finished);
    // console.log(response.text);

    // const dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
    // console.log(dom.window.document.querySelector("p").textContent); // "Hello world"
    // const { window } = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
    // window.globalProvideData = function(arg1, arg2) {
    //     return arg1, arg2;
    // }
    // const result = vm.runInNewContext(, {window})

    // const response = await fetch(URL_TEMPLATE_ROOT + URL_DATA_JS_SUFFIX);
    // const text = await response.text();

    // const window = {};
    // window.globalProvideData = (a1, a2)  => a2; // vm does not support destructuring?
    // const json_ = vm.runInNewContext(text, {window});
    // const data = JSON.parse(json_);


    await Promise.all([
        parseStoryData(URL_TEMPLATE_ROOT + URL_DATA_JS_SUFFIX).then(
        (json) => {
            fs.writeFile("data.json", JSON.stringify(json, null, "\t"));
        }).catch(console.error),
        parseStoryData(URL_TEMPLATE_ROOT + URL_FRAME_JS_SUFFIX).then(
        (json) => {
            fs.writeFile("frame.json", JSON.stringify(json, null, "\t"));
        }).catch(console.error),
        parseStoryData(URL_TEMPLATE_ROOT + URL_PATHS_JS_SUFFIX).then(
        (json) => {
            fs.writeFile("paths.json", JSON.stringify(json, null, "\t"));
        }).catch(console.error)
    ]);

    // parseStoryData("http://emodules.med.utoronto.ca/Anatomy/Lab4/html5/data/js/5XwU8NMXkDF.js").then(
    //     (json) => {
    //         fs.writeFile("slide.json", JSON.stringify(json, null, "\t"));
    //     }).catch(console.error);

        


    const data = await fs.readFile("data.json").then((response) => 
        JSON.parse(response)
    );
    const frame = await fs.readFile("frame.json").then((response) => 
        JSON.parse(response)
    );


    // Generate map between ID and Scene and Slide
    const idSlideMap = new Map();
    const idSceneMap = new Map();
    const idSearchMap = new Map();
    
    for (const scene of data["scenes"]) {
        idSceneMap.set(scene["id"].split(".").pop(), scene);
        for (const slide of scene["slides"]) {
            idSlideMap.set(slide["id"].split(".").pop(), slide);
        }
    }

    // for (const [i, search] of frame["navData"]["search"].entries()) {
    //     idSearchMap.set(search["slideid"].split(".").pop(), search)
    // }

    const lines = [
        `<!doctype html>`,
        `<head>`,
        `    <link rel="stylesheet" href="styles.css?v=1.0">`,
        `</head>`,
        `<body>`
    ];
    // Print outline from frame

    for (const [i, link] of frame["navData"]["outline"]["links"].entries()) {
        console.log(`${i}:\t${link["displaytext"]}`);
        lines.push(`<h1>${link["displaytext"]}</h1>`);

        const slideid = link["slideid"].split(".").pop();
        // lines.push(`<p>${getSearchText(slideid, idSearchMap)}</p>`);

        if (idSceneMap.has(slideid)) {
            const startingslideid = idSceneMap.get(slideid)["startingSlide"].split(".").pop();
            // lines.push(`<p>${getSearchText(startingslideid, idSearchMap)}</p>`);

            const slide = idSlideMap.get(startingslideid);
            const slideUrl = URL_TEMPLATE_ROOT + slide["html5url"];
            try {
                const slideJson = await parseStoryData(slideUrl);
                if ("slideLayers" in slideJson) {
                    // console.log(slideJson["slideLayers"]);
                    for (const [i, slideLayer] of slideJson["slideLayers"].entries()) {
                        // lines.push(`<h3>isBaseLayer: ${slideJson["slideLayers"]["isBaseLayer"]}</h3>`);
                        for (const [j, object] of slideLayer["objects"].entries()) {
                            try {
                                lines.push(`<p>${object["data"]["vectorData"]["altText"]}</p>`);
                            } catch(err) {
                                lines.push(`<p>${object["accType"]}</p>`);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Cannot download ${slide["title"]} at: ${slideUrl}`)
            }
        }

        if ("links" in link) {
            for (const [j, sublink] of link["links"].entries()) {
                // console.log("22222222");
                const slideid = sublink["slideid"].split(".").pop();
                lines.push(`<h2>${sublink["displaytext"]}</h2>`);

                // lines.push(`<p>${getSearchText(slideid, idSearchMap)}</p>`);

                
                const slide = idSlideMap.get(slideid);
                const slideUrl = URL_TEMPLATE_ROOT + slide["html5url"];
                
                try {
                    const slideJson = await parseStoryData(slideUrl);
                    if ("slideLayers" in slideJson) {
                        // console.log(slideJson["slideLayers"]);
                        for (const [i, slideLayer] of slideJson["slideLayers"].entries()) {
                            // lines.push(`<h3>isBaseLayer: ${slideJson["slideLayers"]["isBaseLayer"]}</h3>`);
                            for (const [j, object] of slideLayer["objects"].entries()) {
                                try {
                                    lines.push(`<p>${object["data"]["vectorData"]["altText"]}</p>`);
                                } catch(err) {
                                    lines.push(`<p>${object["accType"]}</p>`);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Cannot download ${slide["title"]} at: ${slideUrl}`)
                }
            }
        }
    }

    lines.push("</body>")
    lines.push("")

    await fs.writeFile(`${LOCAL_NAME}.html`, lines.join("\n"));
    
    // for (const [i, scene] of data["scenes"].entries()) {
    //     const slideId = scene["startingSlide"].split(".").pop();
    //     const slide = idSlideMap.get(slideId);
    //     console.log(`${i}:\t${slide["title"]}`);
    // }

    
    // for (const slideRef of data["slideMap"]["slideRefs"]) {
    //     console.log(slideRef);
    // }

    
    return 0;
}


async function downloadStory(urlTemplateRoot, outputDir, localName) {
    const localDir = path.join(outputDir, localName);
    return downloadStoryPage(urlTemplateRoot, localDir, "story_html5.html").then(() => 
        downloadStoryPage(urlTemplateRoot, localDir, URL_DATA_JS_SUFFIX)
    ).then(() => 
        downloadStoryPage(urlTemplateRoot, localDir, URL_FRAME_JS_SUFFIX)
    ).then(() => 
        downloadStoryPage(urlTemplateRoot, localDir, URL_PATHS_JS_SUFFIX)
    );
}


/**
 * https://stackoverflow.com/a/51302466/6610243
 * @param {*} url 
 * @param {*} path 
 */
const downloadFile = (async (url, path) => {
    const res = await fetch(url);
    const fileStream = fs.createWriteStream(path);
    return new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", (err) => {
          reject(err);
        });
        fileStream.on("finish", function() {
          resolve();
        });
      });
  });

async function downloadStoryPage(urlTemplateRoot, localDir, page, recursionLevel = 0) {
    if (recursionLevel > 10) {
        return;
    }
    if (page.endsWith("/")) {
        return;
    }

    const url = urlTemplateRoot + page;
    const file = path.join(localDir, page);

    try {
        await fs.access(file, fs.constants.R_OK | fs.constants.W_OK);
        console.log(recursionLevel, "Already exists:", url, "->", file);
    } catch {
        console.log(recursionLevel, "Downloading:", url, "->", file);
        await fs.ensureFile(file);
        await downloadFile(url, file);
    }

    if (![".swf", ".mp4", ".jpg", ".png"].includes(path.extname(file))) {
        console.log(recursionLevel, "Analyzing:", file);

        const text = (await fs.readFile(file)).toString();
        if (text.length == 0) {
            console.error("File is empty:", file);
        }

        const children = [];
        for (const re of CONTENT_LINK_REGEX) {
            for (const match of text.matchAll(re)) {
                children.push(match[1]);
            }
        }
        // console.log("Found the following links:");
        // children.map(x => console.log("\t", x));
        for (const child of children) {
            downloadStoryPage(urlTemplateRoot, localDir, child, recursionLevel+1);
        }
    }
    // let text = "";

    // try {
    //     console.log(recursionLevel, "Already exist:", url, "->", file);

    //     text = (await fs.readFile(file)).toString();
    // } catch (error) {
    //     console.log(recursionLevel, "Downloading:", url, "->", file);

    //     const response = await fetch(url, fetchOptions);
    //     await fs.outputFile(file, response.arrayBuffer());
    //     text = await response.text();
    // }
    // console.log(typeof(text));
    // console.log(text);

    return;
}

async function main() {
    await downloadStory(URL_TEMPLATE_ROOT, OUTPUT_DIR, LOCAL_NAME);

    return 0;
}

main()
.then(console.log)
.catch(console.error);
