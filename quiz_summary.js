const fs = require("fs-extra");
const path = require("path");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const beautify = require('js-beautify').html;
const glob = require("glob-promise");

async function processScene(scene) {
    // console.log(JSON.stringify(scene));
    if (scene["isMessageScene"]) {
        return {};
    }
}

async function processSwfUrl(url, moduleFolderRoot) {
    const urlParts = url.split("/");
    const filename = urlParts[urlParts.length - 1];
    if (urlParts[0] == "story_content" && 
        path.extname(filename) == ".swf") {
        urlParts[0] = "mobile";
        urlParts[urlParts.length - 1] = path.parse(filename).name + "*.png";
        const fullpath = (await glob(path.join(moduleFolderRoot, urlParts.join("/")))).pop(); // Assumes there is only one match or whatever the last match is
        urlParts[urlParts.length - 1] = path.basename(fullpath);
        const newUrl = urlParts.join("/");
        console.log("Converted resource link:", url, "->", newUrl);
        return newUrl;
    } else {
        return url;
    }
}

async function processQuizSlide(slide, slideData, moduleFolderRoot) {
    const title = slide["title"];
    const texts = [slide["interactions"][0]["lmstext"]];
    let choices;
    // if (slide["interactions"][0]["choices"] != undefined) 
    choices = slide["interactions"][0]["choices"].map(choice => choice["lmstext"]);
    // else
        // choices = ["Error: Bad data format"]
    
    const choiceIndex = new Map();
    slide["interactions"][0]["choices"].forEach(choice => choiceIndex.set(choice["id"], choice["lmstext"]));
    const answers = [];
    slide["interactions"][0]["answers"].forEach(answer => {
        if (answer["status"] == "correct") {
            answer["evaluate"]["statements"].forEach(statement => {
                answers.push(choiceIndex.get(statement["choiceid"].split(".").pop()));
            })
        }
    })

    // Parse slideData JSON
    // Find the base layer
    let images = [];
    let section = undefined;
    const baseLayers = slideData["slideLayers"].filter(layer => layer["isBaseLayer"]);
    if (baseLayers.length != 1) {
        console.error("Expects only one base layer, found:", baseLayers.length);
    } else {
        const baseLayer = baseLayers.pop();
        const imageObjects = baseLayer["objects"].filter(obj => obj["kind"] == "image");
        images = imageObjects.map(obj => path.join("mobile", obj["data"]["html5data"]["url"]));

        const imageObjectsSwf = baseLayer["objects"]
            .filter(obj => "imagelib" in obj)
            .map(obj => obj["imagelib"][0]["url"]);
        const imageObjectsPng = await Promise.all(
            imageObjectsSwf.map(url => processSwfUrl(url, moduleFolderRoot))
        );
        images.push(...imageObjectsPng);

        section = baseLayer["objects"]
            .filter(obj => "textLib" in obj)
            .map(obj => obj["data"]["vectorData"]["altText"])
            .filter(text => text.toLowerCase().includes("quiz"))
            .pop();
        // console.log(JSON.stringify(textObjects));
    }

    let comments = [];
    const commentLayers = slideData["slideLayers"].filter(layer => !layer["isBaseLayer"]);
    if (commentLayers.length >= 2) {
        let commentLayer = commentLayers[1]; // usually 3, but we have removed the base layer just in case
        let textObjects = commentLayer["objects"].filter(obj => "textLib" in obj);
        comments = textObjects.map(obj => obj["data"]["vectorData"]["altText"]);
        if (!comments.includes("Correct")) {
            commentLayer = commentLayers[0]; // usually 3, but we have removed the base layer just in case
            textObjects = commentLayer["objects"].filter(obj => "textLib" in obj);
            comments = textObjects.map(obj => obj["data"]["vectorData"]["altText"]);
        }
        if (!comments.includes("Correct")) {
            comments = [];
        }
        console.log(comments);
    } else {
        console.error("Cannot find the comment layer, expected at least 2 non base layers, found:", commentLayers.length);
    }

    return {
        "section": section,
        "title": title,
        "texts": texts,
        "images": images,
        "choices": choices,
        "answers": answers,
        "comments": comments
    };
}

async function processQuiz(quiz, slidesIndex, jsonFolderRoot, moduleFolderRoot) {
    return await Promise.all(quiz["sliderefs"].map(async ref => {
        const slide = slidesIndex.get(ref["id"].split(".").pop());
        const slideData = await fs.readJson(path.join(jsonFolderRoot, slide["html5url"]+"on")); // convert .js to .json
        return processQuizSlide(
            slide, slideData, moduleFolderRoot
        )
    }));
}

async function generateQuizSummary(moduleFolderRoot, jsonFolderRoot) {
    const dataJsFile = path.join(jsonFolderRoot, "html5/data/js/data.json");
    const data = await fs.readJson(dataJsFile);

    const slidesIndex = new Map();
    data["scenes"].forEach(scene => {
        scene["slides"].forEach(slide => {
            slidesIndex.set(slide["id"], slide);
        })
    })

    const quizzes = data["quizzes"].filter(quiz => "sliderefs" in quiz);
    const quizzesProcessed = await Promise.all(quizzes.map(quiz => processQuiz(quiz, slidesIndex, jsonFolderRoot, moduleFolderRoot)));
    
    const dom = new JSDOM(await fs.readFile("quiz_summary.html"));
    const document = dom.window.document;
    document.title = "Quiz: " + jsonFolderRoot.split("/").pop();
    const elem = document.createElement("h1");
    elem.appendChild(document.createTextNode(document.title));
    document.body.appendChild(elem);
    
    const nav = document.createElement("nag");
    document.body.appendChild(nav);

    const toc = document.createElement("ol");
    nav.appendChild(toc);

    for (const [i, qGroup] of quizzesProcessed.entries()) {
        let groupTitle = `Quiz ${i}`; // default value, shouled be changed to q["section"]

        const qGroupTitle = document.createElement("h2");
        document.body.appendChild(qGroupTitle);
        
        const elem = document.createElement("section");
        elem.className = "question-group";
        document.body.appendChild(elem);

        for (const q of qGroup) {
            groupTitle = q["section"];

            const qElem = document.createElement("div");
            qElem.className = "question";
            elem.appendChild(qElem);
            
            const title = document.createElement("h3");
            title.className = "title";
            title.appendChild(document.createTextNode(q["title"]));
            qElem.appendChild(title);
            
            const texts = document.createElement("p");
            texts.className = "texts";
            texts.appendChild(document.createTextNode(q["texts"].join("\n")));
            qElem.appendChild(texts);

            const images = document.createElement("div");
            images.className = "images"
            qElem.appendChild(images);
            q["images"].forEach(src => {
                imgA = document.createElement("a");
                imgA.setAttribute("href", src);
                imgA.setAttribute("target", target="_blank");
                images.appendChild(imgA);
                img = document.createElement("img");
                img.setAttribute("src", src);
                imgA.appendChild(img);
            })
            
            const choiceTitle = document.createElement("p");
            choiceTitle.className = "choice-title";
            choiceTitle.appendChild(document.createTextNode("Choices:"));
            qElem.appendChild(choiceTitle);

            const choices = document.createElement("ul");
            choices.className = "choices";
            q["choices"].forEach(choice => {
                const item = document.createElement("li");
                item.appendChild(document.createTextNode(choice))  
                choices.appendChild(item);
            });
            qElem.appendChild(choices);
            
            const answerTitle = document.createElement("p");
            answerTitle.className = "answer-title";
            answerTitle.appendChild(document.createTextNode("Answers:"));
            qElem.appendChild(answerTitle);

            const answers = document.createElement("ul");
            answers.className = "answers";
            q["answers"].forEach(answer => {
                const item = document.createElement("li");
                item.appendChild(document.createTextNode(answer))  
                answers.appendChild(item);
            });
            qElem.appendChild(answers);

            const commentTitle = document.createElement("p");
            commentTitle.className = "comment-title";
            commentTitle.appendChild(document.createTextNode("Comments:"));
            qElem.appendChild(commentTitle);

            const comments = document.createElement("ul");
            comments.className = "comments";
            q["comments"].forEach(comment => {
                const item = document.createElement("li");
                item.appendChild(document.createTextNode(comment))  
                comments.appendChild(item);
            });
            qElem.appendChild(comments);
        }

        qGroupTitle.textContent = groupTitle;
        const id = groupTitle.split(/\W/g).join("").toLowerCase();
        qGroupTitle.setAttribute("id", id);
        
        
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.setAttribute("href", `#${id}`);
        link.textContent = groupTitle;
        item.appendChild(link);  
        toc.appendChild(item);
    }

    // console.log(dom.serialize());
    console.log("Writing to:", path.join(moduleFolderRoot, jsonFolderRoot.split("/").pop() + "_quiz.html"));
    return fs.writeFile(path.join(moduleFolderRoot, jsonFolderRoot.split("/").pop() + "_quiz.html"), 
                        beautify(dom.serialize()));
}

async function main() {
    const myArgs = process.argv.slice(2);
    await generateQuizSummary(myArgs[0], myArgs[1]);

    return 0;
}

main().then(ret => process.exit(ret)).catch(err => console.error(err));