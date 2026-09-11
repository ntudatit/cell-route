import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CccProvider } from "./providers";
import { AuthProvider } from "./auth/AuthProvider";
import "./styles.css";
import "./landing.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <CccProvider>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </CccProvider>,
);
import "./azure.css";
