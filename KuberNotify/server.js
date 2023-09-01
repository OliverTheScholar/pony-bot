const express = require('express');
const app = express();
const fs = require('fs');
const port = 6000;
const k8s = require('@kubernetes/client-node');
const fetch = require('node-fetch');
const yaml = require('js-yaml');
const path = require("path");
const readline = require('readline');
const colors = require('colors');

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

//we have to install node-fetch because fetch is not built into node by default, the browser on the front end has it built in though
// Initialize Kubernetes API client
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);


const manifestChecker = async () => {

  // Create an instance of the KubernetesObjectApi
  const k8sApi = kc.makeApiClient(k8s.KubernetesObjectApi);
  try {
    // Try to get the existing resource
    console.log('manny: ', yaml.loadAll(fs.readFileSync(path.resolve(__dirname, './ServiceAccountCreation.yaml'), 'utf8'))[0])

    const manny = await k8sApi.read(yaml.loadAll(fs.readFileSync(path.resolve(__dirname, './ServiceAccountCreation.yaml'), 'utf8'))[0]);
  } catch (error) {
      console.log('Error in manifestChecker: ', error)
  }
};

// manifestChecker();



//apply the ServiceAccountCreation.yaml file using 'kubectly apply -f <file-name.yaml>
//then specify this Service Account in the application's Pod template

//I'm pretty sure pod.yaml creates a pod with the right service account...I think you can run this after the pod is even created and it'll just apply the appropriate/updated permissions?
/////



// Function to apply ServiceAccountCreate.yaml
async function applyKubernetesObject(yamlPath) {
  kc.loadFromCluster();  // Use in-cluster configuration

  // Create an instance of the KubernetesObjectApi
  const k8sApi = kc.makeApiClient(k8s.KubernetesObjectApi);
  
  // Read the YAML file
  //this might be yaml.load insteald of .loadAll, i changed it and it got rid of an error about multiple things but we only have one...I think
  const manifest = yaml.loadAll(fs.readFileSync(path.resolve(__dirname, yamlPath), 'utf8'));

  try {
    // Try to get the existing resource
    await k8sApi.read(manifest);
    // for (let i = 0; i < manifest.length; i++) {
    //   await k8sApi.replace(manifest[i]);
    // }
    // If it already exists, replace itc
    await k8sApi.replace(manifest)
    // for (const obj of manifest) {
    //   await applyYaml(obj);
    // }
    console.log(`Replaced existing ${manifest.kind}: ${manifest.metadata.name}`);
  } catch (error) {
    if (error.response && error.response.statusCode === 404) {
      // If the resource does not exist, create it
      await k8sApi.create(manifest);
      console.log(`Created new ${manifest.kind}: ${manifest.metadata.name}`);
    } else {
      // Log other errors
      console.error(`Failed to apply ${manifest.kind}: ${error}`);
    }
  }
}

// call and apply the Service Account Creation file

// applyKubernetesObject('./ServiceAccountCreation.yaml');



/////
//this function checks to see if Metrics Server is already installed
  //if installed console.logs(metrics server is installed)
    //else metricsAPI needs to be installed
async function checkMetricsServer() {
  const api = kc.makeApiClient(k8s.CoreV1Api);

  try {
    const result = await api.getAPIResources();
    const metricsAPI = result.body.resources.find(group => group.name === 'metrics.k8s.io');

    if (metricsAPI) {
      console.log("Metrics Server is installed.");
      return true;
    } else {
      console.log("Metrics Server is not installed.");
      return false;
    }
  } catch (error) {
    console.error("Failed to retrieve API groups:", error);
    return false;
  }
}


// this calls the above function and returns true or false, if it's false, it should install it
const metricServerInstaller = async () => {
  const result = await checkMetricsServer();
  if (result) {//install metrics server
    //this function applies an obj to the kubernetes cluster (in this case it's what's in the yaml file)
    async function applyYaml(obj) {
      console.log('in applyYaml function')
      const api = kc.makeApiClient(k8s.KubernetesObjectApi);
      obj.metadata.namespace = obj.metadata.namespace || 'default';
      try {
        await api.read(obj);
        await api.replace(obj);
      } catch (err) {
        if (err.response && err.response.statusCode === 404) {
          await api.create(obj);
        } else {
          console.error('Unknown error:', err);
        }
      }
    }
    // this function gets the yaml file from the metrics server git hub, parses and stores it in local memory, then calls the above function to apply it
    async function installMetricsServer() {
      try {
        // Fetch the Metrics Server YAML manifest from GitHub
        const response = await fetch('https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml');
        const text = await response.text();
    
        // Parse the YAML manifest
        const manifest = yaml.loadAll(text);
    
        // Apply each Kubernetes object from the manifest
        for (const obj of manifest) {
          await api.create(obj);
        }
    
        console.log('Metrics Server installed successfully.');
      } catch (err) {
        console.error('Failed to install Metrics Server:', err);
      }
    }
    
    installMetricsServer();}
  
};

metricServerInstaller();

//GET PODS

const getPods = () => {
  k8sApi.listPodForAllNamespaces().then((res) => {
    console.log('Pods:'.cyan);
    res.body.items.forEach((pod) => {
        // console.log(`${pod.metadata.namespace}/${pod.metadata.name}`);
        console.log(`   ${pod.metadata.name}`);
    });
})
.catch((err) => {
    console.error('Error:', err);
}); 
};

// getPods();

//GET NODES
const getNodes = () => {
  k8sApi.listNode().then((res) => {
    console.log('Nodes:'.cyan);
    res.body.items.forEach((node) => {
        console.log(`   ${node.metadata.name}`);
    });
})
.catch((err) => {
    console.error('Error:', err);
});
};

// getNodes();

//GET CONTAINERS

const getContainers = () => {
  //queries for every pod, then pulls each container out of the pod and lists each individually...this will probably have to move to a sql database
  k8sApi.listPodForAllNamespaces().then((res) => {
    console.log('Containers:'.cyan);
    
    res.body.items.forEach((pod) => {
        // each of these pods can/will have multiple containers so we have to iterate through it again
        const containers = pod.spec.containers;
        containers.forEach((container) => {
            // console.log(`Namespace: ${pod.metadata.namespace}, Pod: ${pod.metadata.name}, Container: ${container.name}`);
            console.log(`   ${container.name}`);
        });
    });
})
.catch((err) => {
    console.error('Error:', err);
});
};

// getContainers();

let intervalID;

const dbPull = async () => {
    const result = await prisma.Pods.findMany();
    return result
}
const dbAdd = async (podname) => {
  await prisma.Pods.create({data: {name: podname}})
}

const podChecker = async () => {
  intervalID = setInterval(async () => {
    //query for pod list
    const currentPods = await dbPull();
    k8sApi.listPodForAllNamespaces().then((res) => {
      const nameArray = []
      res.body.items.forEach((pod) => {
        //this is an array of objects with property 'name'
        nameArray.push(pod.metadata.name)
        
        let found = false;
        // console.log('length: ', currentPods.length)
        // console.log(currentPods)
        for (let i = 0; i < currentPods.length; i++) {
          if (currentPods[i].name === pod.metadata.name) {found = true};
          
          // console.log('currentPod in db: ', currentPods[i], 'checking against: ', pod.metadata.name)
        }
        
        // console.log('')
           //query from database
            //database returns an array of objects
           //if pod is not in database, add to database and log that it was created
           //if existing pod in database is not in query, delete it from database, and log that it was destroyed
        if (!found) {
          dbAdd(pod.metadata.name);
          console.log(`Added ${pod.metadata.name} to cluster`.green);
        }
        
      });
      return nameArray
  }).then(async (res) => {
    //res is an array
    for (let i = 0; i < currentPods.length; i++) {
      if (!res.includes(currentPods[i].name)){
        console.log (`${currentPods[i].name} has crashed!`.red)
        await prisma.Pods.deleteMany({
          where: {
            name: currentPods[i].name
          }
        })
      }
    }
  }

  )
  .catch((err) => {
      console.error('Error:', err);
  }); 


   

  }, 1000)
};

const stopPodCheck = () => {
  clearInterval(intervalID)
};


// app.get('/', (req, res) => {
//   res.send('Hello, Kubernetes world!');
// });


// //global error handler
// app.use((err, req, res, next) => {
//   console.log("global error occurred!", err);
//   const defaultErr = {
//     log: "Express error handler caught unknown middleware error",
//     status: 400,
//     message: { err: "An error occurred" },
//   };
//   const errorObj = Object.assign(defaultErr, err);
//   console.log("errorObj ->", errorObj);
//   res.status(errorObj.status).send(JSON.stringify(errorObj.message));
//   // res.status(errorObj.status).json(errorObj.message); does the same thing
// });

//more cli interface stuff:
//readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


const dog = `░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓▒▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░░░░░░░░░░░░░
░░░░░░░░░░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒░░░░░░░░░░░░░░░░░░▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░
░░░░░░░░░░▓▓▓▓▓▓░░░░▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░░░▓▓▓▓▓▒░░░░░░░░░░░░
░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒░░░░░░░░░░░▒▓▓▓▓▓░░░░░░░░░░░░
░░░░░░░░░▒▓▓▓▓▓░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░▓▓▓▓▓░░░░░░░░░░░░
░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░
░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓░░░░░░░░░░░░▒▓▓▓▓▓░░░░░░░░░░░
░░░░░░░░▒▓▓▓▓▓░░░░░░░░░░░▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░▒▓▓▓▓▓▒░░░░░░░░░░
░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░
░░░░░░░░▓▓▓▓▓░░░░░░░░░▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░▒▓▓▓▓▓░░░░░░░░░░
░░░░░░░▒▓▓▓▓▓░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓░░░░░░░░▓▓▓▓▓▒░░░░░░░░░
░░░░░░░▓▓▓▓▓▒░░░░░░▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░▓▓▓▓▓▓░░░░░░░░░
░░░░░░▒▓▓▓▓▓░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓░░░░░▒▓▓▓▓▓░░░░░░░░░
░░░░░░▓▓▓▓▓▓░░░░▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▒░░░░▓▓▓▓▓▒░░░░░░░░
░░░░░░▓▓▓▓▓▒░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░▒▓▓▓▓▓░░░░░░░░
░░░░░▒▓▓▓▓▓░░▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▒░░▓▓▓▓▓░░░░░░░░
░░░░░▓▓▓▓▓▓▒▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▒▓▓▓▓▓▒░░░░░░░
░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░▓▓▓▓▒░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▒░░░░░░░
░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░▒▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▒░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░
░░░░░░░░▒▓▓▓▒▓▓▓▓▓▓░░░░░░░░▒▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▓▒░░░░░░░░▓▓▓▓▓▒▒▓▓▓▒░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░▒▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▒░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░▒▓▓▓▒░░░░░░▒▓▓▓▒░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▒░░▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░▓▓▓▓▓░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▒▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░▒▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░░▒▒▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
`

console.log(dog.cyan);

console.log('Welcome to the Watchdog CLI. Type "help" for commands.'.cyan);


const promptForCommand = () => {
  rl.question('> ', (command) => {
    switch (command.trim().toLowerCase()) {
      case 'watchdog get pods':
        // console.log('Getting pods!');
        getPods();
        break;

      case 'watchdog get containers':
        // console.log('Getting containers!');
        getContainers();
        break;

      case 'watchdog get nodes':
        // console.log('Getting nodes!');
        getNodes();
        break;

      case 'watchdog help':
        console.log('Try asking me to "Watchdog Get Pods", "Watchdog Get Containers", "Watchdog Get Nodes", or "Watchdog Quit" to exit.');
        break;

      case 'watchdog watch pods':
        console.log('Watchdog is watching over your pods!'.cyan);
        podChecker();
        break;

      case 'watchdog stop':
        console.log('Watchdog is taking a break from pod watching');
        stopPodCheck();
        break;

      case 'watchdog quit':
        console.log('Goodbye!');
        rl.close();
        return;

      default:
        console.log('Unknown command. Type "help" for available commands.');
    }

    promptForCommand(); // Continue prompting
  });
};

promptForCommand();



app.listen(port, () => {
  console.log(`Server is listening on Port: ${port}!`);
});