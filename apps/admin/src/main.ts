import "./tailwind.css";
import "./styles.scss";
import { AppComponent } from "./components/app";

const app = new AppComponent();
app.mount(document.getElementById("app")!);