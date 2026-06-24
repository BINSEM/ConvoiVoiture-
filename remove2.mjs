import fs from "fs";

let content = fs.readFileSync("index.html", "utf-8");
let lines = content.split("\n");

let start = lines.findIndex(l => l.includes("<!-- SUCCESS RECAP MODAL (Obsolete / Standalonised) -->"));
let end = lines.findIndex((l, i) => i > start && l.includes("AFFICHER L'OVERLAY DE CONNEXION"));

if (start !== -1 && end !== -1) {
    // Delete up to end - 2 to keep the comment block of AFFICHER
    lines.splice(start, end - start - 2);
    fs.writeFileSync("index.html", lines.join("\n"));
    console.log("Deleted success modal!");
} else {
    console.log("Not found:", start, end);
}
