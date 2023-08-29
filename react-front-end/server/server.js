const express = require('express');
const path = require('path');


const PORT = 8080;

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, '../build')));

app.get('/whale', async (req, res) => {
  async function getInfo() {
    try {
        const response = await fetch('http://web:8080/', 
        {
            method: 'GET'
        }
        )
        const result = await response.json()
        console.log(result)
        return result
    }
    catch {
        console.log('error getting info')
    }
}
  const result = await getInfo()

  res.status(200).json(result);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});



// app.get('/', (req, res) => {
//     return res.status(200).sendFile(path.join(__dirname, '../src/index.html'));
//   });

app.listen(PORT, ()=>{console.log(`Listening on port ${PORT}...`); });