import fs from "fs";

const content = fs.readFileSync("index.html", "utf-8");
const lines = content.split("\n");

// We need to delete lines 3217 to 3775
// Note: Lines are 1-indexed for us but 0-indexed in JS array.
// But wait, the line numbers shown by view_file might be slightly shifted if there were edits!
// It's safer to find the indices of the specific comments!

const start1 = lines.findIndex(l => l.includes("<!-- MAIN INSPECTION modal (Obsolete / Standalonised) -->"));
const end1 = lines.findIndex((l, i) => i > start1 && l.includes("<!-- LIGHTBOX SUITE -->"));

let newLines = lines;
if (start1 !== -1 && end1 !== -1) {
    newLines.splice(start1, end1 - start1);
}

const start2 = newLines.findIndex(l => l.includes("<!-- SUCCESS RECAP MODAL (Obsolete / Standalonised) -->"));
const end2 = newLines.findIndex((l, i) => i > start2 && l.includes("<!-- AUTHENTICATION VIEW -->"));

if (start2 !== -1 && end2 !== -1) {
    newLines.splice(start2, end2 - start2);
}

fs.writeFileSync("index.html", newLines.join("\n"));
console.log("Successfully removed obsolete sections.");
