import React, { useState, useEffect } from "react";

const App = () => {

    const [data, setData] = useState();
    async function getInfo() {
        try {
            const response = await fetch('http://web:8080/', 
            {
                method: 'GET'
            }
            )
            const result = await response.json()
            setData(result)
            console.log(result)
        }
        catch {
            console.log('error getting info')
        }
    }
   
    useEffect(() => {
        getInfo()
    }, [])
    console.log('THE DATA IS')
    return (
        <div> 
            <div style={styles.title}> Welcome to pod one!</div>
            <div style={styles.title}>{'THE DATA IS ' + data}</div>
            <div style={styles.title}> Welcome to pod two!</div>
        </div>
    )
}
const styles = {
    title: {
        color: 'red',
        backgroundColor: 'blue'
    }
}

export default App;