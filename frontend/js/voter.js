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

let voterAddress;
let selectedCandidateId = null;
let isElectionActive = false;
let hasAlreadyVoted = false;

/* 🔒 Render lock to prevent UI glitches */
let isRenderingCandidates = false;

/* =====================================================
   TIME FORMATTER (MySQL DATETIME → Local Time)
===================================================== */
function formatDBTime(timeValue) {
  if (!timeValue) return "—";

  let date;

  // ✅ ISO format: 2025-12-25T15:45:11.000Z
  if (typeof timeValue === "string" && timeValue.includes("T")) {
    date = new Date(timeValue);
  }
  // ✅ MySQL DATETIME: YYYY-MM-DD HH:MM:SS
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
   UI HELPERS
===================================================== */
function updateConfirmVoteButton() {
  const btn = document.getElementById("confirmVoteBtn");
  if (!btn) return;

  if (hasAlreadyVoted) {
    btn.innerText = "Already Voted";
    btn.disabled = true;
    btn.classList.add("opacity-50", "cursor-not-allowed", "pointer-events-none");
    return;
  }

  const enabled =
    isElectionActive && selectedCandidateId !== null && !hasAlreadyVoted;

  btn.innerText = "Confirm Vote";
  btn.disabled = !enabled;
  btn.classList.toggle("opacity-50", !enabled);
  btn.classList.toggle("cursor-not-allowed", !enabled);
  btn.classList.toggle("pointer-events-none", !enabled);
}

function updateViewResultsButton(status) {
  const btn = document.getElementById("viewResultsBtn");
  if (!btn) return;

  const enabled = status === 2;
  btn.disabled = !enabled;
  btn.classList.toggle("opacity-50", !enabled);
  btn.classList.toggle("cursor-not-allowed", !enabled);
}

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
    voterAddress = await signer.getAddress();

    readContract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider
    );
    writeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    /* ---------- ADMIN CANNOT VOTE ---------- */
    const admin = await readContract.admin();
    if (admin.toLowerCase() === voterAddress.toLowerCase()) {
      alert("Admin cannot vote");
      window.location.href = "admin.html";
      return;
    }

    /* ---------- REGISTER VOTER ---------- */
    await fetch("http://localhost:3000/api/voters/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: voterAddress }),
    });

    document.getElementById("voterAddress").innerText =
      voterAddress.slice(0, 6) + "..." + voterAddress.slice(-4);

    /* ---------- CHECK VOTE STATUS ---------- */
    const statusRes = await fetch(
      `http://localhost:3000/api/voters/status/${voterAddress}`
    );
    const statusData = await statusRes.json();

    if (statusData.hasVoted) {
      hasAlreadyVoted = true;
      const btn = document.getElementById("confirmVoteBtn");
      btn.innerText = "Already Voted";
      btn.disabled = true;
      btn.classList.add("opacity-50", "cursor-not-allowed");
    }

    /* ---------- INITIAL LOAD ---------- */
    await loadElectionStatus();
    await forceLoadElectionMeta();
    await loadCandidatesSafe();

    listenToContractEvents();
  } catch (err) {
    console.error("VOTER PAGE ERROR →", err);
    alert("Failed to load voter page");
  }
});

/* =====================================================
   GUARANTEED META LOAD
===================================================== */
async function forceLoadElectionMeta() {
  for (let i = 0; i < 10; i++) {
    const ok = await fetchElectionMeta();
    if (ok) return;
    await new Promise((r) => setTimeout(r, 800));
  }
}

/* =====================================================
   FETCH ELECTION META
===================================================== */
async function fetchElectionMeta() {
  try {
    const res = await fetch("http://localhost:3000/api/elections/meta");
    const data = await res.json();

    if (!data) return false;

    if (data.election_name) {
      document.getElementById("electionTitle").innerText = data.election_name;
    }

    if (data.start_time) {
      document.getElementById("startTime").innerText = formatDBTime(
        data.start_time
      );
    }

    if (data.end_time) {
      document.getElementById("endTime").innerText = formatDBTime(
        data.end_time
      );
    }

    return true;
  } catch (err) {
    console.error("Election meta fetch failed:", err);
    return false;
  }
}

/* =====================================================
   ELECTION STATUS (BLOCKCHAIN)
===================================================== */
async function loadElectionStatus() {
  const badge = document.getElementById("electionStatusBadge");
  const container = document.getElementById("candidatesContainer");
  const status = Number(await readContract.electionStatus());

  badge.className =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset";

  if (status === 1) {
    isElectionActive = true;
    badge.innerText = "Active Election";
    badge.classList.add("bg-emerald-500/10", "text-emerald-400");
    container.classList.remove("opacity-50", "pointer-events-none");
  } else if (status === 2) {
    isElectionActive = false;
    badge.innerText = "Election Ended";
    badge.classList.add("bg-red-500/10", "text-red-400");
    container.classList.add("opacity-50", "pointer-events-none");
  } else {
    isElectionActive = false;
    badge.innerText = "Election Not Started";
    badge.classList.add("bg-gray-500/10", "text-gray-400");
    container.classList.add("opacity-50", "pointer-events-none");
  }

  updateConfirmVoteButton();
  updateViewResultsButton(status);
}

/* =====================================================
   SAFE CANDIDATE LOADER (FINAL FIX)
===================================================== */
async function loadCandidatesSafe() {
  if (isRenderingCandidates) return;
  isRenderingCandidates = true;

  const container = document.getElementById("candidatesContainer");
  const emptyState = document.getElementById("noCandidates");

  try {
    const count = (await readContract.candidatesCount()).toNumber();

    /* ✅ Remove only candidate cards */
    Array.from(container.children).forEach((child) => {
      if (child.id !== "noCandidates") child.remove();
    });

    if (count === 0) {
      if (emptyState) emptyState.style.display = "flex";
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    for (let i = 1; i <= count; i++) {
      const candidate = await readContract.getCandidate(i);

      const initials = candidate.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase();

      const card = document.createElement("div");
      card.className =
        "cursor-pointer bg-card-dark border border-border-dark rounded-xl p-4 flex items-center justify-between hover:border-primary transition";

      card.innerHTML = `
        <div class="flex items-center gap-4">
          <div class="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
            ${initials}
          </div>
          <div>
            <p class="font-bold text-white">${candidate.name}</p>
            <p class="text-xs text-slate-400">Candidate ID: ${candidate.id}</p>
          </div>
        </div>
        <span class="material-symbols-outlined text-slate-500">how_to_vote</span>
      `;

      card.onclick = () => selectCandidate(candidate.id, candidate.name, card);

      container.appendChild(card);
    }
  } catch (err) {
    console.error("Candidate render failed:", err);
  } finally {
    isRenderingCandidates = false;
  }
}

/* =====================================================
   CONTRACT EVENTS
===================================================== */
function listenToContractEvents() {
  readContract.removeAllListeners();

  readContract.on("ElectionStarted", async () => {
    await forceLoadElectionMeta();
    await loadElectionStatus();
  });

  readContract.on("ElectionEnded", async () => {
    await forceLoadElectionMeta();
    await loadElectionStatus();
  });

  readContract.on("CandidateAdded", async (_, __, event) => {
    await event.getTransactionReceipt();
    await loadCandidatesSafe();
  });
}

/* =====================================================
   SELECT CANDIDATE
===================================================== */
function selectCandidate(id, name, card) {
  if (!isElectionActive || hasAlreadyVoted) return;

  selectedCandidateId = id;
  document.getElementById("selectedCandidateName").innerText = name;

  document
    .querySelectorAll("#candidatesContainer > div")
    .forEach((c) => c.classList.remove("border-primary"));

  card.classList.add("border-primary");
  updateConfirmVoteButton();
}

/* =====================================================
   CONFIRM VOTE
===================================================== */
document.getElementById("confirmVoteBtn").onclick = async () => {
  if (!isElectionActive || selectedCandidateId === null || hasAlreadyVoted)
    return;

  try {
    hasAlreadyVoted = true;
    updateConfirmVoteButton();

    const tx = await writeContract.vote(selectedCandidateId);
    await tx.wait();

    await fetch("http://localhost:3000/api/voters/voted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: voterAddress, txHash: tx.hash }),
    });

    alert("Vote cast successfully 🗳️");
  } catch (err) {
    console.error(err);
    alert("Voting failed");
  }
};

/* =====================================================
   VIEW RESULTS
===================================================== */
document.getElementById("viewResultsBtn").onclick = () => {
  window.location.href = "results.html";
};
