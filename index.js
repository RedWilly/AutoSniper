import { ethers } from 'ethers';
import chalk from 'chalk';
import fs from 'fs';

// **1. Configuration Variables (Adjust these)**

const provider = new ethers.providers.WebSocketProvider('wss://base.blockpi.network/v1/ws/25..5'); //replace websocket
const signer = new ethers.Wallet('0x{private}', provider); //replace {private} with you private key
const HONEYPOT_FIGHTER_ADDRESS = '0x84384d4069596fac7b2263ff946e2456bd5d0186'; // no need to replace if on base - but still you can  
const GAS_PRICE_GWEI = 7;
const ETH_AMOUNT_TO_SEND = '0.00008'; //  0.00008 ETH (adjust as needed)

// **2. Contract Addresses and ABIs**

const UNISWAP_FACTORY_ADDRESS = '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6'; //uniswap v2 factory basechain
const UNISWAP_FACTORY_ABI = [
    'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
    'function allPairs(uint) external view returns (address pair)',
    'function allPairsLength() external view returns (uint)'
];
const UNISWAP_PAIR_ABI = [
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
];
const ERC20_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function totalSupply() external view returns (uint256)',
    'function owner() external view returns (address)' // note this might not be present in all ERC20s
];
const HONEYPOT_FIGHTER_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "slippagePercentage",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "deadline",
                "type": "uint256"
            }
        ],
        "name": "fightHoneypot",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "stateMutability": "payable",
        "type": "receive"
    }
];

const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
const TOKENS_FILE = 'tokens.json';
const BLACKLIST_FILE = 'blacklist.json';

// **3. Contract Instances**

const factoryContract = new ethers.Contract(UNISWAP_FACTORY_ADDRESS, UNISWAP_FACTORY_ABI, provider);
const honeypotFighterContract = new ethers.Contract(HONEYPOT_FIGHTER_ADDRESS, HONEYPOT_FIGHTER_ABI, signer);

// **4. Helper Functions**

const logWithTimestamp = (message, color = chalk.white) => {
    const now = new Date();
    const time = now.toLocaleTimeString();
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
    console.log(color(`[${time}:${milliseconds}] ${message}`));
};

const loadJSON = (filePath) => {
    try {
        const data = fs.readFileSync(filePath);
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.warn(`File not found: ${filePath}. Creating an empty file.`);
            saveJSON(filePath, {});
            return {};
        } else {
            console.error(`Error loading ${filePath}:`, err);
            return {};
        }
    }
};

const saveJSON = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// **5. Global Data Structures**

let tokens = loadJSON(TOKENS_FILE);
let blacklist = loadJSON(BLACKLIST_FILE);

// **6. Honeypot Detection and Execution Logic**

const handleNewPair = async (token0, token1, pairAddress) => {
    logWithTimestamp(`New pair created: ${pairAddress}`, chalk.blue);

    let tokenAddress = (token0 === WETH_ADDRESS) ? token1 :
        (token1 === WETH_ADDRESS) ? token0 : null;

    if (!tokenAddress) {
        return; // Not a WETH pair
    }

    logWithTimestamp(`Token paired with WETH: ${tokenAddress}`, chalk.green);

    try {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const ownerAddress = await tokenContract.owner();

        // Blacklist Check (if owner is already blacklisted)
        if (blacklist[ownerAddress]?.includes(tokenAddress)) {
            logWithTimestamp(`Token ${tokenAddress} is blacklisted (owner blacklisted).`, chalk.red);
            return;
        }

        // Store for further checks after a delay
        tokens[tokenAddress] = {
            pairAddress: pairAddress,
            isToken0: token0 === WETH_ADDRESS,
            timestamp: Date.now(),
            owner: ownerAddress
        };
        saveJSON(TOKENS_FILE, tokens);

    } catch (error) {
        logWithTimestamp(`Error getting owner for ${tokenAddress}: ${error.message}`, chalk.yellow);
    }
};

const checkToken = async (tokenAddress) => {
    logWithTimestamp(`Checking token: ${tokenAddress} - ${tokens[tokenAddress]?.pairAddress || "Unknown Pair"}`, chalk.yellow);

    try {
        const pairAddress = tokens[tokenAddress].pairAddress;
        const isToken0 = tokens[tokenAddress].isToken0;
        const ownerAddress = tokens[tokenAddress].owner; // Get the stored owner address
        const pairContract = new ethers.Contract(pairAddress, UNISWAP_PAIR_ABI, provider);
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

        // **Honeypot Checks**

        const reserves = await pairContract.getReserves();
        const wethReserve = isToken0 ? ethers.utils.formatUnits(reserves[1], 18) : ethers.utils.formatUnits(reserves[0], 18);
        const tokenReserve = isToken0 ? ethers.utils.formatUnits(reserves[0], 18) : ethers.utils.formatUnits(reserves[1], 18);
        const totalSupply = ethers.utils.formatUnits(await tokenContract.totalSupply(), 18);

        let shouldBlacklist = false;

        if (parseFloat(wethReserve) < 10) {
            logWithTimestamp(`WETH reserve is ${wethReserve} & less than 10 for ${tokenAddress}. Blacklisting.`, chalk.red);
            shouldBlacklist = true;
        } else if (parseFloat(tokenReserve) < parseFloat(totalSupply) * 0.8) {
            logWithTimestamp(`Token reserve is less than 80% of total supply for ${tokenAddress}. Blacklisting.`, chalk.red);
            shouldBlacklist = true;
        } else {
            try {
                const ownerBalance = ethers.utils.formatUnits(await tokenContract.balanceOf(ownerAddress), 18);
                const ownerPairBalance = ethers.utils.formatUnits(await pairContract.balanceOf(ownerAddress), 18);
                const pairTotalSupply = ethers.utils.formatUnits(await pairContract.totalSupply(), 18);

                if (parseFloat(ownerBalance) > parseFloat(totalSupply) * 0.7) {
                    logWithTimestamp(`Owner holds more than 70% of total supply for ${tokenAddress}. Blacklisting.`, chalk.red);
                    shouldBlacklist = true;
                } else if (parseFloat(ownerPairBalance) > parseFloat(pairTotalSupply) * 0.7) {
                    logWithTimestamp(`Owner holds more than 70% of the pair contract for ${tokenAddress}. Blacklisting.`, chalk.red);
                    shouldBlacklist = true;
                }
            } catch (error) {
                logWithTimestamp(`Error checking owner balance for ${tokenAddress}: ${error.message}`, chalk.yellow);
            }
        }

        // **Blacklist and Execute**

        if (shouldBlacklist) {
            blacklist[ownerAddress] = blacklist[ownerAddress] || [];
            blacklist[ownerAddress].push(tokenAddress);
            saveJSON(BLACKLIST_FILE, blacklist);

            logWithTimestamp(`Token ${tokenAddress} blacklisted.`, chalk.red);
        } else {
            // **Execute fightHoneypot**
            logWithTimestamp(`All checks passed for ${tokenAddress}. Executing fightHoneypot...`, chalk.greenBright);

            try {
                const slippage = 40; // 40% slippage - adjust as needed
                const deadline = Math.floor(Date.now() / 1000) + (20 * 60); // 20 minutes from now
                const gasPrice = ethers.utils.parseUnits(GAS_PRICE_GWEI.toString(), 'gwei');

                const tx = await honeypotFighterContract.fightHoneypot(
                    tokenAddress,
                    slippage,
                    deadline,
                    {
                        value: ethers.utils.parseEther(ETH_AMOUNT_TO_SEND),
                        gasPrice: gasPrice,
                        gasLimit: 1000000 // Adjust gas limit if needed
                    }
                );

                logWithTimestamp(`Transaction sent: ${tx.hash}`, chalk.cyan);
                await tx.wait();
                logWithTimestamp(`Transaction confirmed for ${tokenAddress}!`, chalk.greenBright);

            } catch (error) {
                logWithTimestamp(`Transaction failed for ${tokenAddress}: ${error.message}`, chalk.bgRed.white);

                // Blacklist the token on transaction failure
                logWithTimestamp(`Blacklisting ${tokenAddress} due to transaction failure.`, chalk.red);
                blacklist[ownerAddress] = blacklist[ownerAddress] || [];
                blacklist[ownerAddress].push(tokenAddress);
                saveJSON(BLACKLIST_FILE, blacklist);
            }
        }

    } catch (error) {
        logWithTimestamp(`Error checking token ${tokenAddress}: ${error.message}`, chalk.red);
    } finally {
        // Remove the token from the tracking list after processing
        delete tokens[tokenAddress];
        saveJSON(TOKENS_FILE, tokens);
    }
};

// **7. Event Listener and Main Loop**

factoryContract.on('PairCreated', async (token0, token1, pairAddress) => {
    await handleNewPair(token0, token1, pairAddress);
});

const processExistingTokens = async () => {
    logWithTimestamp('Processing existing tokens...', chalk.magenta);
    const now = Date.now();

    for (const tokenAddress in tokens) {
        const tokenData = tokens[tokenAddress];
        const timePassed = (now - tokenData.timestamp) / (1000 * 60);

        if (timePassed >= 1) { // Check if 1 minute has passed
            await checkToken(tokenAddress);
        } else {
            logWithTimestamp(`Token ${tokenAddress} is still within the waiting period.`, chalk.gray);
        }
    }
};

// Initial processing of existing tokens
await processExistingTokens();

logWithTimestamp('Monitoring for new pairs...', chalk.magenta);

// Main loop to periodically check existing tokens
setInterval(async () => {
    await processExistingTokens();
}, 60 * 1000); // Check every minute
