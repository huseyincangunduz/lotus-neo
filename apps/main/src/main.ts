import "./tailwind.css";
import "material-symbols";
import "./styles.scss";
import { Application } from "./components/app-context";

const app = new Application();
app.mount(document.getElementById("app")!);