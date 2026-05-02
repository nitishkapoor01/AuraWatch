const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(file);
      }
    }
  });
  return results;
};

const files = walk(path.join(__dirname, 'src'));

const LIVE_URL = "https://aurawatch-1.onrender.com/api";

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}`
  // with `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://aurawatch-1.onrender.com/api')}`
  const regex = /\$\{import\.meta\.env\.VITE_API_BASE_URL \|\| (['"`])http:\/\/localhost:5000\/api\1\}/g;
  
  if (regex.test(content)) {
    content = content.replace(regex, `\${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '${LIVE_URL}')}`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated: ${file}`);
  }
});

console.log('Done fixing URLs for production fallback.');
