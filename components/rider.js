import { useState, useEffect } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import Map from "./map";
import {
  formatEther,
  getAddress,
  parseEther,
  parseUnits,
} from "ethers/lib/utils";
import { ethers } from "ethers";

const accessToken = process.env.MAPBOX_ACCESS || "";

export default function Rider(props) {
  const { contracts, account } = props;

  const [pickup, setPickup] = useState([]);
  const [dropoff, setDropoff] = useState([]);
  const [tripEstimate, setTripEstimate] = useState({});
  const [activeRide, setActiveRide] = useState(null);

  // setup the event listeners for the contract
  contracts.LiteRide.on(
    "RideRequested",
    (
      rideId,
      driver,
      rider,
      distanceEstimated,
      amountAgreed,
      pickupCoordinates,
      dropoffCoordinates,
      requestBlock
    ) => {
      console.log(
        rideId,
        driver,
        rider,
        distanceEstimated,
        amountAgreed,
        pickupCoordinates,
        dropoffCoordinates,
        requestBlock
      );
    }
  );

  contracts.LiteRide.on(
    "RideAccepted",
    (
      rideId,
      driver,
      rider,
      distanceEstimated,
      amountAgreed,
      pickupCoordinates,
      dropoffCoordinates,
      requestBlock,
      acceptedBlock
    ) => {
      console.log(
        rideId,
        driver,
        rider,
        distanceEstimated,
        amountAgreed,
        pickupCoordinates,
        dropoffCoordinates,
        requestBlock,
        acceptedBlock
      );

      if (rider.toString() === getAddress(account).toString()) {
        const acceptedRide = {
          rideId: rideId.toString(),
          driver: driver.toString(),
          distanceEstimated: distanceEstimated.toString(),
          amountEstimated: parseFloat(formatEther(amountAgreed.toString())),
          pickupCoordinates: pickupCoordinates.toString(),
          dropoffCoordinates: dropoffCoordinates.toString(),
          requestBlock: requestBlock.toString(),
          acceptedBlock: acceptedBlock.toString(),
        };

        setActiveRide(acceptedRide);
      }
    }
  );

  contracts.LiteRide.on(
    "RideStarted",
    (
      rideId,
      driver,
      rider,
      distanceEstimated,
      amountAgreed,
      pickupCoordinates,
      dropoffCoordinates,
      requestBlock,
      acceptedBlock,
      startedBlock
    ) => {
      if (activeRide && activeRide.rideId.toString() === rideId.toString()) {
        const startedRide = {
          rideId: rideId.toString(),
          driver: driver.toString(),
          distanceEstimated: distanceEstimated.toString(),
          amountEstimated: parseFloat(formatEther(amountAgreed.toString())),
          pickupCoordinates: pickupCoordinates.toString(),
          dropoffCoordinates: dropoffCoordinates.toString(),
          requestBlock: requestBlock.toString(),
          acceptedBlock: acceptedBlock.toString(),
          startedBlock: startedBlock.toString(),
        };

        setActiveRide(startedRide);
      }
    }
  );

  contracts.LiteRide.on("RideEnded", (rideId) => {
    if (activeRide && activeRide.rideId.toString() === rideId.toString()) {
      setActiveRide(null);
    }
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then(function (result) {
          if (result.state == "granted") {
            navigator.geolocation.getCurrentPosition(function (position) {
              setPickup([position.coords.longitude, position.coords.latitude]);
            });
          } else if (result.state == "prompt") {
            navigator.geolocation.getCurrentPosition(function (position) {
              setPickup([position.coords.longitude, position.coords.latitude]);
            });
          } else if (result.state == "denied") {
            // no geolocation
          }
          result.onchange = function () {
            console.log(result.state);
          };
        })
        .catch(function (err) {
          console.error(err);
        });
    }
  }, []);

  useEffect(() => {
    const getActiveRide = async () => {
      const activeRide = await contracts.LiteRide.getActiveRide();

      if (activeRide.rider !== ethers.constants.AddressZero) {
        const parsedRide = {
          driver: activeRide.driver.toString(),
          rider: activeRide.rider.toString(),
          distanceEstimated: activeRide.distanceEstimated.toString(),
          amountAgreed: parseFloat(
            formatEther(activeRide.amountEstimate.toString())
          ),
          pickupCoordinates: activeRide.pickupCoordinates,
          dropoffCoordinates: activeRide.dropoffCoordinates,
          requestBlock: activeRide.requestBlock.toString(),
          acceptedBlock: activeRide.acceptedBlock.toString(),
          startBlock: activeRide.startBlock.toString(),
          endBlock: activeRide.endBlock.toString(),
        };

        setActiveRide(parsedRide);
      }
    };

    getActiveRide();
  }, [contracts, account]);

  const getDistanceBetween = async (pickup, dropoff) => {
    const query = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${pickup[0]},${pickup[1]};${dropoff[0]},${dropoff[1]}?steps=true&geometries=geojson&access_token=${accessToken}`,
      { method: "GET" }
    );

    const response = await query.json();

    if (response.routes.length) {
      const bestRoute = response.routes[0];
      const distanceInMeters = bestRoute.distance;
      const durationInSeconds = bestRoute.duration;

      const distanceInMiles = distanceInMeters * 0.000621371;
      const durationInMinutes = durationInSeconds / 60;

      return {
        distanceInMiles,
        durationInMinutes,
      };
    }

    return null;
  };

  const getTripEstimateAndSetDropoff = async (dropoff) => {
    const baseFee = await contracts.LiteRide.getBaseFee();
    const distanceFee = await contracts.LiteRide.getDistanceFee();
    const baseFeeDistance = await contracts.LiteRide.getBaseFeeDistance();

    const response = await getDistanceBetween(pickup, dropoff);

    const baseFeeNumber = parseFloat(formatEther(baseFee));
    const distanceFeeNumber = parseFloat(formatEther(distanceFee));
    const baseFeeDistanceNumber = baseFeeDistance.toNumber();

    console.log("baseFeeNumber", baseFeeNumber);
    console.log("distanceFeeNumber", distanceFeeNumber);
    console.log("baseFeeDistanceNumber", baseFeeDistanceNumber);

    if (response) {
      let { distanceInMiles, durationInMinutes } = response;

      // floor the distanceInMiles, because solidity doesn't support floats
      distanceInMiles = Math.floor(distanceInMiles);

      console.log("distanceInMiles", distanceInMiles);
      console.log("durationInMinutes", durationInMinutes);

      if (distanceInMiles < baseFeeDistanceNumber) {
        const estimate = baseFeeNumber;
        setTripEstimate({ estimate, distanceInMiles, durationInMinutes });
        setDropoff(dropoff);
        return;
      }

      const remainingDistance = distanceInMiles - baseFeeDistanceNumber;
      console.log("remainingDistance", remainingDistance);
      const distanceFeeForRemainingDistance =
        remainingDistance * distanceFeeNumber;
      console.log(
        "distanceFeeForRemainingDistance",
        distanceFeeForRemainingDistance
      );

      const estimate = baseFeeNumber + distanceFeeForRemainingDistance;

      console.log("estimate", estimate);
      setTripEstimate({ estimate, distanceInMiles, durationInMinutes });
      setDropoff(dropoff);
      return;
    }

    setDropoff(dropoff);
  };

  const requestRide = async (e) => {
    try {
      e.preventDefault();
      console.log("requesting ride");
      console.log("trip estimate", tripEstimate);

      const tripEstimateBigNumber = parseEther(
        tripEstimate.estimate.toString()
      );

      // make a transaction to the LiteRide contract
      // first to approve the contract to spend the rider's tokens
      // then to request a ride

      const approveTokenTransaction = await contracts.LiteRideToken.approve(
        contracts.LiteRide.address,
        tripEstimateBigNumber
      );

      const approveToken = await approveTokenTransaction.wait();

      console.log("approveToken", approveToken);

      console.log("trip estimate", tripEstimate);

      const pickupCoordinatesInString = `${pickup[0]},${pickup[1]}`;
      const dropoffCoordinatesInString = `${dropoff[0]},${dropoff[1]}`;

      const requestRideTransaction = await contracts.LiteRide.requestRide(
        account,
        tripEstimate.distanceInMiles,
        tripEstimateBigNumber,
        pickupCoordinatesInString,
        dropoffCoordinatesInString,
        {
          gasLimit: 1000000,
        }
      );

      const requestRide = await requestRideTransaction.wait();

      console.log(requestRide);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      {activeRide ? (
        <div className="bg-white py-24 sm:py-32">
          <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-20 px-6 lg:px-8 xl:grid-cols-3">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Current Ride
              </h2>
              <div className="block rounded-lg bg-white p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] light:bg-neutral-700">
                <h5 className="mb-2 text-xl font-medium leading-tight text-neutral-900">
                  {activeRide.startBlock !== 0
                    ? "Ride Started "
                    : "Ride Accepted "}
                  @ Block{" "}
                  {activeRide.startBlock !== 0
                    ? activeRide.startBlock
                    : activeRide.acceptedBlock}
                </h5>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Driver:</b> {activeRide.driver}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Distance Estimated:</b> {activeRide.distanceEstimated}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Amount Estimated:</b> {activeRide.amountAgreed}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Pickup Coordinates:</b> {activeRide.pickupCoordinates}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Dropoff Coordinates:</b> {activeRide.dropoffCoordinates}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Request Block:</b> {activeRide.requestBlock}
                </p>
                {activeRide.acceptedBlock !== 0 && (
                  <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                    <b>Accepted Block:</b> {activeRide.acceptedBlock}
                  </p>
                )}
                {activeRide.startBlock !== 0 && (
                  <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                    <b>Start Block:</b> {activeRide.startBlock}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : pickup.length > 0 ? (
        <div>
          <Map
            pickup={pickup}
            dropoff={dropoff}
            setDropoff={getTripEstimateAndSetDropoff}
          />
          {tripEstimate.estimate ? (
            <div id="search-dropoff">
              <h2>Estimate</h2>
              <p>
                <b>Price:</b> {tripEstimate.estimate} LTR
              </p>
              <p>
                <b>Distance:</b> {tripEstimate.distanceInMiles.toFixed(2)} miles
              </p>
              <p>
                <b>Duration:</b> {tripEstimate.durationInMinutes.toFixed(2)}{" "}
                minutes
              </p>
              <button
                className="flex-shrink-0 bg-red-500 hover:bg-red-700 border-red-500 hover:border-red-700 text-sm border-4 text-white py-1 px-2 rounded"
                onClick={requestRide}
              >
                Request Ride
              </button>
            </div>
          ) : (
            ""
          )}
          {/* <div id="search-dropoff">
            <h2>Search Dropoff</h2>
            <AddressAutofill
              accessToken={accessToken}
              onRetrieve={(e) => console.log(e)}
            >
              <input type="text" placeholder="Dropoff" />
            </AddressAutofill>
          </div> */}
        </div>
      ) : (
        "Please enable geolocation in your browser"
      )}
    </div>
  );
}
