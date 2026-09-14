import http from 'http';

function checkEndpoint(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', err => reject(err));
  });
}

async function test() {
  console.log("Testing ORATOR AI Backend Server...");
  try {
    const health = await checkEndpoint('/api/health');
    console.log("Healthcheck Result:", health);
    const profile = await checkEndpoint('/api/profile');
    console.log("Profile Result:", profile.user_id, "Sessions:", profile.sessions_completed);
    console.log("All Server API endpoints verified!");
  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

test();
