/* =====================================================
   IMPORT SHARED CONTRACT CONFIG
===================================================== */
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract.js";

/* =====================================================
   GLOBAL VARIABLES
===================================================== */
let provider;
let signer;
let contract;
let totalVotes = 0;

/* =====================================================
   TIME FORMATTER (MySQL DATETIME → Local Time)
===================================================== */
function formatDBTime(timeValue) {
  if (!timeValue) return "—";

  let date;

  // ISO format: 2025-12-25T15:47:15.000Z
  if (typeof timeValue === "string" && timeValue.includes("T")) {
    date = new Date(timeValue);
  }
  // MySQL DATETIME: YYYY-MM-DD HH:MM:SS
  else {
    const [datePart, timePart] = String(timeValue).split(" ");
    if (!datePart || !timePart) return "—";

    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute, second] = timePart.split(":").map(Number);

    date = new Date(year, month - 1, day, hour, minute, second);
  }

  if (isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

/* =====================================================
   PAGE LOAD
===================================================== */
window.addEventListener("load", async () => {
  try {
    if (!window.ethereum) {
      alert("MetaMask not detected");
      return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    const contractLink = document.getElementById("viewContractLink");
    if (contractLink) {
      contractLink.href = `https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`;
    }

    const address = await signer.getAddress();
    document.getElementById("voterAddress").innerText =
      address.slice(0, 6) + "..." + address.slice(-4);

    /* ---------- WAIT FOR ELECTION END ---------- */
    await waitForElectionEnd();

    /* ---------- WAIT FOR BACKEND META ---------- */
    await forceLoadElectionMeta();

    /* ---------- LOAD RESULTS ---------- */
    await loadTotals();
    await loadWinner();
  } catch (err) {
    console.error("RESULTS PAGE ERROR →", err);
    alert("Failed to load results");
  }
});

/* =====================================================
   WAIT UNTIL ELECTION ENDS (BLOCKCHAIN)
===================================================== */
async function waitForElectionEnd() {
  const status = Number(await contract.electionStatus());
  if (status === 2) return;

  return new Promise((resolve) => {
    contract.once("ElectionEnded", () => resolve());
  });
}

/* =====================================================
   GUARANTEED META LOAD (NO DASH ISSUE)
===================================================== */
async function forceLoadElectionMeta() {
  for (let i = 0; i < 15; i++) {
    const ok = await fetchElectionMeta();
    if (ok) return;
    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error("Election metadata not ready");
}

/* =====================================================
   FETCH ELECTION META (FIXED)
===================================================== */
async function fetchElectionMeta() {
  try {
    const res = await fetch("http://localhost:3000/api/elections/meta");
    const data = await res.json();

    console.log("Results Meta →", data); // DEBUG

    if (!data) return false;

    if (data.election_name) {
      document.getElementById("resultsElectionName").innerText =
        data.election_name;
    }

    if (data.end_time) {
      document.getElementById("resultsEndTime").innerText = formatDBTime(
        data.end_time
      );
    }

    return true;
  } catch (err) {
    console.error("Meta fetch failed:", err);
    return false;
  }
}

/* =====================================================
   LOAD TOTAL VOTES
===================================================== */
async function loadTotals() {
  const count = (await contract.candidatesCount()).toNumber();
  totalVotes = 0;

  for (let i = 1; i <= count; i++) {
    totalVotes += (await contract.voteCount(i)).toNumber();
  }

  document.getElementById("totalTurnout").innerText = totalVotes;
  document.getElementById("totalBallots").innerText = totalVotes;
}

/* =====================================================
   LOAD WINNER
===================================================== */
async function loadWinner() {
  if (totalVotes === 0) {
    document.getElementById("winnerName").innerText = "No winner";
    document.getElementById("winnerVotes").innerText = "0";
    document.getElementById("winnerPercentage").innerText = "0%";
    document.getElementById("winnerInitials").innerText = "--";
    return;
  }

  const name = await contract.getWinnerName();
  const id = await contract.getWinnerID();
  const votes = await contract.voteCount(id);

  document.getElementById("winnerName").innerText = name;
  document.getElementById("winnerVotes").innerText = votes.toString();

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  document.getElementById("winnerInitials").innerText = initials;

  const percentage = ((votes / totalVotes) * 100).toFixed(2);
  document.getElementById("winnerPercentage").innerText = percentage + "%";
}
