import styles from "../styles/Home.module.css";
import { useEffect, useState, Fragment } from "react";
import { formatEther, getAddress, parseEther } from "ethers/lib/utils";
import { ethers } from "ethers";
import { Dialog, Transition } from "@headlessui/react";

const parametersAvailableToChange = [
  { id: 0, name: "select", value: "none", type: "none" },
  { id: 1, name: "Base Fee", value: "baseFee", type: "number" },
  {
    id: 2,
    name: "Base Fee Distance",
    value: "baseFeeDistance",
    type: "number",
  },
  { id: 3, name: "Distance Fee", value: "distanceFee", type: "number" },
  { id: 4, name: "DAO Fee", value: "daoFee", type: "number" },
];

const states = {
  0: "Pending",
  1: "Active",
  2: "Canceled",
  3: "Defeated",
  4: "Succeeded",
  5: "Queued",
  6: "Expired",
  7: "Executed",
};

export default function DaoInteract({ account, contracts }) {
  const [liteRideParameters, setLiteRideParameters] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [currentBlock, setCurrentBlock] = useState(null);

  let [isOpen, setIsOpen] = useState(false);

  // proposal form
  const [description, setDescription] = useState("");
  const [parameterSelected, setParameterSelected] = useState(
    parametersAvailableToChange[0]
  );
  const [parameterChangeValue, setParameterChangeValue] = useState(0);

  function closeModal() {
    setIsOpen(false);
  }

  function openModal() {
    setIsOpen(true);
  }

  // event listeners
  contracts.LiteRideGovernor.on(
    "ProposalCreated",
    (
      proposalId,
      proposer,
      targets,
      values,
      signatures,
      calldatas,
      startBlock,
      endBlock,
      description
    ) => {
      console.log("ProposalCreated");
      console.log(
        proposalId,
        proposer,
        targets,
        values,
        signatures,
        calldatas,
        startBlock,
        endBlock,
        description
      );

      const proposal = {
        proposalId: proposalId.toHexString(),
        proposer,
        targets,
        values,
        signatures,
        calldatas,
        startBlock: startBlock.toString(),
        endBlock: endBlock.toString(),
        description,
      };

      setProposals([...proposals, proposal]);
    }
  );

  const fetchParameters = async (url) => {
    const daoFee = await contracts.LiteRide.daoFee();
    const baseFee = await contracts.LiteRide.baseFee();
    const baseFeeDistance = await contracts.LiteRide.baseFeeDistance();
    const distanceFee = await contracts.LiteRide.distanceFee();
    const daoBalance = await contracts.LiteRideToken.balanceOf(
      contracts.LiteRideTimelock.address
    );

    setLiteRideParameters({
      daoFee: daoFee.toString(),
      baseFee: parseFloat(formatEther(baseFee.toString())),
      baseFeeDistance: baseFeeDistance.toString(),
      distanceFee: parseFloat(formatEther(distanceFee.toString())),
      daoBalance: parseFloat(formatEther(daoBalance.toString())),
    });
    return;
  };

  const fetchProposalState = async () => {
    const { LiteRideGovernor } = contracts;

    const proposalsWithState = [];
    for (const proposal of proposals) {
      console.log(proposal);
      const proposalState = await LiteRideGovernor.state(proposal.proposalId);
      console.log(proposalState);

      const proposalWithState = {
        ...proposal,
        state: proposalState,
      };

      proposalsWithState.push(proposalWithState);
    }

    setProposals(proposalsWithState);
  };

  useEffect(() => {
    fetchParameters();
  }, [null]);

  const fetchCurrentBlock = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const blockNumber = await provider.getBlockNumber();
    setCurrentBlock(blockNumber);
  };

  useEffect(() => {
    fetchCurrentBlock();
  }, [null]);

  const onSelectChange = (e) => {
    const chosenParameter = parametersAvailableToChange.find(
      (parameter) => parameter.value === e.target.value
    );
    setParameterSelected(chosenParameter);
  };

  const createProposal = async () => {
    const { LiteRideGovernor, LiteRide } = contracts;
    const { name, value } = parameterSelected;

    const proposalArgs = [[LiteRide.address], [0]];

    console.log(name, value);

    if (name === "select") {
      alert("Please select a parameter to change");
      return;
    }

    let encodedFunctionCall;
    switch (value) {
      case "baseFee":
        encodedFunctionCall = LiteRide.interface.encodeFunctionData(
          "updateBaseFee",
          [parseEther(parameterChangeValue.toString())]
        );
        break;
      case "baseFeeDistance":
        encodedFunctionCall = LiteRide.interface.encodeFunctionData(
          "updateBaseFeeDistance",
          [parameterChangeValue]
        );
        break;
      case "distanceFee":
        encodedFunctionCall = LiteRide.interface.encodeFunctionData(
          "updateDistanceFee",
          [parseEther(parameterChangeValue.toString())]
        );
        break;
      case "daoFee":
        encodedFunctionCall = LiteRide.interface.encodeFunctionData(
          "updateDaoFee",
          [parameterChangeValue]
        );
        break;
      default:
        alert("Please select a parameter to change");
        return;
    }

    proposalArgs.push([encodedFunctionCall]);

    proposalArgs.push(description);

    console.log(proposalArgs);

    const proposalTransaction = await LiteRideGovernor.propose(...proposalArgs);

    const proposalId = await proposalTransaction.wait().then((receipt) => {
      return receipt.events[0].args[0].toString();
    });

    console.log(proposalId);
  };

  const updateValues = () => {
    fetchCurrentBlock();
    fetchParameters();
    fetchProposalState();
  };

  const voteOnProposal = async (proposalId, support) => {
    const { LiteRideGovernor } = contracts;

    const castVote = await LiteRideGovernor.castVoteWithReason(
      proposalId,
      support,
      "default"
    );

    await castVote.wait();

    updateValues();
  };

  const executeProposal = async (proposal) => {
    const { LiteRideGovernor, LiteRide } = contracts;

    const hashOfDescription = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(proposal.description)
    );

    const executeArgs = [
      proposal.targets.map((target) => LiteRide.address),
      proposal.values.map((val) => 0),
      proposal.calldatas,
      hashOfDescription,
    ];

    console.log(executeArgs);
    const execute = await LiteRideGovernor.execute(...executeArgs);

    const response = await execute.wait();

    console.log(response);

    updateValues();
  };

  const queueProposal = async (proposal) => {
    const { LiteRideGovernor, LiteRide } = contracts;

    const hashOfDescription = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(proposal.description)
    );

    const executeArgs = [
      proposal.targets.map((target) => LiteRide.address),
      proposal.values.map((val) => 0),
      proposal.calldatas,
      hashOfDescription,
    ];

    console.log(executeArgs);
    const execute = await LiteRideGovernor.queue(...executeArgs);

    const response = await execute.wait();

    console.log(response);

    updateValues();
  };

  return (
    contracts && (
      <div>
        <h1 className={styles.title}>Interacting with Dao</h1>
        <h2 className="mb-2 mt-0 text-xl font-medium leading-tight text-primary">
          Contract Addresses
        </h2>
        <h3 className="mb-2 mt-0 text-lg font-medium leading-tight text-primary">
          currentBlock height: {currentBlock}
        </h3>
        <ul className="list-disc">
          <li>
            TimeLock contract address: {contracts.LiteRideTimelock.address}
          </li>
          <li>
            Governor contract address: {contracts.LiteRideGovernor.address}
          </li>
          <li>LiteRide contract address: {contracts.LiteRide.address}</li>
        </ul>

        <h2 className="mb-2 mt-0 text-xl font-medium leading-tight text-primary">
          LiteRide Parameters
        </h2>
        <ul className="list-disc">
          <li>
            Dao Fee:{" "}
            {liteRideParameters ? liteRideParameters.daoFee : "loading..."}%
          </li>
          <li>
            Base Fee:{" "}
            {liteRideParameters ? liteRideParameters.baseFee : "loading..."} LTR
          </li>
          <li>
            Base Fee Distance:{" "}
            {liteRideParameters
              ? liteRideParameters.baseFeeDistance
              : "loading..."}{" "}
            Miles
          </li>
          <li>
            Distance Fee:{" "}
            {liteRideParameters ? liteRideParameters.distanceFee : "loading..."}{" "}
            LTR / mile
          </li>
          <li>
            Dao Balance:{" "}
            {liteRideParameters ? liteRideParameters.daoBalance : "loading..."}{" "}
            LTR
          </li>
        </ul>

        <div className="items-center justify-center">
          <button
            type="button"
            onClick={openModal}
            className="flex-shrink-0 bg-blue-500 hover:bg-blue-700 border-blue-500 hover:border-blue-700 text-sm border-4 text-white py-1 px-2 rounded"
          >
            Create Proposal
          </button>
          <button
            type="button"
            onClick={updateValues}
            className="flex-shrink-0 bg-blue-500 hover:bg-blue-700 border-blue-500 hover:border-blue-700 text-sm border-4 text-white py-1 px-2 rounded"
          >
            Update Values
          </button>
        </div>

        {proposals.length > 0 && (
          <div>
            <h2 className="mb-2 mt-0 text-xl font-medium leading-tight text-primary">
              Proposals
            </h2>
            <table className="table-fixed border-separate">
              <thead>
                <tr>
                  <th className="border px-8 py-4">Proposal id</th>
                  <th className="border px-8 py-4">Proposer</th>
                  <th className="border px-8 py-4">Description</th>
                  <th className="border px-8 py-4">Start Block</th>
                  <th className="border px-8 py-4">End Block</th>
                  <th className="border px-8 py-4">State</th>
                  <th className="border px-8 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((proposal) => (
                  <tr key={proposal.proposalId}>
                    <td className="border px-8 py-4">
                      {proposal.proposalId.slice(0, 20)}...
                    </td>
                    <td className="border px-8 py-4">
                      {proposal.proposer.slice(0, 15)}...
                    </td>
                    <td className="border px-8 py-4">{proposal.description}</td>
                    <td className="border px-8 py-4">
                      {proposal.startBlock.toString()}
                    </td>
                    <td className="border px-8 py-4">
                      {proposal.endBlock.toString()}
                    </td>
                    <td className="border px-8 py-4">
                      {proposal.state ? states[proposal.state] : ""}
                    </td>
                    <td className="border px-8 py-4">
                      {proposal.state && proposal.state === 1 ? (
                        <>
                          <button
                            className="flex-shrink-0 bg-blue-500 hover:bg-blue-700 border-blue-500 hover:border-blue-700 text-sm border-4 text-white py-1 px-2 rounded"
                            onClick={() =>
                              voteOnProposal(proposal.proposalId, 1)
                            }
                          >
                            Vote For
                          </button>
                          <button
                            className="flex-shrink-0 bg-red-500 hover:bg-red-700 border-red-500 hover:border-red-700 text-sm border-4 text-white py-1 px-2 rounded"
                            onClick={() =>
                              voteOnProposal(proposal.proposalId, 0)
                            }
                          >
                            Vote Against
                          </button>
                        </>
                      ) : proposal.state && proposal.state === 4 ? (
                        <button
                          className="flex-shrink-0 bg-blue-500 hover:bg-blue-700 border-blue-500 hover:border-blue-700 text-sm border-4 text-white py-1 px-2 rounded"
                          onClick={() => queueProposal(proposal)}
                        >
                          Queue
                        </button>
                      ) : proposal.state && proposal.state === 5 ? (
                        <button
                          className="flex-shrink-0 bg-blue-500 hover:bg-blue-700 border-blue-500 hover:border-blue-700 text-sm border-4 text-white py-1 px-2 rounded"
                          onClick={() => executeProposal(proposal)}
                        >
                          Execute
                        </button>
                      ) : (
                        <></>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Transition appear show={isOpen} as={Fragment}>
          <Dialog as="div" className="relative z-10" onClose={closeModal}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4 text-center">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900"
                    >
                      Create Proposal
                    </Dialog.Title>
                    <div className="mt-2">
                      <input
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        id="username"
                        type="text"
                        placeholder="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                      Parameter To Change:{" "}
                      <select onChange={onSelectChange}>
                        {parametersAvailableToChange.map((parameter) => (
                          <option value={parameter.value} key={parameter.id}>
                            {parameter.name}
                          </option>
                        ))}
                      </select>
                      {parameterSelected &&
                      parameterSelected.value !== "none" ? (
                        <input
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                          id="changeParameter"
                          type={parameterSelected.type}
                          placeholder={parameterSelected.name}
                          value={parameterChangeValue}
                          onChange={(e) =>
                            setParameterChangeValue(e.target.value)
                          }
                        />
                      ) : null}
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        onClick={createProposal}
                      >
                        create
                      </button>
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                        onClick={closeModal}
                      >
                        cancel
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    )
  );
}
