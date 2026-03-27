import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import cron from "node-cron";
import dotenv from "dotenv";
import bs58 from "bs58";
import idl from "./idl/idl.json"; 

dotenv.config();

// ==========================================
// 1. ARM THE EXECUTIONER BOT
// ==========================================
const connection = new Connection(process.env.RPC_URL!, "confirmed");

const executionerKeypair = Keypair.fromSecretKey(bs58.decode(process.env.EXECUTIONER_PRIVATE_KEY!));
const wallet = new Wallet(executionerKeypair);
const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "confirmed" });

const TREASURY_PUBKEY = executionerKeypair.publicKey; 
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);

// CLEAN INITIALIZATION: We are back on Anchor 0.29, so this works perfectly now!
const program = new Program(idl as any, PROGRAM_ID, provider);

const SECONDS_IN_A_DAY = 86400; 

console.log(`\n💀 THE EXECUTIONER IS ONLINE 💀`);
console.log(`Bot Wallet / Treasury: ${executionerKeypair.publicKey.toBase58()}\n`);

// ==========================================
// 2. THE SCAN & SLASH LOGIC
// ==========================================
const scanAndSlash = async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Scanning blockchain for expired vaults...`);

    try {
        // FIX: The exact size of your new UserStake struct is 60 bytes.
        // (8 discriminator + 32 pubkey + 8 stake + 1 committed + 1 completed + 1 missed + 8 time + 1 bump)
        // This filter forces the bot to ignore the old "zombie" accounts from Week 1.
        const allVaults = await program.account.userStake.all([
            { dataSize: 60 } 
        ]);
        const currentTimestamp = Math.floor(Date.now() / 1000);

        for (const vault of allVaults) {
            const data = vault.account as any; 
            const vaultPubkey = vault.publicKey;
            
            const totalDaysProcessed = data.daysCompleted + data.missedDays;

            if (totalDaysProcessed >= data.daysCommitted) continue;

            const timeSinceLastWorkout = currentTimestamp - data.lastCheckIn.toNumber();

            if (timeSinceLastWorkout > SECONDS_IN_A_DAY) {
                console.log(`🩸 VIOLATION DETECTED: Vault ${vaultPubkey.toBase58()} missed their day. Executing 10% Bleed...`);

                try {
                    const tx = await program.methods
                        .slashMissedDay()
                        .accounts({
                            liquidator: executionerKeypair.publicKey, 
                            treasury: TREASURY_PUBKEY,                
                            userStake: vaultPubkey,                   
                        })
                        .signers([executionerKeypair]) 
                        .rpc();

                    console.log(`✅ SLAUGHTER SUCCESSFUL. 10% bled to Treasury. TX: ${tx}\n`);
                } catch (slashError) {
                    console.error(`❌ FAILED TO SLASH VAULT ${vaultPubkey.toBase58()}:`, slashError);
                }
            }
        }
    } catch (error) {
        console.error("Critical Scanner Error:", error);
    }
};

// ==========================================
// 3. THE HEARTBEAT (Cron Job)
// ==========================================
cron.schedule("*/5 * * * *", () => {
    scanAndSlash();
});

scanAndSlash();