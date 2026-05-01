import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import dotenv from "dotenv";
import bs58 from "bs58";
import idl from "./idl/idl.json"; 
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

// ==========================================
// 1. ARM THE EXECUTIONER BOT
// ==========================================
const connection = new Connection(process.env.RPC_URL!, "confirmed");

const executionerKeypair = Keypair.fromSecretKey(bs58.decode(process.env.EXECUTIONER_PRIVATE_KEY!));
const wallet = new Wallet(executionerKeypair);
const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "confirmed" });

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);

// 🚨 CRITICAL: This MUST match the exact Phantom Wallet address you hardcoded in lib.rs!
const TREASURY_PUBKEY = new PublicKey("HrAkqgXZA1fkwoJ6tdDcsu84R67yR7KCpB8NUR6oZ5NC"); 

const program = new Program(idl as any, PROGRAM_ID, provider);

// [DEMO MODE ACTIVATED]: Dropped to 60 seconds
const SECONDS_IN_48_HOURS = 60; 

// 🚨 INITIALIZE TELEGRAM BOT
const token = process.env.TELEGRAM_BOT_TOKEN!;
const bot = new TelegramBot(token, { polling: false }); // polling: false because this is a script, not a server

// [DEMO MODE]: total window is 60 seconds, warn them at 45 seconds (15 seconds left).
// If in production (48 hours), warn them at 44 hours.
const WARNING_THRESHOLD_SECONDS = 45;

// 🚨 FOR THE DEMO: Your personal Telegram Chat ID. 
// (You can get this by messaging @userinfobot on Telegram)
const DEMO_CHAT_ID = "5803250417";

console.log(`\n💀 THE EXECUTIONER IS ONLINE 💀`);
console.log(`Bot Wallet (Paying Gas): ${executionerKeypair.publicKey.toBase58()}`);
console.log(`Routing Slashed Funds To: ${TREASURY_PUBKEY.toBase58()}\n`);

// ==========================================
// 2. THE SCAN & SLASH LOGIC
// ==========================================
const scanAndSlash = async () => {
// 🚨 SYNC WITH BLOCKCHAIN TIME 🚨
    const slot = await connection.getSlot();
    const currentTimestamp = await connection.getBlockTime(slot) || Math.floor(Date.now() / 1000);
    
    console.log(`⏱️ Local Time: ${Math.floor(Date.now() / 1000)} | Devnet Time: ${currentTimestamp}`);
    // ---------------------------------------------------------
    // SWEEP 1: LONE WOLF VAULTS
    // ---------------------------------------------------------
    console.log(`[${new Date().toLocaleTimeString()}] Scanning blockchain for expired LONE WOLF vaults...`);

    // FIX: Put the shield back up! 
    // This strictly filters for 63-byte accounts, completely ignoring the 60-byte ghost accounts from yesterday.
    const allLoneWolves = await program.account.userStake.all([
        { dataSize: 64 } 
    ]);

    for (const vault of allLoneWolves) {
        const data = vault.account as any; 
        const vaultPubkey = vault.publicKey;
        
        const totalDaysProcessed = data.daysCompleted + data.missedDays;

        // If they finished all their days, skip them
        if (totalDaysProcessed >= data.daysCommitted) continue;

        const timeSinceLastWorkout = currentTimestamp - data.lastCheckIn.toNumber();

        // Check if they violated the window
        if (timeSinceLastWorkout > SECONDS_IN_48_HOURS) {
            console.log(`🩸 LONE WOLF VIOLATION: Vault ${vaultPubkey.toBase58()} missed their window. Executing 10% Bleed...`);

            try {
                const tx = await program.methods
                    .slashMissedDay()
                    .accounts({
                        liquidator: executionerKeypair.publicKey, 
                        treasury: TREASURY_PUBKEY,                
                        userStake: vaultPubkey,                   
                    } as any)
                    .signers([executionerKeypair]) 
                    .rpc();

                console.log(`✅ SLAUGHTER SUCCESSFUL. 10% bled to Treasury. TX: ${tx}\n`);
            } catch (slashError) {
                console.error(`❌ FAILED TO SLASH VAULT ${vaultPubkey.toBase58()}:`, slashError);
            }
        }

        // 2. 🚨 THE DEATH KNELL WARNING (NEW) 🚨
        else if (timeSinceLastWorkout > WARNING_THRESHOLD_SECONDS) {
            const timeLeft = SECONDS_IN_48_HOURS - timeSinceLastWorkout;
            
            console.log(`⚠️ WARNING: Vault ${vaultPubkey.toBase58()} is critically close to bleeding. Sending Death Knell...`);
            
            const message = `
                🩸 <b>FORGEFI DEATH KNELL</b> 🩸

                Lifter: <code>${vaultPubkey.toBase58().slice(0, 8)}...</code>
                Time Remaining: <b>${timeLeft} seconds</b>

                The Executioner is sharpening his blade. Your Solana is about to bleed to the treasury. 
                Get to the gym and verify your workout immediately. No mercy.
            `;

            try {
                // Send the message to Telegram
                await bot.sendMessage(DEMO_CHAT_ID, message, { parse_mode: 'HTML' });
                console.log("🔔 Death Knell sent successfully.");
            } catch (error) {
                console.error("❌ Failed to send Telegram warning:", error);
            }
        }
    
    }

    // ---------------------------------------------------------
    // SWEEP 2: SQUAD VAULTS (BLOOD PACT)
    // ---------------------------------------------------------
    console.log(`\n[${new Date().toLocaleTimeString()}] Scanning blockchain for expired SQUAD VAULTS...`);
    
    // Fetch all V2 Squad Vaults
    const allSquadVaults = await program.account.squadVaultV2.all([
        {dataSize : 209}
    ]);

    for (const vault of allSquadVaults) {
      const data = vault.account as any;
      const vaultPubkey = vault.publicKey;

      // Ignore vaults that haven't fully started or are already dead
      if (!data.protocolActive || data.missedDays === 999) continue;

      // Check the clocks for all players
      const p1Time = currentTimestamp - data.p1LastCheckIn.toNumber();
      const p2Time = currentTimestamp - data.p2LastCheckIn.toNumber();
      
      let p3Time = 0;
      const emptyPubKey = "11111111111111111111111111111111"; // Default System Program address
      if (data.playerThree.toBase58() !== emptyPubKey) {
        p3Time = currentTimestamp - data.p3LastCheckIn.toNumber();
      }

      // Drop the Guillotine if ANY player is over the 60 second limit
      if (p1Time > SECONDS_IN_48_HOURS || p2Time > SECONDS_IN_48_HOURS || p3Time > SECONDS_IN_48_HOURS) {
        console.log(`🩸 SQUAD VIOLATION DETECTED: Vault ${vaultPubkey.toBase58()} missed their window. Executing 10% Bleed...`);
        
        try {
          const tx = await program.methods
            .slashSquad()
            .accounts({
              liquidator: executionerKeypair.publicKey, 
              treasury: TREASURY_PUBKEY,     
              squadVault: vaultPubkey,
            } as any)
            .signers([executionerKeypair])
            .rpc();

          console.log(`✅ SQUAD SLAUGHTER SUCCESSFUL. 10% bled to Treasury. TX: ${tx}\n`);
        } catch (slashError) {
          console.error(`❌ FAILED TO SLASH SQUAD ${vaultPubkey.toBase58()}:`, slashError);
        }
      }
    }

    console.log(`\nScan complete. No more targets found.`);
};

// ==========================================
// 3. EXECUTE AND SHUTDOWN (For GitHub Actions)
// ==========================================
const main = async () => {
    await scanAndSlash();
};

main().then(async () => {
    console.log("Executioner sweep finished successfully. Disconnecting...");
    // Give Solana's background sockets 500ms to gracefully close on Windows
    await new Promise(resolve => setTimeout(resolve, 500)); 
    process.exit(0); // Clean exit so GitHub Action gets a Green Checkmark
}).catch(async (error) => {
    console.error("Critical Scanner Error:", error);
    await new Promise(resolve => setTimeout(resolve, 500)); 
    process.exit(1); // Error exit so GitHub Action flags as Failed
});