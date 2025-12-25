/* =====================================================
   IMPORT SHARED CONTRACT CONFIG
===================================================== */
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract.js";

/* =====================================================
   GLOBAL VARIABLES
===================================================== */
let provider;
let signer;
let readContract;
let writeContract;
let adminAddress;

/* =====================================================
   PAGE LOAD
===================================================== */
window.addEventListener("load", async () => {
  try {
    if (!window.ethereum) {
      alert("MetaMask not detected");
      window.location.href = "login.html";
      return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();

    const userAddress = await signer.getAddress();

    readContract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider
    );
    writeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    adminAddress = await readContract.admin();

    if (userAddress.toLowerCase() !== adminAddress.toLowerCase()) {
      alert("Access denied. Admin only.");
      window.location.href = "login.html";
      return;
    }

    document.getElementById("adminAddress").innerText =
      userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

    /* 🔥 Attach listeners BEFORE loading data */
    listenToContractEvents();

    await loadDashboardData();
  } catch (err) {
    console.error("ADMIN LOAD ERROR →", err);
    alert("Failed to load admin dashboard");
  }
});

/* =====================================================
   DASHBOARD DATA
===================================================== */
async function loadDashboardData() {
  /* ---------- META ---------- */
  try {
    const res = await fetch("http://localhost:3000/api/elections/meta");
    if (res.ok) {
      const data = await res.json();
      if (data?.election_name) {
        document.getElementById("electionName").value = data.election_name;
      }
    }
  } catch {}

  /* ---------- STATUS ---------- */
  const status = Number(await readContract.electionStatus());
  updateElectionUI(status);

  /* ---------- CANDIDATES ---------- */
  const count = (await readContract.candidatesCount()).toNumber();
  document.getElementById("candidateCount").innerText = count;

  await loadCandidates(count);
  await updateVotesCast();
}

/* =====================================================
   UI STATE
===================================================== */
function updateElectionUI(status) {
  const statusText =
    status === 0 ? "Not Started" : status === 1 ? "Ongoing" : "Ended";

  document.getElementById("electionStatus").innerText = statusText;

  updateElectionNameLock(status);
  updateAddCandidateButton(status);
  updateElectionButtons(status);
}

function updateElectionButtons(status) {
  const startBtn = document.getElementById("startElectionBtn");
  const endBtn = document.getElementById("endElectionBtn");

  startBtn.disabled = status !== 0;
  endBtn.disabled = status !== 1;

  [startBtn, endBtn].forEach((btn) => {
    btn.classList.toggle("opacity-50", btn.disabled);
    btn.classList.toggle("cursor-not-allowed", btn.disabled);
  });

  updateStartButtonByElectionName();
}

async function updateStartButtonByElectionName() {
  const input = document.getElementById("electionName");
  const startBtn = document.getElementById("startElectionBtn");

  const status = Number(await readContract.electionStatus());
  startBtn.disabled = !(status === 0 && input.value.trim());
}

/* =====================================================
   LOAD CANDIDATES
===================================================== */
async function loadCandidates(count) {
  const container = document.getElementById("candidatesContainer");
  const emptyState = document.getElementById("noCandidates");

  if (!container || !emptyState) return;

  container.querySelectorAll(".candidate-card").forEach((el) => el.remove());

  if (count === 0) {
    emptyState.style.display = "flex";
    return;
  }

  emptyState.style.display = "none";

  for (let i = 1; i <= count; i++) {
    const candidate = await readContract.getCandidate(i);

    const initials = candidate.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase();

    const card = document.createElement("div");
    card.className =
      "candidate-card group flex items-center justify-between p-4 rounded-xl bg-card-dark border border-border-dark";

    card.innerHTML = `
      <div class="flex items-center gap-4">
        <div class="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
          ${initials}
        </div>
        <div>
          <p class="font-bold text-white">${candidate.name}</p>
          <p class="text-xs text-slate-400">ID: ${candidate.id}</p>
        </div>
      </div>
    `;

    container.appendChild(card);
  }
}

/* =====================================================
   TOTAL VOTES CAST (LIVE)
===================================================== */
async function updateVotesCast() {
  const count = (await readContract.candidatesCount()).toNumber();
  let totalVotes = 0;

  for (let i = 1; i <= count; i++) {
    totalVotes += (await readContract.voteCount(i)).toNumber();
  }

  document.getElementById("votesCast").innerText = totalVotes;
}

/* =====================================================
   🔥 REAL-TIME CONTRACT EVENTS (BLOCKCHAIN TIME)
===================================================== */
function listenToContractEvents() {
  readContract.removeAllListeners();

  // 🗳️ Vote cast
  readContract.on("VoteCast", async () => {
    await updateVotesCast();
  });

  // ➕ Candidate added
  readContract.on("CandidateAdded", async () => {
    const count = (await readContract.candidatesCount()).toNumber();
    document.getElementById("candidateCount").innerText = count;
    await loadCandidates(count);
  });

  // ▶️ Election started (USE BLOCKCHAIN TIMESTAMP)
  readContract.on("ElectionStarted", async (timestamp) => {
    const blockTimeISO = new Date(timestamp.toNumber() * 1000).toISOString();

    await fetch("http://localhost:3000/api/elections/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        election_name: document.getElementById("electionName").value.trim(),
        start_time: blockTimeISO,
      }),
    });

    await loadDashboardData();
  });

  // ⏹ Election ended (USE BLOCKCHAIN TIMESTAMP)
  readContract.on("ElectionEnded", async (timestamp) => {
    const blockTimeISO = new Date(timestamp.toNumber() * 1000).toISOString();

    await fetch("http://localhost:3000/api/elections/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        end_time: blockTimeISO,
      }),
    });

    await loadDashboardData();
  });
}

/* =====================================================
   ADD CANDIDATE
===================================================== */
document.getElementById("addCandidateBtn").onclick = async () => {
  const name = document.getElementById("candidateName").value.trim();
  if (!name) return alert("Enter candidate name");

  const tx = await writeContract.addCandidate(name);
  await tx.wait();
  document.getElementById("candidateName").value = "";
};

/* =====================================================
   START / END ELECTION
===================================================== */
document.getElementById("startElectionBtn").onclick = async () => {
  await (await writeContract.startElection()).wait();
};

document.getElementById("endElectionBtn").onclick = async () => {
  await (await writeContract.endElection()).wait();
  window.open("results.html", "_blank");
};

/* =====================================================
   INPUT HELPERS
===================================================== */
document
  .getElementById("electionName")
  .addEventListener("input", () => updateStartButtonByElectionName());

function updateElectionNameLock(status) {
  const input = document.getElementById("electionName");
  input.readOnly = status !== 0;
}

function updateAddCandidateButton(status) {
  const enabled = status === 0;
  document.getElementById("addCandidateBtn").disabled = !enabled;
  document.getElementById("candidateName").disabled = !enabled;
}
