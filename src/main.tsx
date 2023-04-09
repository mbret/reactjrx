import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { signal } from "./lib/signal";

const [useFoo, setFoo] = signal({
  default: 0,
});

const App = () => {
  const foo = useFoo();

  useEffect(() => {
    setFoo(5);
    setFoo((state) => state);
  }, []);

  console.log({ foo });

  return null;
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
