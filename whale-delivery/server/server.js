const express = require('express');
const path = require('path');
const axios = require('axios');

const PORT = 8080;

const app = express();
app.use(express.json());

app.get('*', async (req, res) => {
  async function getInfo() {
    try {
        const response = await axios.get('http://whale-create:8080/')
        const result = await response.data
        console.log(result)
        return result
    }
    catch (error) {
        console.log('error getting info', error)
    }
}
  const result = await getInfo()

  res.status(200).json(result);
});

app.listen(PORT, ()=>{console.log(`Listening on port ${PORT}...`); });