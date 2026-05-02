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

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace occurrences in backticks: `http://localhost:5000/api/...` -> `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/...`
  if (content.includes('`http://localhost:5000/api')) {
    content = content.replace(/`http:\/\/localhost:5000\/api/g, '`${import.meta.env.VITE_API_BASE_URL || \'http://localhost:5000/api\'}');
    changed = true;
  }

  // Replace occurrences in single quotes: 'http://localhost:5000/api/...' -> `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/...`
  // We need to convert them to backticks for easier interpolation if they aren't already variables.
  // Example: 'http://localhost:5000/api/tracking/heartbeat' -> `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/tracking/heartbeat`
  if (content.includes('\'http://localhost:5000/api')) {
    // Regex matches 'http://localhost:5000/api/something'
    content = content.replace(/'http:\/\/localhost:5000\/api([^']*)'/g, '`${import.meta.env.VITE_API_BASE_URL || \'http://localhost:5000/api\'}$1`');
    changed = true;
  }

  // Handle double quotes just in case: "http://localhost:5000/api/..." -> `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/...`
  if (content.includes('"http://localhost:5000/api')) {
    content = content.replace(/"http:\/\/localhost:5000\/api([^"]*)"/g, '`${import.meta.env.VITE_API_BASE_URL || \'http://localhost:5000/api\'}$1`');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated: ${file}`);
  }
});

console.log('Done replacing hardcoded URLs.');
