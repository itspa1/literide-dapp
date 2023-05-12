import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  formatEther,
  parseEther,
  getAddress,
  keccak256,
} from "ethers/lib/utils";

export default function Driver({ account, contracts }) {
  const [rideRequests, setRideRequests] = useState([]);
  const [currentRide, setCurrentRide] = useState(null);
  const [rideStarted, setRideStarted] = useState(false);
  const [rideEnded, setRideEnded] = useState(false);

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

      // check if rideId is already in the list of ride requests
      const rideRequestExists = rideRequests.find(
        (rideRequest) => rideRequest.rideId === rideId.toString()
      );

      if (rideRequestExists) {
        return;
      }

      // add the ride request to the list of ride requests
      const parsedRequest = {
        rideId: rideId.toString(),
        rider: rider.toString(),
        distanceEstimated: distanceEstimated.toString(),
        amountEstimated: parseFloat(formatEther(amountAgreed.toString())),
        pickupCoordinates: pickupCoordinates.toString(),
        dropoffCoordinates: dropoffCoordinates.toString(),
        requestBlock: requestBlock.toString(),
      };

      const rideRequestsNew = [...rideRequests, parsedRequest];

      setRideRequests(rideRequestsNew);
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

      if (driver.toString() === getAddress(account).toString()) {
        const acceptedRide = {
          rideId: rideId.toString(),
          distanceEstimated: distanceEstimated.toString(),
          amountEstimated: parseFloat(formatEther(amountAgreed.toString())),
          pickupCoordinates: pickupCoordinates.toString(),
          dropoffCoordinates: dropoffCoordinates.toString(),
          requestBlock: requestBlock.toString(),
          acceptedBlock: acceptedBlock.toString(),
          rider: rider.toString(),
        };

        setCurrentRide(acceptedRide);
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
      console.log(
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
      );

      console.log(rideId.toString(), currentRide);

      if (currentRide && rideId.toString() === currentRide.rideId.toString()) {
        const startedRide = {
          rideId: rideId.toString(),
          distanceEstimated: distanceEstimated.toString(),
          amountEstimated: parseFloat(formatEther(amountAgreed.toString())),
          pickupCoordinates: pickupCoordinates.toString(),
          dropoffCoordinates: dropoffCoordinates.toString(),
          requestBlock: requestBlock.toString(),
          acceptedBlock: acceptedBlock.toString(),
          startedBlock: startedBlock.toString(),
          rider: rider.toString(),
        };

        setRideStarted(true);
        setCurrentRide(startedRide);
      }
    }
  );

  contracts.LiteRide.on("RideEnded", (rideId, driver, rider) => {
    if (currentRide && driver.toString() === getAddress(account).toString()) {
      setRideEnded(true);
      setCurrentRide(null);

      // set rideRequests to empty array, so that it can be refetched
      setRideRequests([]);
    }
  });

  useEffect(() => {
    const fetchRideRequests = async () => {
      const rideRequests = [];
      const requests = await contracts.LiteRide.getRideRequests();

      for (const request of requests) {
        // parse the request data
        if (request.rider !== ethers.constants.AddressZero) {
          const parsedRequest = {
            rider: request.rider,
            distanceEstimated: request.distanceEstimated.toString(),
            amountEstimated: parseFloat(
              formatEther(request.amountEstimate.toString())
            ),
            pickupCoordinates: request.pickupCoordinates || null,
            destinationCoordinates: request.dropoffCoordinates || null,
            requestBlock: request.requestBlock.toString(),
          };

          rideRequests.push(parsedRequest);
        }
      }

      setRideRequests(rideRequests);
    };

    fetchRideRequests();
  }, [null]);

  useEffect(() => {
    const fetchCurrentRide = async () => {
      const currentRide = await contracts.LiteRide.getActiveRide();

      if (currentRide.driver !== ethers.constants.AddressZero) {
        const parsedRide = {
          rider: currentRide.rider,
          driver: currentRide.driver,
          distanceEstimated: currentRide.distanceEstimated.toString(),
          amountEstimated: parseFloat(
            formatEther(currentRide.amountEstimate.toString())
          ),
          pickupCoordinates: currentRide.pickupCoordinates || null,
          destinationCoordinates: currentRide.dropoffCoordinates || null,
          requestBlock: currentRide.requestBlock.toString(),
          acceptedBlock: currentRide.acceptedBlock.toString(),
          startedBlock: currentRide.startBlock.toString(),
          endBlock: currentRide.endBlock.toString(),
        };

        if (currentRide.startBlock.toString() !== "0") {
          setRideStarted(true);
        }

        setCurrentRide(parsedRide);
      }
    };

    fetchCurrentRide();
  }, [null, rideStarted]);

  const acceptRequest = async (request) => {
    try {
      console.log(request);

      const tx = await contracts.LiteRide.acceptRide(
        request.rider,
        request.requestBlock,
        {
          gasLimit: 1000000,
        }
      );

      const response = await tx.wait();

      console.log(response);
    } catch (error) {
      console.error(error);
    }
  };

  const startRide = async () => {
    try {
      const tx = await contracts.LiteRide.startRide(
        currentRide.rider,
        currentRide.requestBlock,
        {
          gasLimit: 1000000,
        }
      );

      const response = await tx.wait();

      console.log(response);
    } catch (error) {
      console.error(error);
    }
  };

  const endRide = async () => {
    try {
      const distanceRecorded = prompt("Enter the distance travelled in miles");

      if (distanceRecorded) {
        const distance = Math.floor(parseFloat(distanceRecorded));

        const tx = await contracts.LiteRide.endRide(
          currentRide.rider,
          currentRide.requestBlock,
          distance,
          {
            gasLimit: 1000000,
          }
        );

        const response = await tx.wait();

        console.log(response);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      {currentRide ? (
        <div className="bg-white py-24 sm:py-32">
          <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-20 px-6 lg:px-8 xl:grid-cols-3">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Current Ride
              </h2>
              <div className="block rounded-lg bg-white p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] light:bg-neutral-700">
                <h5 className="mb-2 text-xl font-medium leading-tight text-neutral-900">
                  {rideStarted ? "Ride Started" : "Ride Accepted"} @{" "}
                  {rideStarted
                    ? currentRide.startedBlock
                    : currentRide.acceptedBlock}
                </h5>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Rider:</b> {currentRide.rider}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Distance Estimated:</b> {currentRide.distanceEstimated}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Amount Estimated:</b> {currentRide.amountEstimated}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Pickup Coordinates:</b> {currentRide.pickupCoordinates}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Dropoff Coordinates:</b> {currentRide.dropoffCoordinates}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Request Block:</b> {currentRide.requestBlock}
                </p>
                {rideStarted ? (
                  <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                    <b>Accepted Block:</b> {currentRide.acceptedBlock}
                  </p>
                ) : null}
                {rideStarted ? (
                  <button
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                    onClick={endRide}
                  >
                    End Ride
                  </button>
                ) : (
                  <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={startRide}
                  >
                    Start Ride
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : rideRequests.length > 0 ? (
        <div className="bg-white py-24 sm:py-32">
          <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-20 px-6 lg:px-8 xl:grid-cols-3">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Available Ride Requests
              </h2>
            </div>
            {rideRequests.map((request, index) => (
              <div
                className="block rounded-lg bg-white p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] light:bg-neutral-700"
                id={index}
                key={index}
              >
                <h5 className="mb-2 text-xl font-medium leading-tight text-neutral-800 light:text-neutral-50">
                  Ride Request #{index + 1} @ Block {request.requestBlock}
                </h5>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Rider:</b> {request.rider}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Pickup:</b> {request.pickupCoordinates}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Destination:</b> {request.destinationCoordinates}
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Distance:</b> {request.distanceEstimated} miles
                </p>
                <p className="mb-4 text-base text-neutral-600 light:text-neutral-200">
                  <b>Estimated Amount:</b> {request.amountEstimated} LTR
                </p>
                <button
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  onClick={() => acceptRequest(request)}
                >
                  Accept Ride Request
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p>No ride requests</p>
      )}
    </div>
  );
}
