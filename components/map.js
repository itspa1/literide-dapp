import { useState, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

mapboxgl.accessToken = process.env.MAPBOX_ACCESS || "";

export default function Map(props) {
  const { pickup, dropoff, setDropoff } = props;
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v12",
      center: pickup,
      zoom: 12,
    });

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      flyTo: false,
      placeholder: "Search Dropoff",
    });

    geocoder.on("result", function (e) {
      console.log(e);
      setDropoff(e.result.center);
    });

    map.addControl(geocoder);

    const pickupMarker = new mapboxgl.Marker({ color: "#FF0000" })
      .setLngLat(pickup)
      .addTo(map);

    if (dropoff.length) {
      const dropoffMarker = new mapboxgl.Marker({ color: "#0000FF" })
        .setLngLat(dropoff)
        .addTo(map);
    }
  }, [pickup, dropoff]);

  return <div id="map" className="mapWrapper"></div>;
}
