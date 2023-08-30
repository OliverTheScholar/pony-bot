const express = require('express');
const app = express();
const fs = require('fs');
const port = 3000;
const k8s = require('@kubernetes/client-node');
const fetch = require('node-fetch');
const yaml = require('js-yaml');
const path = require("path");

//we have to install node-fetch because fetch is not built into node by default, the browser on the front end has it built in though
// Initialize Kubernetes API client
const kc = new k8s.KubeConfig();
kc.loadFromDefault();


const k8sApi = kc.makeApiClient(k8s.CoreV1Api);



app.use(express.json());

const manifestChecker = async () => {

  // Create an instance of the KubernetesObjectApi
  const k8sApi = kc.makeApiClient(k8s.KubernetesObjectApi);
  try {
    // Try to get the existing resource
    const manny = await k8sApi.read(yaml.loadAll(fs.readFileSync(path.resolve(__dirname, './ServiceAccountCreation.yaml'), 'utf8')));
    console.log(manny)
  } catch (error) {
      console.log(error)
  }
};

manifestChecker();



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

    // If it already exists, replace it
    await k8sApi.replace(manifest);
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
    console.log('result: ', result.body)
    const metricsAPI = result.body.find(group => group.name === 'metrics.k8s.io');

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
if (!checkMetricsServer()) {
  //install metrics server
  //this function applies an obj to the kubernetes cluster (in this case it's what's in the yaml file)
  async function applyYaml(obj) {
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
        await applyYaml(obj);
      }
  
      console.log('Metrics Server installed successfully.');
    } catch (err) {
      console.error('Failed to install Metrics Server:', err);
    }
  }
  
  installMetricsServer();

};

//GET PODS

const getPods = () => {
  k8sApi.listPodForAllNamespaces().then((res) => {
    console.log('Pods in all namespaces:');
    res.body.items.forEach((pod) => {
        console.log(`${pod.metadata.namespace}/${pod.metadata.name}`);
    });
})
.catch((err) => {
    console.error('Error:', err);
}); 
};

getPods();

//GET NODES
const getNodes = () => {
  k8sApi.listNode().then((res) => {
    console.log('Nodes:');
    res.body.items.forEach((node) => {
        console.log(node.metadata.name);
    });
})
.catch((err) => {
    console.error('Error:', err);
});
};

getNodes();

//GET CONTAINERS

const getContainers = () => {
  //queries for every pod, then pulls each container out of the pod and lists each individually...this will probably have to move to a sql database
  k8sApi.listPodForAllNamespaces().then((res) => {
    console.log('Containers in all namespaces:');
    
    res.body.items.forEach((pod) => {
        // each of these pods can/will have multiple containers so we have to iterate through it again
        const containers = pod.spec.containers;
        containers.forEach((container) => {
            console.log(`Namespace: ${pod.metadata.namespace}, Pod: ${pod.metadata.name}, Container: ${container.name}`);
        });
    });
    return next();
})
.catch((err) => {
    console.error('Error:', err);
});
};



app.get('/', (req, res) => {
  res.send('Hello, Kubernetes world!');
});


//global error handler
app.use((err, req, res, next) => {
  console.log("global error occurred!", err);
  const defaultErr = {
    log: "Express error handler caught unknown middleware error",
    status: 400,
    message: { err: "An error occurred" },
  };
  const errorObj = Object.assign(defaultErr, err);
  console.log("errorObj ->", errorObj);
  res.status(errorObj.status).send(JSON.stringify(errorObj.message));
  // res.status(errorObj.status).json(errorObj.message); does the same thing
});

app.listen(port, () => {
  console.log(`Server is listening on Port: ${port}!`);
});