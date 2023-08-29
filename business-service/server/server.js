const express = require('express');
const path = require('path');

//controllers


const PORT = process.env.PORT || 4000;
const app = express();

// Auto Encoders
app.use(express.json());
app.use(express.urlencoded());

app.get('/', (req, res) => {
  return res.status(200).send('Welcome to Kubernetes');
});

app.listen(PORT, ()=>{ console.log(`Listening on port ${PORT}...`); });
