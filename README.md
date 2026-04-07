# 💀 ForgeFi: The Executioner Bot

> **🏆 Frontier Hackathon Submission Note:**
> The core `userStake` PDA contract and brutalist UI foundation were established prior to this hackathon (see `pre-frontier-baseline` tag). 
> 
> **For the Frontier Hackathon, we are specifically building these upgrades (which impact this execution environment):**
> * **Decentralized Crank:** Transitioning this centralized Node.js Executioner bot into a fully permissionless, decentralized automation network (e.g., Gelato/Switchboard).
> * **The Live Graveyard:** Emitting slash events that the frontend catches in real-time.
> * **Multiplayer Carnage:** Updating the scanner to slash Squad Vaults.
> * **Decentralized Crank:** Transitioning the Executioner bot to a fully permissionless, decentralized automation network.
> * **Zero-Knowledge Geolocation:** Verifying physical gym presence without doxxing user coordinates.

---

### The Autonomous Enforcer

This repository contains the off-chain Node.js automation script for **ForgeFi**. Because Solana smart contracts cannot "wake themselves up" to check if a user missed a workout, they require an external crank. 

The Executioner Bot is a ruthlessly efficient CRON job built with `@solana/web3.js` and `@coral-xyz/anchor`. It acts as the protocol's grim reaper.

### ⚙️ The Slaughter Loop

When the script executes, it performs the following routine:
1. **The Hunt:** It scans the Solana Devnet for all active `UserStake` PDAs associated with the ForgeFi program.
2. **The Interrogation:** It reads the `last_check_in` timestamp of each vault and compares it against the current block time. 
3. **The Execution:** If a user's time delta exceeds the strict 48-hour window, the bot signs a transaction using a dedicated burner wallet (paying the gas) and permissionlessly triggers the `slash_missed_day` instruction on the Rust smart contract.
4. **The Bleed:** The smart contract calculates the 10% penalty and routes the slashed SOL directly to the ForgeFi Treasury. 

### 🛠️ Local Development & Deployment

To run the Executioner locally or deploy it to a serverless environment (like GitHub Actions):

**1. Install Dependencies**
```bash
npm install