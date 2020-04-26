const fs = require("fs-extra");
const path = require("path");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const beautify = require('js-beautify').html;

async function processScene(scene) {
    // console.log(JSON.stringify(scene));
    if (scene["isMessageScene"]) {
        return {};
    }
}

async function processQuizSlide(slide, slideData) {
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

async function processQuiz(quiz, slidesIndex, jsonFolderRoot) {
    return await Promise.all(quiz["sliderefs"].map(async ref => {
        const slide = slidesIndex.get(ref["id"].split(".").pop());
        const slideData = await fs.readJson(path.join(jsonFolderRoot, slide["html5url"]+"on")); // convert .js to .json
        return processQuizSlide(
            slide, slideData
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
    const quizzesProcessed = await Promise.all(quizzes.map(quiz => processQuiz(quiz, slidesIndex, jsonFolderRoot)));
    
    const dom = new JSDOM(await fs.readFile("quiz_summary.html"));
    const document = dom.window.document;
    document.title = "Quiz: " + jsonFolderRoot.split("/").pop();
    const elem = document.createElement("h1");
    elem.appendChild(document.createTextNode(document.title));
    document.body.appendChild(elem);
    for (const qGroup of quizzesProcessed) {
        const qGroupTitle = document.createElement("h2");
        const qGroupTextNode = document.createTextNode("Quiz");
        qGroupTitle.appendChild(qGroupTextNode);
        document.body.appendChild(qGroupTitle);
        
        const elem = document.createElement("section");
        elem.className = "question-group";
        document.body.appendChild(elem);
        for (const q of qGroup) {
            qGroupTitle.textContent = q["section"];

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