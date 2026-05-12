import "./tailwind.css";
import "material-symbols";
import { Application } from "./components/app-context";

const app = new Application();
app.mount(document.getElementById("app")!);