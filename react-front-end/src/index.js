import React from "react";
import { createRoot } from "react-dom/client";
import App2 from './App.jsx'

const App = () => {
    return (
      // <div>i am a div</div>
      <App2></App2>
    );
  }

const root = createRoot(document.querySelector("#root"));
root.render(<App />);
