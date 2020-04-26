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
    const imageSources = ["TODO.png"];
    let choices;
    if (slide["interactions"][0]["choices"] != undefined) 
        choices = slide["interactions"][0]["choices"].map(choice => choice["lmstext"]);
    else
        choices = ["Error: Bad data format"]
    
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

    return {
        "title": title,
        "texts": texts,
        "imageSources": imageSources,
        "choices": choices,
        "answers": answers
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
        {
            const elem = document.createElement("h2");
            elem.appendChild(document.createTextNode("Quiz"));
            document.body.appendChild(elem);
        }
        const elem = document.createElement("section");
        elem.className = "questiongroup";
        document.body.appendChild(elem);
        for (const q of qGroup) {
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
            
            const choiceTitle = document.createElement("p");
            choiceTitle.className = "choiceTitle";
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
            answerTitle.className = "answerTitle";
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
        }
    }

    // console.log(dom.serialize());
    return fs.writeFile(jsonFolderRoot.split("/").pop() + "_quiz.html", beautify(dom.serialize()));
}

async function main() {
    const myArgs = process.argv.slice(2);
    await generateQuizSummary(myArgs[0], myArgs[1]);

    return 0;
}

main().then(ret => process.exit(ret)).catch(err => console.error(err));