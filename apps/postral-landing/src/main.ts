import "./tailwind.css";
import "material-symbols";
import "./styles.scss";
import { Application } from "./components/app-context";
const basePath = import.meta.env.BASE_URL;
if (basePath) {
  const base = document.createElement("base");
  base.href = basePath;
  document.head.appendChild(base);
}
const app = new Application();
app.mount(document.getElementById("app")!);