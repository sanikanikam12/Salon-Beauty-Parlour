import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist");
const api = (process.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
for (const name of ["book.html", "whatsapp-reminder.html"]) {
  const file = path.join(root, name);
  if (fs.existsSync(file)) {
    const html = fs.readFileSync(file, "utf8");
    fs.writeFileSync(file, html.replaceAll("http://127.0.0.1:8000", api), "utf8");
  }
}
console.log("Public pages configured for API:", api);
