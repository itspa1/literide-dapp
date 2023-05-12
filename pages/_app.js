import "../styles/globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { AppWrapper } from "../lib/context";

global.XMLHttpRequest = require("xhr2");

function Application({ Component, pageProps }) {
  return (
    <AppWrapper>
      <Component {...pageProps} />
    </AppWrapper>
  );
}

export default Application;
