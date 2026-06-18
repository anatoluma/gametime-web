import fs from "fs";
import path from "path";
import FormData from "form-data";
import fetch from "node-fetch";

const filePath = process.argv[2] || "AdmiralsMetalurg.jpg";
const seasonId = process.argv[3] || "1";
const competitionId = process.argv[4] || "1";

const ext = path.extname(filePath).toLowerCase();
const contentTypeMap = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};
const contentType = contentTypeMap[ext] || "image/jpeg";

const form = new FormData();
form.append("file", fs.createReadStream(filePath), {
  filename: path.basename(filePath),
  contentType: contentType,
});
form.append("season_id", seasonId);
form.append("competition_id", competitionId);

console.log(`Uploading: ${filePath}`);

const res = await fetch("http://localhost:3000/api/admin/box-scores/upload", {
  method: "POST",
  body: form,
  headers: form.getHeaders(),
});

const data = await res.json();
console.log("Status:", res.status);
console.log("Response:", JSON.stringify(data, null, 2));
