/* =====================================================
   IMPORT SHARED CONTRACT CONFIG
===================================================== */
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract.js";

/* =====================================================
   CONNECT WALLET & REDIRECT
===================================================== */
async function connectWallet() {
  try {
    /* ---------------------------------------------
       METAMASK CHECK
    --------------------------------------------- */
    if (!window.ethereum) {
      alert("MetaMask is not installed");
      return;
    }

    /* ---------------------------------------------
       REQUEST WALLET ACCESS
    --------------------------------------------- */
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    const connectedAddress = accounts[0];
    console.log("Connected wallet:", connectedAddress);

    /* ---------------------------------------------
       BLOCKCHAIN CONNECTION (READ-ONLY)
    --------------------------------------------- */
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider
    );

    /* ---------------------------------------------
       CHECK ADMIN ADDRESS
    --------------------------------------------- */
    const adminAddress = await contract.admin();
    console.log("Admin address:", adminAddress);

    /* ---------------------------------------------
       REDIRECT BASED ON ROLE
    --------------------------------------------- */
    if (connectedAddress.toLowerCase() === adminAddress.toLowerCase()) {
      window.location.href = "admin.html";
    } else {
      window.location.href = "voter.html";
    }
  } catch (error) {
    console.error("Wallet connection failed →", error);
    alert("Wallet connection failed. Check console.");
  }
}

/* =====================================================
   BUTTON EVENT BINDING
===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connectWallet");
  if (connectBtn) {
    connectBtn.addEventListener("click", connectWallet);
  }
});
