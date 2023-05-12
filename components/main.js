import styles from "../styles/Home.module.css";
import { useEffect, useState } from "react";
import { Contract, ethers } from "ethers";
import Map from "./map";
import Rider from "./rider";
import Driver from "./driver";
import DaoInteract from "./daoInteract";

export default function Main({ account }) {
  const [contracts, setContracts] = useState(null);
  const [accountType, setAccountType] = useState("rider");
  const [accountAuthenticated, setAccountAuthentication] = useState(false);
  const [userAccountType, setUserAccountType] = useState(null);
  const [interactWithDao, setInteractWithDao] = useState(false);

  useEffect(() => {
    const fetchContracts = async (url) => {
      const res = await fetch(url);
      const data = await res.json();
      const dataJson = JSON.parse(data);

      let contracts = {};

      for (const contract in dataJson) {
        const contractAddress = dataJson[contract].address;
        const contractAbi = dataJson[contract].abi;
        const Provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = Provider.getSigner();

        const contractInstance = new Contract(
          contractAddress,
          contractAbi,
          signer
        );

        contracts[contract] = contractInstance;
      }

      setContracts(contracts);
      return;
    };

    fetchContracts("/api/contracts");
  }, [null]);

  const login = async (e) => {
    e.preventDefault();
    if (accountType === "rider") {
      // make a view function call to the LiteRide contract
      // to check if the account is a rider
      const isRider = await contracts.LiteRide.isRider(account);

      if (!isRider) {
        alert("You are not a rider. Please sign up as a rider.");
        return;
      }

      setAccountAuthentication(true);
      setUserAccountType("rider");

      console.log(isRider);
    } else if (accountType === "driver") {
      const isDriver = await contracts.LiteRide.isDriver(account);
      console.log(isDriver);

      if (!isDriver) {
        alert("You are not a driver. Please sign up as a driver.");
        return;
      }

      setAccountAuthentication(true);
      setUserAccountType("driver");
    }
  };

  const signup = async (e) => {
    e.preventDefault();
    try {
      if (accountType === "rider") {
        // rider signup (set manual gas limit to 60000)
        const createRiderTransaction = await contracts.LiteRide.createRider({
          gasLimit: 60000,
        });

        const response = await createRiderTransaction.wait();

        if (response) {
          alert(
            "Rider account created successfully!, Please wait for the transaction to be confirmed and then login."
          );
        }
      } else if (accountType === "driver") {
        // driver signup
        const createDriveTransaction = await contracts.LiteRide.createDriver({
          gasLimit: 60000,
        });
        // get value from response
        const response = await createDriveTransaction.wait();

        if (response) {
          alert(
            "Driver account created successfully!, Please wait for the transaction to be confirmed and then login."
          );
        }
      }
    } catch (error) {
      alert("Transaction failed. Please try again.");
    }
  };

  return accountAuthenticated ? (
    <div>
      <h1 className={styles.title}>Welcome to LiteRide!</h1>
      <p className={styles.description}>Account: {account}</p>
      {interactWithDao ? (
        <></>
      ) : (
        <button
          className="flex-shrink-0 bg-blue-500 hover:bg-blue-700 border-blue-500 hover:border-blue-700 text-sm border-4 text-white py-1 px-2 rounded"
          onClick={(e) => setInteractWithDao(true)}
        >
          Interact with DAO
        </button>
      )}

      {interactWithDao ? (
        <DaoInteract account={account} contracts={contracts} />
      ) : userAccountType === "rider" ? (
        <Rider account={account} contracts={contracts} />
      ) : userAccountType === "driver" ? (
        <Driver account={account} contracts={contracts} />
      ) : null}
    </div>
  ) : (
    <div>
      <h1 className={styles.title}>Welcome to LiteRide!</h1>
      <p className={styles.description}>Account: {account}</p>
      <p>
        choose account type:{" "}
        <select onChange={(e) => setAccountType(e.target.value)}>
          <option value="rider">Rider</option>
          <option value="driver">Driver</option>
        </select>
      </p>
      <div>
        <button
          className="flex-shrink-0 bg-blue-500 hover:bg-blue-700 border-blue-500 hover:border-blue-700 text-sm border-4 text-white py-1 px-2 rounded"
          onClick={(e) => login(e)}
        >
          Login as {accountType}
        </button>
        <button
          className="flex-shrink-0 bg-teal-500 hover:bg-teal-700 border-teal-500 hover:border-teal-700 text-sm border-4 text-white py-1 px-2 rounded"
          onClick={(e) => signup(e)}
        >
          Sign up as {accountType}
        </button>
      </div>
    </div>
  );
}
