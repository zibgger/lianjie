const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "public");
const server = http.createServer((req,res)=>{
  const file = path.join(root, req.url === "/" ? "index.html" : req.url.replace(/^\/+/, ""));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);return res.end("Not found");}
    res.setHeader("Content-Type", file.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream");
    res.end(data);
  });
});
server.listen(process.env.PORT || 3000, ()=>console.log("Static preview on http://localhost:"+(process.env.PORT||3000)));
